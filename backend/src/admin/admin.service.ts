import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';
import { paginationMeta } from '../common/dto/pagination-query.dto';
import { organizationScope } from '../common/tenancy/organization-scope';
import { RequestUser } from '../common/types/request-user.interface';
import {
  Loan,
  LoanApplication,
  LoanApplicationStatus,
  LoanStatus,
  Repayment,
  RepaymentStatus,
  User,
} from '../database/entities';
import { LoansService } from '../loans/loans.service';
import { RepaymentsService } from '../repayments/repayments.service';
import { SafeUser } from '../users/users.service';
import { AdminLoanApplicationsQueryDto, AdminRepaymentsQueryDto, AdminUsersQueryDto } from './dto/admin-query.dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(LoanApplication)
    private readonly applicationsRepository: Repository<LoanApplication>,
    @InjectRepository(Loan)
    private readonly loansRepository: Repository<Loan>,
    @InjectRepository(Repayment)
    private readonly repaymentsRepository: Repository<Repayment>,
    private readonly loansService: LoansService,
    private readonly repaymentsService: RepaymentsService,
  ) {}

  async dashboard(user: RequestUser) {
    const organizationId = organizationScope(user);
    await this.repaymentsService.refreshOverdueRepayments();

    const [
      totalUsers,
      totalLoanApplications,
      approvedLoans,
      rejectedLoans,
      pendingLoans,
      activeLoans,
      overdueRepayments,
      overdueAmount,
      totalOutstanding,
      collectedAmount,
      averageRiskScore,
      repaymentStatus,
      monthlyLoanActivity,
      applicationsByStatus,
      riskDistribution,
    ] = await Promise.all([
      this.usersRepository.count({ where: this.organizationWhere(organizationId) }),
      this.applicationsRepository.count({ where: this.organizationWhere(organizationId) }),
      this.applicationsRepository.count({ where: this.organizationWhere(organizationId, { status: LoanApplicationStatus.APPROVED }) }),
      this.applicationsRepository.count({ where: this.organizationWhere(organizationId, { status: LoanApplicationStatus.REJECTED }) }),
      this.applicationsRepository.count({
        where: [
          LoanApplicationStatus.DRAFT,
          LoanApplicationStatus.SUBMITTED,
          LoanApplicationStatus.IN_REVIEW,
          LoanApplicationStatus.PENDING,
          LoanApplicationStatus.AUTO_REVIEWED,
        ].map((status) => this.organizationWhere(organizationId, { status })),
      }),
      this.loansRepository.count({ where: this.organizationWhere(organizationId, { status: LoanStatus.ACTIVE }) }),
      this.countRepayments(RepaymentStatus.OVERDUE, organizationId),
      this.sumRepayments(RepaymentStatus.OVERDUE, organizationId),
      this.sumOutstandingLoans(organizationId),
      this.sumPaidRepayments(organizationId),
      this.averageRiskScore(organizationId),
      this.repaymentStatusChart(organizationId),
      this.monthlyLoanActivity(organizationId),
      this.applicationsByStatus(organizationId),
      this.riskDistribution(organizationId),
    ]);

    return {
      summary: {
        totalUsers,
        totalLoanApplications,
        approvedLoans,
        rejectedLoans,
        pendingLoans,
        activeLoans,
        overdueRepayments,
        overdueAmount,
        totalOutstanding,
        collectedAmount,
        averageRiskScore,
      },
      charts: {
        approvalsVsRejections: [
          { name: 'Approved', value: approvedLoans },
          { name: 'Rejected', value: rejectedLoans },
        ],
        pendingLoans: [{ name: 'Pending review', value: pendingLoans }],
        monthlyLoanActivity,
        repaymentStatus,
        applicationsByStatus,
        riskDistribution,
      },
    };
  }

  async users(user: RequestUser, query: AdminUsersQueryDto) {
    const organizationId = organizationScope(user);
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const builder = this.usersRepository.createQueryBuilder('user');

    if (organizationId) {
      builder.where('user.organizationId = :organizationId', { organizationId });
    }

    if (query.search) {
      builder.andWhere('(user.name LIKE :search OR user.email LIKE :search OR user.phone LIKE :search)', {
        search: `%${query.search}%`,
      });
    }

    const [users, total] = await builder
      .orderBy('user.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { items: users.map((user) => this.sanitizeUser(user)), meta: paginationMeta(total, page, limit) };
  }

  async userDetails(user: RequestUser, id: string) {
    const organizationId = organizationScope(user);
    const targetUser = await this.usersRepository.findOne({
      where: this.organizationWhere(organizationId, { id }),
      relations: {
        loanApplications: true,
        loans: { repayments: true },
        repayments: true,
      },
    });
    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    return {
      ...this.sanitizeUser(targetUser),
      loanApplications: targetUser.loanApplications,
      loans: targetUser.loans,
      repayments: targetUser.repayments,
    };
  }

  async loanApplications(user: RequestUser, query: AdminLoanApplicationsQueryDto) {
    const organizationId = organizationScope(user);
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const builder = this.applicationsRepository
      .createQueryBuilder('application')
      .leftJoinAndSelect('application.user', 'user')
      .leftJoinAndSelect('application.loan', 'loan');

    if (organizationId) {
      builder.andWhere('application.organizationId = :organizationId', { organizationId });
    }

    if (query.status) {
      builder.andWhere('application.status = :status', { status: query.status });
    }

    if (query.search) {
      builder.andWhere(
        '(user.name LIKE :search OR user.email LIKE :search OR application.purpose LIKE :search OR application.id LIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    const [applications, total] = await builder
      .orderBy('application.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      items: applications.map((application) => ({
        ...application,
        user: this.sanitizeUser(application.user),
      })),
      meta: paginationMeta(total, page, limit),
    };
  }

  async loanApplicationDetails(user: RequestUser, id: string) {
    const organizationId = organizationScope(user);
    const application = await this.applicationsRepository.findOne({
      where: this.organizationWhere(organizationId, { id }),
      relations: { user: true, loan: { repayments: true } },
    });
    if (!application) {
      throw new NotFoundException('Loan application not found');
    }
    return {
      ...application,
      user: this.sanitizeUser(application.user),
    };
  }

  approveLoanApplication(id: string, adminUser: RequestUser, comment?: string) {
    return this.loansService.approveApplication(id, adminUser, comment);
  }

  rejectLoanApplication(id: string, adminUser: RequestUser, comment: string) {
    return this.loansService.rejectApplication(id, adminUser, comment);
  }

  async repayments(user: RequestUser, query: AdminRepaymentsQueryDto) {
    const organizationId = organizationScope(user);
    await this.repaymentsService.refreshOverdueRepayments();
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const builder = this.repaymentsRepository
      .createQueryBuilder('repayment')
      .leftJoinAndSelect('repayment.user', 'user')
      .leftJoinAndSelect('repayment.loan', 'loan');

    if (organizationId) {
      builder.andWhere('loan.organizationId = :organizationId', { organizationId });
    }

    if (query.status) {
      builder.andWhere('repayment.status = :status', { status: query.status });
    }

    if (query.search) {
      builder.andWhere('(user.name LIKE :search OR user.email LIKE :search OR loan.id LIKE :search)', {
        search: `%${query.search}%`,
      });
    }

    const [repayments, total] = await builder
      .orderBy('repayment.dueDate', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      items: repayments.map((repayment) => ({
        ...repayment,
        user: this.sanitizeUser(repayment.user),
      })),
      meta: paginationMeta(total, page, limit),
    };
  }

  updateRepaymentStatus(id: string, status: RepaymentStatus, adminUser: RequestUser) {
    return this.repaymentsService.updateStatusForAdmin(id, status, adminUser);
  }

  private async countRepayments(status: RepaymentStatus, organizationId: string | null) {
    const builder = this.repaymentsRepository
      .createQueryBuilder('repayment')
      .leftJoin('repayment.loan', 'loan')
      .where('repayment.status = :status', { status });

    this.applyOrganizationFilter(builder, 'loan', organizationId);
    return builder.getCount();
  }

  private async repaymentStatusChart(organizationId: string | null) {
    const builder = this.repaymentsRepository
      .createQueryBuilder('repayment')
      .leftJoin('repayment.loan', 'loan')
      .select('repayment.status', 'name')
      .addSelect('COUNT(*)', 'value')
      .groupBy('repayment.status');

    this.applyOrganizationFilter(builder, 'loan', organizationId);
    const rows = await builder.getRawMany<{ name: RepaymentStatus; value: string }>();

    return rows.map((row) => ({ name: row.name, value: Number(row.value) }));
  }

  private async applicationsByStatus(organizationId: string | null) {
    const builder = this.applicationsRepository
      .createQueryBuilder('application')
      .select('application.status', 'name')
      .addSelect('COUNT(*)', 'value')
      .groupBy('application.status');

    this.applyOrganizationFilter(builder, 'application', organizationId);
    const rows = await builder.getRawMany<{ name: LoanApplicationStatus; value: string }>();

    return rows.map((row) => ({ name: row.name, value: Number(row.value) }));
  }

  private async riskDistribution(organizationId: string | null) {
    const builder = this.applicationsRepository
      .createQueryBuilder('application')
      .select(
        `CASE
          WHEN application.riskScore >= 70 THEN 'Low risk'
          WHEN application.riskScore >= 55 THEN 'Manual review'
          ELSE 'High risk'
        END`,
        'name',
      )
      .addSelect('COUNT(*)', 'value')
      .groupBy('name');

    this.applyOrganizationFilter(builder, 'application', organizationId);
    const rows = await builder.getRawMany<{ name: string; value: string }>();

    return rows.map((row) => ({ name: row.name, value: Number(row.value) }));
  }

  private async sumRepayments(status: RepaymentStatus, organizationId: string | null) {
    const builder = this.repaymentsRepository
      .createQueryBuilder('repayment')
      .leftJoin('repayment.loan', 'loan')
      .select('COALESCE(SUM(repayment.emiAmount), 0)', 'total')
      .where('repayment.status = :status', { status });

    this.applyOrganizationFilter(builder, 'loan', organizationId);
    const row = await builder.getRawOne<{ total: string }>();

    return Number(row?.total ?? 0);
  }

  private async sumPaidRepayments(organizationId: string | null) {
    const builder = this.repaymentsRepository
      .createQueryBuilder('repayment')
      .leftJoin('repayment.loan', 'loan')
      .select('COALESCE(SUM(repayment.paidAmount), 0)', 'total')
      .where('repayment.status = :status', { status: RepaymentStatus.PAID });

    this.applyOrganizationFilter(builder, 'loan', organizationId);
    const row = await builder.getRawOne<{ total: string }>();

    return Number(row?.total ?? 0);
  }

  private async sumOutstandingLoans(organizationId: string | null) {
    const builder = this.loansRepository
      .createQueryBuilder('loan')
      .select('COALESCE(SUM(loan.outstandingBalance), 0)', 'total')
      .where('loan.status IN (:...statuses)', { statuses: [LoanStatus.ACTIVE, LoanStatus.DISBURSED] });

    this.applyOrganizationFilter(builder, 'loan', organizationId);
    const row = await builder.getRawOne<{ total: string }>();

    return Number(row?.total ?? 0);
  }

  private async averageRiskScore(organizationId: string | null) {
    const builder = this.applicationsRepository
      .createQueryBuilder('application')
      .select('COALESCE(AVG(application.riskScore), 0)', 'average');

    this.applyOrganizationFilter(builder, 'application', organizationId);
    const row = await builder.getRawOne<{ average: string }>();

    return Number(Number(row?.average ?? 0).toFixed(1));
  }

  private async monthlyLoanActivity(organizationId: string | null) {
    const builder = this.applicationsRepository
      .createQueryBuilder('application')
      .select("DATE_FORMAT(application.createdAt, '%Y-%m')", 'month')
      .addSelect('COUNT(*)', 'applications')
      .addSelect("SUM(CASE WHEN application.status = 'APPROVED' THEN 1 ELSE 0 END)", 'approved')
      .addSelect("SUM(CASE WHEN application.status = 'REJECTED' THEN 1 ELSE 0 END)", 'rejected')
      .groupBy('month')
      .orderBy('month', 'ASC')
      .limit(12);

    this.applyOrganizationFilter(builder, 'application', organizationId);
    const rows = await builder.getRawMany<{ month: string; applications: string; approved: string; rejected: string }>();

    return rows.map((row) => ({
      month: row.month,
      applications: Number(row.applications),
      approved: Number(row.approved),
      rejected: Number(row.rejected),
    }));
  }

  private organizationWhere<T extends Record<string, unknown>>(organizationId: string | null, where?: T) {
    return organizationId ? { ...(where ?? ({} as T)), organizationId } : (where ?? {});
  }

  private applyOrganizationFilter<Entity extends ObjectLiteral>(
    builder: SelectQueryBuilder<Entity>,
    alias: string,
    organizationId: string | null,
  ) {
    if (organizationId) {
      builder.andWhere(`${alias}.organizationId = :organizationId`, { organizationId });
    }
    return builder;
  }

  private sanitizeUser(user: User): SafeUser {
    const { password: _password, ...safeUser } = user;
    return safeUser;
  }
}
