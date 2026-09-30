import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuditLogService } from '../audit-log/audit-log.service';
import { assertPermission } from '../common/auth/role-permissions';
import { assertOrganizationAccess } from '../common/tenancy/organization-scope';
import { RequestUser } from '../common/types/request-user.interface';
import { Loan, LoanApplication, LoanApplicationStatus, LoanStatus, Repayment } from '../database/entities';
import { generateRepaymentSchedule } from './loan-calculations';

type StatusHistoryEntry = {
  status: string;
  changedAt: string;
  actorUserId: string | null;
  comment?: string | null;
};

// Staff review of simple (non-configurable) applications: approval books the loan and its schedule directly.
@Injectable()
export class LoansService {
  constructor(
    @InjectRepository(LoanApplication)
    private readonly applicationsRepository: Repository<LoanApplication>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly auditLogService: AuditLogService,
  ) {}

  async approveApplication(applicationId: string, staffUser: RequestUser, comment?: string) {
    const existing = await this.applicationsRepository.findOne({
      where: { id: applicationId },
      relations: { loan: true },
    });
    if (!existing) {
      throw new NotFoundException('Loan application not found');
    }
    assertOrganizationAccess(staffUser, existing.organizationId, 'loan application');
    assertPermission(staffUser, 'application.approve');
    this.assertMakerChecker(existing, staffUser);
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
      existing.reviewerId = staffUser.id;
      existing.statusHistory = this.appendStatus(
        existing.statusHistory,
        this.statusEntry(LoanApplicationStatus.APPROVED, staffUser.id, comment ?? 'Application approved'),
      );
      const application = await manager.save(LoanApplication, existing);

      const loan = await manager.save(
        Loan,
        manager.create(Loan, {
          customerId: existing.customerId,
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
            this.statusEntry(LoanStatus.APPROVED, staffUser.id, 'Loan approved'),
            this.statusEntry(LoanStatus.DISBURSED, staffUser.id, 'Loan disbursed'),
            this.statusEntry(LoanStatus.ACTIVE, staffUser.id, 'Repayment schedule is active'),
          ],
        }),
      );

      const repayments = schedule.map((item) =>
        manager.create(Repayment, {
          loanId: loan.id,
          customerId: existing.customerId,
          dueDate: item.dueDate,
          emiAmount: item.emiAmount,
          principalComponent: item.principalComponent,
          interestComponent: item.interestComponent,
        }),
      );
      await manager.save(Repayment, repayments);

      return { application, loan };
    });

    await this.auditLogService.create({
      action: 'LOAN_APPROVED',
      entityType: 'LoanApplication',
      entityId: existing.id,
      actorUserId: staffUser.id,
      metadata: { organizationId: existing.organizationId ?? null, comment: comment ?? null, riskScore: existing.riskScore },
    });
    await this.auditLogService.create({
      action: 'LOAN_DISBURSED',
      entityType: 'Loan',
      entityId: result.loan.id,
      actorUserId: staffUser.id,
      metadata: { organizationId: result.loan.organizationId ?? null, principal: result.loan.principal, status: result.loan.status },
    });

    return result;
  }

  async rejectApplication(applicationId: string, staffUser: RequestUser, comment: string) {
    const existing = await this.applicationsRepository.findOne({ where: { id: applicationId } });
    if (!existing) {
      throw new NotFoundException('Loan application not found');
    }
    assertOrganizationAccess(staffUser, existing.organizationId, 'loan application');
    assertPermission(staffUser, 'application.reject');
    if (existing.status === LoanApplicationStatus.APPROVED) {
      throw new BadRequestException('Approved applications cannot be rejected');
    }
    if (existing.status === LoanApplicationStatus.DRAFT) {
      throw new BadRequestException('Draft applications must be submitted before review');
    }

    existing.status = LoanApplicationStatus.REJECTED;
    existing.adminComment = comment;
    existing.reviewedAt = new Date();
    existing.reviewerId = staffUser.id;
    existing.statusHistory = this.appendStatus(existing.statusHistory, this.statusEntry(LoanApplicationStatus.REJECTED, staffUser.id, comment));
    const application = await this.applicationsRepository.save(existing);

    await this.auditLogService.create({
      action: 'LOAN_REJECTED',
      entityType: 'LoanApplication',
      entityId: application.id,
      actorUserId: staffUser.id,
      metadata: { organizationId: application.organizationId ?? null, comment, riskScore: application.riskScore },
    });

    return application;
  }

  private assertMakerChecker(application: LoanApplication, user: RequestUser) {
    if (process.env.MAKER_CHECKER_ENABLED === 'false') {
      return;
    }
    if (application.createdById && application.createdById === user.id) {
      throw new ForbiddenException('Maker-checker: the staff member who created this application cannot approve it');
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
