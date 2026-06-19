import { ForbiddenException } from '@nestjs/common';
import { EmploymentType, LoanApplicationStatus, Role } from '../database/entities';
import { LoansService } from './loans.service';

const scopedUser = {
  id: 'user-1',
  name: 'Borrower',
  email: 'borrower@org1.test',
  phone: '9999999999',
  organizationId: 'org-1',
  role: Role.USER,
};

const scopedAdmin = {
  id: 'admin-1',
  name: 'Org Admin',
  email: 'admin@org1.test',
  phone: '9999999999',
  organizationId: 'org-1',
  role: Role.ADMIN,
};

const draftDto = {
  amount: 100000,
  tenureMonths: 12,
  monthlyIncome: 80000,
  employmentType: EmploymentType.SALARIED,
  existingMonthlyDebt: 5000,
  creditScore: 760,
  purpose: 'Working capital',
};

function serviceWith(overrides: Record<string, unknown> = {}) {
  const applicationsRepository = {
    create: jest.fn((input) => input),
    save: jest.fn(async (input) => ({ id: 'application-1', ...input })),
    findOne: jest.fn(),
  };
  const loansRepository = { findOne: jest.fn(), find: jest.fn() };
  const repaymentsRepository = { find: jest.fn(), findOne: jest.fn() };
  const notificationsRepository = { count: jest.fn() };
  const dataSource = { transaction: jest.fn() };
  const config = { get: jest.fn((key: string) => (key === 'ANNUAL_INTEREST_RATE' ? '12' : undefined)) };
  const notificationsService = { create: jest.fn() };
  const auditLogService = { create: jest.fn() };

  const dependencies = {
    applicationsRepository,
    loansRepository,
    repaymentsRepository,
    notificationsRepository,
    dataSource,
    config,
    notificationsService,
    auditLogService,
    ...overrides,
  };

  return {
    service: new LoansService(
      dependencies.applicationsRepository as never,
      dependencies.loansRepository as never,
      dependencies.repaymentsRepository as never,
      dependencies.notificationsRepository as never,
      dependencies.dataSource as never,
      dependencies.config as never,
      dependencies.notificationsService as never,
      dependencies.auditLogService as never,
    ),
    dependencies,
  };
}

describe('LoansService tenant isolation', () => {
  it('stores the authenticated organization on legacy loan drafts', async () => {
    const { service, dependencies } = serviceWith();

    await service.saveDraft(scopedUser, draftDto);

    expect(dependencies.applicationsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        organizationId: 'org-1',
      }),
    );
    expect(dependencies.auditLogService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ organizationId: 'org-1' }),
      }),
    );
  });

  it('rejects legacy loan creation when a borrower has no organization context', async () => {
    const { service } = serviceWith();

    await expect(
      service.saveDraft({ ...scopedUser, organizationId: null }, draftDto),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects approval of another organization application', async () => {
    const { service, dependencies } = serviceWith();
    dependencies.applicationsRepository.findOne.mockResolvedValue({
      id: 'application-2',
      userId: 'borrower-2',
      organizationId: 'org-2',
      status: LoanApplicationStatus.IN_REVIEW,
      loan: null,
    });

    await expect(service.approveApplication('application-2', scopedAdmin, 'ok')).rejects.toBeInstanceOf(ForbiddenException);
    expect(dependencies.dataSource.transaction).not.toHaveBeenCalled();
  });
});
