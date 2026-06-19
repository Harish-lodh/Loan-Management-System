import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { AuditLogService } from '../audit-log/audit-log.service';
import { assertOrganizationAccess, organizationScope } from '../common/tenancy/organization-scope';
import { RequestUser } from '../common/types/request-user.interface';
import {
  Loan,
  LoanApplication,
  LoanApplicationStatus,
  LoanStatus,
  Notification,
  NotificationType,
  Repayment,
  RepaymentStatus,
  Role,
} from '../database/entities';
import { NotificationsService } from '../notifications/notifications.service';
import { ApplyLoanDto } from './dto/apply-loan.dto';
import { UpdateLoanDraftDto } from './dto/update-loan-draft.dto';
import { assessLoanRisk, calculateEmi, generateRepaymentSchedule } from './loan-calculations';

type StatusHistoryEntry = {
  status: string;
  changedAt: string;
  actorUserId: string | null;
  comment?: string | null;
};

@Injectable()
export class LoansService {
  constructor(
    @InjectRepository(LoanApplication)
    private readonly applicationsRepository: Repository<LoanApplication>,
    @InjectRepository(Loan)
    private readonly loansRepository: Repository<Loan>,
    @InjectRepository(Repayment)
    private readonly repaymentsRepository: Repository<Repayment>,
    @InjectRepository(Notification)
    private readonly notificationsRepository: Repository<Notification>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly notificationsService: NotificationsService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async apply(user: RequestUser, dto: ApplyLoanDto) {
    return this.createSubmittedApplication(user, dto);
  }

  async saveDraft(user: RequestUser, dto: ApplyLoanDto) {
    const organizationId = this.requireOrganizationForLegacyLoan(user);
    const { applicationData, risk, emi } = this.buildApplicationData(dto);
    const application = await this.applicationsRepository.save(
      this.applicationsRepository.create({
        userId: user.id,
        organizationId,
        ...applicationData,
        status: LoanApplicationStatus.DRAFT,
        statusHistory: [this.statusEntry(LoanApplicationStatus.DRAFT, user.id, 'Draft saved')],
      }),
    );

    await this.notificationsService.create({
      userId: user.id,
      title: 'Loan draft saved',
      message: 'Your loan draft was saved. Submit it when you are ready for review.',
      type: NotificationType.APPLICATION_DRAFTED,
      priority: 'LOW',
      actionUrl: `/loans/${application.id}`,
    });
    await this.auditLogService.create({
      action: 'LOAN_APPLICATION_DRAFTED',
      entityType: 'LoanApplication',
      entityId: application.id,
      actorUserId: user.id,
      metadata: {
        organizationId,
        amount: application.amount,
        tenureMonths: application.tenureMonths,
        riskScore: application.riskScore,
      },
    });

    return { application, risk, emi };
  }

  async updateDraft(applicationId: string, user: RequestUser, dto: UpdateLoanDraftDto) {
    const application = await this.applicationsRepository.findOne({ where: { id: applicationId } });
    if (!application) {
      throw new NotFoundException('Loan application not found');
    }
    this.ensureCanAccess(application.userId, user, application.organizationId);
    if (application.status !== LoanApplicationStatus.DRAFT) {
      throw new BadRequestException('Only draft applications can be updated');
    }

    const nextInput = {
      amount: dto.amount ?? application.amount,
      tenureMonths: dto.tenureMonths ?? application.tenureMonths,
      monthlyIncome: dto.monthlyIncome ?? application.monthlyIncome,
      employmentType: dto.employmentType ?? application.employmentType,
      existingMonthlyDebt: dto.existingMonthlyDebt ?? application.existingMonthlyDebt,
      creditScore: dto.creditScore ?? application.creditScore,
      purpose: dto.purpose ?? application.purpose,
    };
    const { applicationData, risk, emi } = this.buildApplicationData(nextInput);

    Object.assign(application, applicationData);
    application.statusHistory = this.appendStatus(
      application.statusHistory,
      this.statusEntry(LoanApplicationStatus.DRAFT, user.id, 'Draft updated'),
    );

    const saved = await this.applicationsRepository.save(application);
    await this.auditLogService.create({
      action: 'LOAN_APPLICATION_DRAFT_UPDATED',
      entityType: 'LoanApplication',
      entityId: saved.id,
      actorUserId: user.id,
      metadata: { organizationId: saved.organizationId ?? null, fields: Object.keys(dto), riskScore: saved.riskScore },
    });

    return { application: saved, risk, emi };
  }

  async submitApplication(applicationId: string, user: RequestUser) {
    const application = await this.applicationsRepository.findOne({ where: { id: applicationId } });
    if (!application) {
      throw new NotFoundException('Loan application not found');
    }
    this.ensureCanAccess(application.userId, user, application.organizationId);
    if (![LoanApplicationStatus.DRAFT, LoanApplicationStatus.PENDING].includes(application.status)) {
      throw new BadRequestException('Only draft applications can be submitted');
    }

    const result = await this.moveApplicationToReview(application, user.id);
    await this.auditLogService.create({
      action: 'LOAN_APPLICATION_SUBMITTED',
      entityType: 'LoanApplication',
      entityId: result.application.id,
      actorUserId: user.id,
      metadata: {
        amount: result.application.amount,
        tenureMonths: result.application.tenureMonths,
        status: result.application.status,
        riskScore: result.application.riskScore,
      },
    });

    return result;
  }

  async findMine(user: RequestUser) {
    const [applications, loans, unreadNotifications, nextRepayment] = await Promise.all([
      this.applicationsRepository.find({
        where: { userId: user.id },
        order: { createdAt: 'DESC' },
        relations: { loan: true },
      }),
      this.loansRepository.find({
        where: { userId: user.id },
        order: { createdAt: 'DESC' },
        relations: { repayments: true, application: true },
      }),
      this.notificationsRepository.count({ where: { userId: user.id, isRead: false } }),
      this.repaymentsRepository.findOne({
        where: { userId: user.id, status: In([RepaymentStatus.PENDING, RepaymentStatus.OVERDUE]) },
        order: { dueDate: 'ASC' },
      }),
    ]);

    loans.forEach((loan) => {
      loan.repayments = [...(loan.repayments ?? [])].sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
    });

    const activeLoans = loans.filter((loan) => [LoanStatus.ACTIVE, LoanStatus.DISBURSED].includes(loan.status));
    const totalOutstanding = loans.reduce((sum, loan) => sum + Number(loan.outstandingBalance), 0);
    const overdueRepayments = loans.reduce(
      (sum, loan) => sum + (loan.repayments ?? []).filter((repayment) => repayment.status === RepaymentStatus.OVERDUE).length,
      0,
    );

    return {
      applications,
      loans,
      summary: {
        activeLoans: activeLoans.length,
        draftApplications: applications.filter((application) => application.status === LoanApplicationStatus.DRAFT).length,
        inReviewApplications: applications.filter((application) =>
          [LoanApplicationStatus.SUBMITTED, LoanApplicationStatus.IN_REVIEW, LoanApplicationStatus.AUTO_REVIEWED].includes(
            application.status,
          ),
        ).length,
        latestApplicationStatus: applications[0]?.status ?? null,
        totalOutstanding,
        nextRepayment,
        overdueRepayments,
        unreadNotifications,
      },
    };
  }

  async findOneForUser(id: string, user: RequestUser) {
    const loan = await this.loansRepository.findOne({
      where: { id },
      relations: { application: true, repayments: true },
    });

    if (loan) {
      this.ensureCanAccess(loan.userId, user, loan.organizationId);
      loan.repayments = [...(loan.repayments ?? [])].sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
      return { type: 'loan', loan };
    }

    const application = await this.applicationsRepository.findOne({
      where: { id },
      relations: { loan: { repayments: true } },
    });
    if (!application) {
      throw new NotFoundException('Loan or application not found');
    }

    this.ensureCanAccess(application.userId, user, application.organizationId);
    if (application.loan?.repayments) {
      application.loan.repayments = application.loan.repayments.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
    }
    return { type: 'application', application };
  }

  async calculateEmiForLoanOrApplication(id: string, user: RequestUser, annualInterestRate?: number) {
    const source = await this.findEmiSource(id);
    this.ensureCanAccess(source.userId, user, source.organizationId);
    const rate = annualInterestRate ?? source.annualInterestRate;
    const emi = calculateEmi({
      principal: source.amount,
      tenureMonths: source.tenureMonths,
      annualInterestRate: rate,
    });
    const schedule = generateRepaymentSchedule({
      principal: source.amount,
      tenureMonths: source.tenureMonths,
      annualInterestRate: rate,
      startDate: new Date(),
    });

    return { ...emi, annualInterestRate: rate, schedule };
  }

  async getRepaymentSchedule(loanId: string, user: RequestUser) {
    const loan = await this.loansRepository.findOne({ where: { id: loanId } });
    if (!loan) {
      throw new NotFoundException('Loan not found');
    }
    this.ensureCanAccess(loan.userId, user, loan.organizationId);
    return this.repaymentsRepository.find({ where: { loanId }, order: { dueDate: 'ASC' } });
  }

  async approveApplication(applicationId: string, adminUser: RequestUser, comment?: string) {
    const existing = await this.applicationsRepository.findOne({
      where: { id: applicationId },
      relations: { loan: true },
    });
    if (!existing) {
      throw new NotFoundException('Loan application not found');
    }
    assertOrganizationAccess(adminUser, existing.organizationId, 'loan application');
    if (existing.status === LoanApplicationStatus.REJECTED) {
      throw new BadRequestException('Rejected applications cannot be approved');
    }
    if (existing.status === LoanApplicationStatus.DRAFT) {
      throw new BadRequestException('Draft applications must be submitted before review');
    }
    if (existing.loan) {
      return { application: existing, loan: existing.loan };
    }

    const startDate = new Date();
    const schedule = generateRepaymentSchedule({
      principal: existing.amount,
      annualInterestRate: existing.annualInterestRate,
      tenureMonths: existing.tenureMonths,
      startDate,
    });

    const result = await this.dataSource.transaction(async (manager) => {
      existing.status = LoanApplicationStatus.APPROVED;
      existing.adminComment = comment ?? null;
      existing.reviewedAt = new Date();
      existing.reviewerId = adminUser.id;
      existing.statusHistory = this.appendStatus(
        existing.statusHistory,
        this.statusEntry(LoanApplicationStatus.APPROVED, adminUser.id, comment ?? 'Application approved'),
      );
      const application = await manager.save(LoanApplication, existing);

      const loan = await manager.save(
        Loan,
        manager.create(Loan, {
          userId: existing.userId,
          applicationId: existing.id,
          organizationId: existing.organizationId ?? null,
          partnerId: existing.partnerId ?? null,
          productId: existing.productId ?? null,
          principal: existing.amount,
          annualInterestRate: existing.annualInterestRate,
          tenureMonths: existing.tenureMonths,
          emi: existing.emi,
          totalPayable: existing.totalPayable,
          outstandingBalance: existing.amount,
          status: LoanStatus.ACTIVE,
          disbursedAt: startDate,
          startDate,
          statusHistory: [
            this.statusEntry(LoanStatus.APPROVED, adminUser.id, 'Loan approved'),
            this.statusEntry(LoanStatus.DISBURSED, adminUser.id, 'Loan disbursed for demo flow'),
            this.statusEntry(LoanStatus.ACTIVE, adminUser.id, 'Repayment schedule is active'),
          ],
        }),
      );

      const repayments = schedule.map((item) =>
        manager.create(Repayment, {
          loanId: loan.id,
          userId: existing.userId,
          dueDate: item.dueDate,
          emiAmount: item.emiAmount,
          principalComponent: item.principalComponent,
          interestComponent: item.interestComponent,
        }),
      );
      await manager.save(Repayment, repayments);

      return { application, loan };
    });

    await this.notificationsService.create({
      userId: existing.userId,
      title: 'Loan approved',
      message: 'Your loan has been approved and the repayment schedule is now active.',
      type: NotificationType.LOAN_APPROVED,
      priority: 'HIGH',
      actionUrl: `/loans/${result.loan.id}`,
    });
    await this.notificationsService.create({
      userId: existing.userId,
      title: 'Upcoming payment scheduled',
      message: `Your first EMI of ${existing.emi.toFixed(2)} is due on ${schedule[0].dueDate.toDateString()}.`,
      type: NotificationType.PAYMENT_DUE,
      actionUrl: `/loans/${result.loan.id}`,
      metadata: { dueDate: schedule[0].dueDate },
    });
    await this.auditLogService.create({
      action: 'LOAN_APPROVED',
      entityType: 'LoanApplication',
      entityId: existing.id,
      actorUserId: adminUser.id,
      metadata: { organizationId: existing.organizationId ?? null, comment: comment ?? null, riskScore: existing.riskScore },
    });
    await this.auditLogService.create({
      action: 'LOAN_DISBURSED',
      entityType: 'Loan',
      entityId: result.loan.id,
      actorUserId: adminUser.id,
      metadata: { organizationId: result.loan.organizationId ?? null, principal: result.loan.principal, status: result.loan.status },
    });
    await this.auditLogService.create({
      action: 'STATUS_CHANGED',
      entityType: 'Loan',
      entityId: result.loan.id,
      actorUserId: adminUser.id,
      metadata: { organizationId: result.loan.organizationId ?? null, status: LoanStatus.ACTIVE },
    });

    return result;
  }

  async rejectApplication(applicationId: string, adminUser: RequestUser, comment: string) {
    const existing = await this.applicationsRepository.findOne({ where: { id: applicationId } });
    if (!existing) {
      throw new NotFoundException('Loan application not found');
    }
    assertOrganizationAccess(adminUser, existing.organizationId, 'loan application');
    if (existing.status === LoanApplicationStatus.APPROVED) {
      throw new BadRequestException('Approved applications cannot be rejected');
    }
    if (existing.status === LoanApplicationStatus.DRAFT) {
      throw new BadRequestException('Draft applications must be submitted before review');
    }

    existing.status = LoanApplicationStatus.REJECTED;
    existing.adminComment = comment;
    existing.reviewedAt = new Date();
    existing.reviewerId = adminUser.id;
    existing.statusHistory = this.appendStatus(
      existing.statusHistory,
      this.statusEntry(LoanApplicationStatus.REJECTED, adminUser.id, comment),
    );
    const application = await this.applicationsRepository.save(existing);

    await this.notificationsService.create({
      userId: existing.userId,
      title: 'Loan rejected',
      message: `Your loan application was rejected. Reason: ${comment}`,
      type: NotificationType.LOAN_REJECTED,
      priority: 'HIGH',
      actionUrl: `/loans/${application.id}`,
    });
    await this.auditLogService.create({
      action: 'LOAN_REJECTED',
      entityType: 'LoanApplication',
      entityId: application.id,
      actorUserId: adminUser.id,
      metadata: { organizationId: application.organizationId ?? null, comment, riskScore: application.riskScore },
    });
    await this.auditLogService.create({
      action: 'STATUS_CHANGED',
      entityType: 'LoanApplication',
      entityId: application.id,
      actorUserId: adminUser.id,
      metadata: { organizationId: application.organizationId ?? null, status: application.status },
    });

    return application;
  }

  private async createSubmittedApplication(user: RequestUser, dto: ApplyLoanDto) {
    const organizationId = this.requireOrganizationForLegacyLoan(user);
    const { applicationData } = this.buildApplicationData(dto);
    const application = await this.applicationsRepository.save(
      this.applicationsRepository.create({
        userId: user.id,
        organizationId,
        ...applicationData,
        status: LoanApplicationStatus.DRAFT,
        statusHistory: [this.statusEntry(LoanApplicationStatus.DRAFT, user.id, 'Application started')],
      }),
    );

    await this.auditLogService.create({
      action: 'LOAN_APPLICATION_STARTED',
      entityType: 'LoanApplication',
      entityId: application.id,
      actorUserId: user.id,
      metadata: { organizationId, amount: application.amount, tenureMonths: application.tenureMonths },
    });

    const result = await this.moveApplicationToReview(application, user.id);
    await this.auditLogService.create({
      action: 'LOAN_APPLICATION_SUBMITTED',
      entityType: 'LoanApplication',
      entityId: result.application.id,
      actorUserId: user.id,
      metadata: {
        organizationId,
        amount: result.application.amount,
        tenureMonths: result.application.tenureMonths,
        status: result.application.status,
        riskScore: result.application.riskScore,
      },
    });

    return result;
  }

  private async moveApplicationToReview(application: LoanApplication, actorUserId: string) {
    const { applicationData, risk, emi } = this.buildApplicationData({
      amount: application.amount,
      tenureMonths: application.tenureMonths,
      monthlyIncome: application.monthlyIncome,
      employmentType: application.employmentType,
      existingMonthlyDebt: application.existingMonthlyDebt,
      creditScore: application.creditScore,
      purpose: application.purpose,
    });

    Object.assign(application, applicationData);
    application.status = LoanApplicationStatus.IN_REVIEW;
    application.submittedAt = new Date();
    application.statusHistory = this.appendStatus(
      this.appendStatus(
        application.statusHistory,
        this.statusEntry(LoanApplicationStatus.SUBMITTED, actorUserId, 'Application submitted by customer'),
      ),
      this.statusEntry(LoanApplicationStatus.IN_REVIEW, null, 'Application entered bank review queue'),
    );

    const saved = await this.applicationsRepository.save(application);

    await this.notificationsService.create({
      userId: application.userId,
      title: 'Loan application submitted',
      message: 'Your loan application has been submitted and scored for review.',
      type: NotificationType.APPLICATION_SUBMITTED,
      actionUrl: `/loans/${saved.id}`,
      metadata: { riskScore: saved.riskScore, approvalLikelihood: saved.approvalLikelihood },
    });
    await this.notificationsService.create({
      userId: application.userId,
      title: 'Application in review',
      message: 'A bank reviewer can now approve or reject your application.',
      type: NotificationType.APPLICATION_REVIEW_STARTED,
      actionUrl: `/loans/${saved.id}`,
    });

    return { application: saved, risk, emi };
  }

  private buildApplicationData(dto: ApplyLoanDto | Required<UpdateLoanDraftDto>) {
    const annualInterestRate = Number(this.config.get<string>('ANNUAL_INTEREST_RATE') ?? 12);
    const emi = calculateEmi({
      principal: dto.amount,
      annualInterestRate,
      tenureMonths: dto.tenureMonths,
    });
    const risk = assessLoanRisk(dto);

    return {
      risk,
      emi,
      applicationData: {
        amount: dto.amount,
        tenureMonths: dto.tenureMonths,
        monthlyIncome: dto.monthlyIncome,
        employmentType: dto.employmentType,
        existingMonthlyDebt: dto.existingMonthlyDebt,
        creditScore: dto.creditScore,
        purpose: dto.purpose,
        riskScore: risk.riskScore,
        approvalLikelihood: risk.approvalLikelihood,
        riskExplanation: risk.riskExplanation,
        scoreBreakdown: risk.scoreBreakdown,
        annualInterestRate,
        emi: emi.monthlyEmi,
        totalPayable: emi.totalPayable,
        totalInterest: emi.totalInterest,
      },
    };
  }

  private async findEmiSource(id: string) {
    const loan = await this.loansRepository.findOne({ where: { id } });
    if (loan) {
      return {
        userId: loan.userId,
        organizationId: loan.organizationId ?? null,
        amount: loan.principal,
        tenureMonths: loan.tenureMonths,
        annualInterestRate: loan.annualInterestRate,
      };
    }

    const application = await this.applicationsRepository.findOne({ where: { id } });
    if (!application) {
      throw new NotFoundException('Loan or application not found');
    }

    return {
      userId: application.userId,
      organizationId: application.organizationId ?? null,
      amount: application.amount,
      tenureMonths: application.tenureMonths,
      annualInterestRate: application.annualInterestRate,
    };
  }

  private requireOrganizationForLegacyLoan(user: RequestUser) {
    const scope = organizationScope(user);
    if (!scope) {
      throw new BadRequestException('Organization context is required to create a loan application');
    }
    return scope;
  }

  private ensureCanAccess(resourceUserId: string, user: RequestUser, organizationId?: string | null) {
    if (user.role === Role.ADMIN) {
      assertOrganizationAccess(user, organizationId, 'loan resource');
      return;
    }
    if (resourceUserId !== user.id) {
      throw new ForbiddenException('You cannot access this resource');
    }
  }

  private statusEntry(status: string, actorUserId: string | null, comment?: string | null): StatusHistoryEntry {
    return {
      status,
      changedAt: new Date().toISOString(),
      actorUserId,
      comment: comment ?? null,
    };
  }

  private appendStatus(existing: Record<string, unknown>[] | null | undefined, entry: StatusHistoryEntry) {
    const history = Array.isArray(existing) ? existing : [];
    return [...history, entry];
  }
}
