import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ASSIGNABLE_STAFF_ROLES, isSuperAdmin } from '../common/auth/role-permissions';
import { paginationMeta } from '../common/dto/pagination-query.dto';
import { organizationScope } from '../common/tenancy/organization-scope';
import { RequestUser } from '../common/types/request-user.interface';
import {
  Customer,
  Loan,
  LoanApplication,
  LoanApplicationStatus,
  LoanStatus,
  Repayment,
  RepaymentStatus,
  Role,
  User,
  UserRole,
} from '../database/entities';
import { LoansService } from '../loans/loans.service';
import { RepaymentsService } from '../repayments/repayments.service';
import { SafeUser, UsersService } from '../users/users.service';
import { AdminLoanApplicationsQueryDto, AdminRepaymentsQueryDto, AdminUsersQueryDto } from './dto/admin-query.dto';
import { AssignStaffRoleDto, CreateStaffUserDto, UpdateStaffUserDto } from './dto/staff-user.dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Customer)
    private readonly customersRepository: Repository<Customer>,
    @InjectRepository(UserRole)
    private readonly userRolesRepository: Repository<UserRole>,
    @InjectRepository(LoanApplication)
    private readonly applicationsRepository: Repository<LoanApplication>,
    @InjectRepository(Loan)
    private readonly loansRepository: Repository<Loan>,
    @InjectRepository(Repayment)
    private readonly repaymentsRepository: Repository<Repayment>,
    private readonly loansService: LoansService,
    private readonly repaymentsService: RepaymentsService,
    private readonly usersService: UsersService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async dashboard(user: RequestUser) {
    const organizationId = organizationScope(user);
    const [
      totalCustomers,
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
      this.customersRepository.count({ where: this.organizationWhere(organizationId) }),
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
        totalCustomers,
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

  async loanApplications(user: RequestUser, query: AdminLoanApplicationsQueryDto) {
    const organizationId = organizationScope(user);
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const builder = this.applicationsRepository
      .createQueryBuilder('application')
      .leftJoinAndSelect('application.customer', 'customer')
      .leftJoinAndSelect('application.loan', 'loan');

    if (organizationId) {
      builder.andWhere('application.organizationId = :organizationId', { organizationId });
    }

    if (query.status) {
      builder.andWhere('application.status = :status', { status: query.status });
    }

    if (query.search) {
      builder.andWhere(
        '(customer.fullName LIKE :search OR customer.phone LIKE :search OR customer.customerNumber LIKE :search OR application.applicationNumber LIKE :search OR application.purpose LIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    const [applications, total] = await builder
      .orderBy('application.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      items: applications,
      meta: paginationMeta(total, page, limit),
    };
  }

  async loanApplicationDetails(user: RequestUser, id: string) {
    const organizationId = organizationScope(user);
    const application = await this.applicationsRepository.findOne({
      where: this.organizationWhere(organizationId, { id }),
      relations: { customer: true, loan: { repayments: true } },
    });
    if (!application) {
      throw new NotFoundException('Loan application not found');
    }
    return application;
  }

  approveLoanApplication(id: string, adminUser: RequestUser, comment?: string) {
    return this.loansService.approveApplication(id, adminUser, comment);
  }

  rejectLoanApplication(id: string, adminUser: RequestUser, comment: string) {
    return this.loansService.rejectApplication(id, adminUser, comment);
  }

  async repayments(user: RequestUser, query: AdminRepaymentsQueryDto) {
    const organizationId = organizationScope(user);
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const builder = this.repaymentsRepository
      .createQueryBuilder('repayment')
      .leftJoinAndSelect('repayment.customer', 'customer')
      .leftJoinAndSelect('repayment.loan', 'loan');

    if (organizationId) {
      builder.andWhere('loan.organizationId = :organizationId', { organizationId });
    }

    if (query.status) {
      builder.andWhere('repayment.status = :status', { status: query.status });
    }

    if (query.search) {
      builder.andWhere('(customer.fullName LIKE :search OR customer.phone LIKE :search OR customer.customerNumber LIKE :search OR loan.loanAccountNumber LIKE :search)', {
        search: `%${query.search}%`,
      });
    }

    const [repayments, total] = await builder
      .orderBy('repayment.dueDate', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      items: repayments,
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
    const { password: _password, refreshTokenHash: _refreshTokenHash, ...safeUser } = user;
    return safeUser;
  }

  async staffUsers(user: RequestUser, query: AdminUsersQueryDto) {
    const organizationId = organizationScope(user);
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const builder = this.usersRepository.createQueryBuilder('user');

    if (organizationId) {
      builder.andWhere('user.organizationId = :organizationId', { organizationId });
    }
    // The vendor account is invisible to NBFC staff.
    if (!isSuperAdmin(user)) {
      builder.andWhere('user.role != :superAdmin', { superAdmin: Role.SUPER_ADMIN });
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

    return { items: users.map((staffUser) => this.sanitizeUser(staffUser)), meta: paginationMeta(total, page, limit) };
  }

  async createStaffUser(user: RequestUser, dto: CreateStaffUserDto) {
    const organizationId = organizationScope(user) ?? dto.organizationId ?? null;
    if (!organizationId) {
      throw new BadRequestException('organizationId is required for staff accounts');
    }
    if (!ASSIGNABLE_STAFF_ROLES.includes(dto.role)) {
      throw new ForbiddenException('This role cannot be assigned');
    }
    const created = await this.usersService.createStaffUser({ ...dto, organizationId });
    await this.auditLogService.create({
      action: 'STAFF_USER_CREATED',
      entityType: 'User',
      entityId: created.id,
      actorUserId: user.id,
      metadata: { organizationId, role: created.role, email: created.email },
    });
    return created;
  }

  async updateStaffUser(user: RequestUser, id: string, dto: UpdateStaffUserDto) {
    const target = await this.findManageableStaffUser(user, id);
    if (target.id === user.id && (dto.isActive === false || (dto.role && dto.role !== target.role))) {
      throw new BadRequestException('You cannot deactivate or change the role of your own account');
    }
    const updated = await this.usersService.updateStaffUser(target, dto);
    await this.auditLogService.create({
      action: 'STAFF_USER_UPDATED',
      entityType: 'User',
      entityId: target.id,
      actorUserId: user.id,
      metadata: { organizationId: target.organizationId ?? null, fields: Object.keys(dto), role: updated.role, isActive: updated.isActive },
    });
    return updated;
  }

  async assignStaffRole(user: RequestUser, id: string, dto: AssignStaffRoleDto) {
    await this.findManageableStaffUser(user, id);
    const organizationId = organizationScope(user) ?? dto.organizationId;
    const existing = await this.userRolesRepository.findOne({
      where: { userId: id, organizationId, roleName: dto.roleName },
    });
    if (existing) {
      return existing;
    }
    return this.userRolesRepository.save(this.userRolesRepository.create({ userId: id, organizationId, roleName: dto.roleName }));
  }

  async removeStaffRole(user: RequestUser, id: string, organizationId: string, roleName: string) {
    await this.findManageableStaffUser(user, id);
    await this.userRolesRepository.delete({ userId: id, organizationId: organizationScope(user) ?? organizationId, roleName });
    return { message: 'Role assignment removed' };
  }

  // NBFC admins can only manage staff in their own organization, and never the SUPER_ADMIN.
  // A 404 (not 403) is returned so the vendor account's existence is not revealed.
  private async findManageableStaffUser(user: RequestUser, id: string) {
    const organizationId = organizationScope(user);
    const target = await this.usersRepository.findOne({ where: organizationId ? { id, organizationId } : { id } });
    if (!target || (target.role === Role.SUPER_ADMIN && !isSuperAdmin(user))) {
      throw new NotFoundException('Staff user not found');
    }
    return target;
  }
}
