import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RepaymentStatus, Role } from '../database/entities';
import { AdminService } from './admin.service';

const scopedAdmin = {
  id: 'admin-1',
  name: 'Org Admin',
  email: 'admin@org1.test',
  phone: '9999999999',
  organizationId: 'org-1',
  role: Role.ADMIN,
};

function queryBuilder() {
  return {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    getRawMany: jest.fn().mockResolvedValue([]),
    getRawOne: jest.fn().mockResolvedValue({ total: '0', average: '0' }),
    getCount: jest.fn().mockResolvedValue(0),
  };
}

function serviceWith(overrides: Record<string, unknown> = {}) {
  const usersRepository = {
    count: jest.fn(),
    createQueryBuilder: jest.fn(() => queryBuilder()),
    findOne: jest.fn(),
  };
  const customersRepository = { count: jest.fn() };
  const userRolesRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn((input) => input),
    delete: jest.fn(),
  };
  const applicationsRepository = {
    count: jest.fn(),
    createQueryBuilder: jest.fn(() => queryBuilder()),
    findOne: jest.fn(),
  };
  const loansRepository = {
    count: jest.fn(),
    createQueryBuilder: jest.fn(() => queryBuilder()),
  };
  const repaymentsRepository = {
    createQueryBuilder: jest.fn(() => queryBuilder()),
  };
  const loansService = { approveApplication: jest.fn(), rejectApplication: jest.fn() };
  const repaymentsService = { refreshOverdueRepayments: jest.fn(), updateStatusForAdmin: jest.fn() };
  const usersService = { createStaffUser: jest.fn(), updateStaffUser: jest.fn(async (user, dto) => ({ ...user, ...dto })) };
  const auditLogService = { create: jest.fn() };

  const dependencies = {
    usersRepository,
    customersRepository,
    userRolesRepository,
    applicationsRepository,
    loansRepository,
    repaymentsRepository,
    loansService,
    repaymentsService,
    usersService,
    auditLogService,
    ...overrides,
  };

  return {
    service: new AdminService(
      dependencies.usersRepository as never,
      dependencies.customersRepository as never,
      dependencies.userRolesRepository as never,
      dependencies.applicationsRepository as never,
      dependencies.loansRepository as never,
      dependencies.repaymentsRepository as never,
      dependencies.loansService as never,
      dependencies.repaymentsService as never,
      dependencies.usersService as never,
      dependencies.auditLogService as never,
    ),
    dependencies,
  };
}

describe('AdminService tenant isolation', () => {
  it('scopes staff lookups to the authenticated organization', async () => {
    const { service, dependencies } = serviceWith();
    dependencies.usersRepository.findOne.mockResolvedValue(null);

    await expect(service.updateStaffUser(scopedAdmin, 'user-2', { isActive: false })).rejects.toBeInstanceOf(NotFoundException);
    expect(dependencies.usersRepository.findOne).toHaveBeenCalledWith({ where: { id: 'user-2', organizationId: 'org-1' } });
  });

  it('hides the SUPER_ADMIN account from NBFC admins', async () => {
    const { service, dependencies } = serviceWith();
    dependencies.usersRepository.findOne.mockResolvedValue({ id: 'vendor-1', role: Role.SUPER_ADMIN, organizationId: 'org-1' });

    await expect(service.updateStaffUser(scopedAdmin, 'vendor-1', { isActive: false })).rejects.toBeInstanceOf(NotFoundException);
    expect(dependencies.usersService.updateStaffUser).not.toHaveBeenCalled();
  });

  it('excludes the SUPER_ADMIN from staff lists for NBFC admins', async () => {
    const builder = queryBuilder();
    const { service } = serviceWith({
      usersRepository: { count: jest.fn(), createQueryBuilder: jest.fn(() => builder), findOne: jest.fn() },
    });

    await service.staffUsers(scopedAdmin, { page: 1, limit: 10 });

    expect(builder.andWhere).toHaveBeenCalledWith('user.role != :superAdmin', { superAdmin: Role.SUPER_ADMIN });
  });

  it('prevents admins from deactivating their own account', async () => {
    const { service, dependencies } = serviceWith();
    dependencies.usersRepository.findOne.mockResolvedValue({ id: 'admin-1', role: Role.ADMIN, organizationId: 'org-1' });

    await expect(service.updateStaffUser(scopedAdmin, 'admin-1', { isActive: false })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('adds organization filtering to admin application lists', async () => {
    const builder = queryBuilder();
    const { service, dependencies } = serviceWith({
      applicationsRepository: {
        count: jest.fn(),
        createQueryBuilder: jest.fn(() => builder),
        findOne: jest.fn(),
      },
    });

    await service.loanApplications(scopedAdmin, { page: 1, limit: 10 });

    expect(dependencies.applicationsRepository.createQueryBuilder).toHaveBeenCalledWith('application');
    expect(builder.andWhere).toHaveBeenCalledWith('application.organizationId = :organizationId', {
      organizationId: 'org-1',
    });
  });

  it('adds organization filtering to admin repayment lists through loan scope', async () => {
    const builder = queryBuilder();
    const { service, dependencies } = serviceWith({
      repaymentsRepository: {
        createQueryBuilder: jest.fn(() => builder),
      },
    });

    await service.repayments(scopedAdmin, { page: 1, limit: 10 });

    expect(dependencies.repaymentsRepository.createQueryBuilder).toHaveBeenCalledWith('repayment');
    expect(builder.andWhere).toHaveBeenCalledWith('loan.organizationId = :organizationId', {
      organizationId: 'org-1',
    });
  });

  it('passes tenant-aware admin context to repayment updates', () => {
    const { service, dependencies } = serviceWith();

    service.updateRepaymentStatus('repayment-1', RepaymentStatus.OVERDUE, scopedAdmin);

    expect(dependencies.repaymentsService.updateStatusForAdmin).toHaveBeenCalledWith(
      'repayment-1',
      RepaymentStatus.OVERDUE,
      scopedAdmin,
    );
  });
});
