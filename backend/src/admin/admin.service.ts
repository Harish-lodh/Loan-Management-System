import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { paginationMeta } from '../common/dto/pagination-query.dto';
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

  async dashboard() {
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
      this.usersRepository.count(),
      this.applicationsRepository.count(),
      this.applicationsRepository.count({ where: { status: LoanApplicationStatus.APPROVED } }),
      this.applicationsRepository.count({ where: { status: LoanApplicationStatus.REJECTED } }),
      this.applicationsRepository.count({
        where: [
          { status: LoanApplicationStatus.DRAFT },
          { status: LoanApplicationStatus.SUBMITTED },
          { status: LoanApplicationStatus.IN_REVIEW },
          { status: LoanApplicationStatus.PENDING },
          { status: LoanApplicationStatus.AUTO_REVIEWED },
        ],
      }),
      this.loansRepository.count({ where: { status: LoanStatus.ACTIVE } }),
      this.repaymentsRepository.count({ where: { status: RepaymentStatus.OVERDUE } }),
      this.sumRepayments(RepaymentStatus.OVERDUE),
      this.sumOutstandingLoans(),
      this.sumPaidRepayments(),
      this.averageRiskScore(),
      this.repaymentStatusChart(),
      this.monthlyLoanActivity(),
      this.applicationsByStatus(),
      this.riskDistribution(),
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

  async users(query: AdminUsersQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const builder = this.usersRepository.createQueryBuilder('user');

    if (query.search) {
      builder.where('(user.name LIKE :search OR user.email LIKE :search OR user.phone LIKE :search)', {
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

  async userDetails(id: string) {
    const user = await this.usersRepository.findOne({
      where: { id },
      relations: {
        loanApplications: true,
        loans: { repayments: true },
        repayments: true,
      },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      ...this.sanitizeUser(user),
      loanApplications: user.loanApplications,
      loans: user.loans,
      repayments: user.repayments,
    };
  }

  async loanApplications(query: AdminLoanApplicationsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const builder = this.applicationsRepository
      .createQueryBuilder('application')
      .leftJoinAndSelect('application.user', 'user')
      .leftJoinAndSelect('application.loan', 'loan');

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

  async loanApplicationDetails(id: string) {
    const application = await this.applicationsRepository.findOne({
      where: { id },
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

  approveLoanApplication(id: string, adminUserId: string, comment?: string) {
    return this.loansService.approveApplication(id, adminUserId, comment);
  }

  rejectLoanApplication(id: string, adminUserId: string, comment: string) {
    return this.loansService.rejectApplication(id, adminUserId, comment);
  }

  async repayments(query: AdminRepaymentsQueryDto) {
    await this.repaymentsService.refreshOverdueRepayments();
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const builder = this.repaymentsRepository
      .createQueryBuilder('repayment')
      .leftJoinAndSelect('repayment.user', 'user')
      .leftJoinAndSelect('repayment.loan', 'loan');

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

  updateRepaymentStatus(id: string, status: RepaymentStatus, adminUserId: string) {
    return this.repaymentsService.updateStatusForAdmin(id, status, adminUserId);
  }

  private async repaymentStatusChart() {
    const rows = await this.repaymentsRepository
      .createQueryBuilder('repayment')
      .select('repayment.status', 'name')
      .addSelect('COUNT(*)', 'value')
      .groupBy('repayment.status')
      .getRawMany<{ name: RepaymentStatus; value: string }>();

    return rows.map((row) => ({ name: row.name, value: Number(row.value) }));
  }

  private async applicationsByStatus() {
    const rows = await this.applicationsRepository
      .createQueryBuilder('application')
      .select('application.status', 'name')
      .addSelect('COUNT(*)', 'value')
      .groupBy('application.status')
      .getRawMany<{ name: LoanApplicationStatus; value: string }>();

    return rows.map((row) => ({ name: row.name, value: Number(row.value) }));
  }

  private async riskDistribution() {
    const rows = await this.applicationsRepository
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
      .groupBy('name')
      .getRawMany<{ name: string; value: string }>();

    return rows.map((row) => ({ name: row.name, value: Number(row.value) }));
  }

  private async sumRepayments(status: RepaymentStatus) {
    const row = await this.repaymentsRepository
      .createQueryBuilder('repayment')
      .select('COALESCE(SUM(repayment.emiAmount), 0)', 'total')
      .where('repayment.status = :status', { status })
      .getRawOne<{ total: string }>();

    return Number(row?.total ?? 0);
  }

  private async sumPaidRepayments() {
    const row = await this.repaymentsRepository
      .createQueryBuilder('repayment')
      .select('COALESCE(SUM(repayment.paidAmount), 0)', 'total')
      .where('repayment.status = :status', { status: RepaymentStatus.PAID })
      .getRawOne<{ total: string }>();

    return Number(row?.total ?? 0);
  }

  private async sumOutstandingLoans() {
    const row = await this.loansRepository
      .createQueryBuilder('loan')
      .select('COALESCE(SUM(loan.outstandingBalance), 0)', 'total')
      .where('loan.status IN (:...statuses)', { statuses: [LoanStatus.ACTIVE, LoanStatus.DISBURSED] })
      .getRawOne<{ total: string }>();

    return Number(row?.total ?? 0);
  }

  private async averageRiskScore() {
    const row = await this.applicationsRepository
      .createQueryBuilder('application')
      .select('COALESCE(AVG(application.riskScore), 0)', 'average')
      .getRawOne<{ average: string }>();

    return Number(Number(row?.average ?? 0).toFixed(1));
  }

  private async monthlyLoanActivity() {
    const rows = await this.applicationsRepository
      .createQueryBuilder('application')
      .select("DATE_FORMAT(application.createdAt, '%Y-%m')", 'month')
      .addSelect('COUNT(*)', 'applications')
      .addSelect("SUM(CASE WHEN application.status = 'APPROVED' THEN 1 ELSE 0 END)", 'approved')
      .addSelect("SUM(CASE WHEN application.status = 'REJECTED' THEN 1 ELSE 0 END)", 'rejected')
      .groupBy('month')
      .orderBy('month', 'ASC')
      .limit(12)
      .getRawMany<{ month: string; applications: string; approved: string; rejected: string }>();

    return rows.map((row) => ({
      month: row.month,
      applications: Number(row.applications),
      approved: Number(row.approved),
      rejected: Number(row.rejected),
    }));
  }

  private sanitizeUser(user: User): SafeUser {
    const { password: _password, ...safeUser } = user;
    return safeUser;
  }
}
