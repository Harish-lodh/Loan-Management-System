import { ForbiddenException } from '@nestjs/common';
import { RepaymentStatus, Role } from '../database/entities';
import { RepaymentsService } from './repayments.service';

const scopedAdmin = {
  id: 'admin-1',
  name: 'Org Admin',
  email: 'admin@org1.test',
  phone: '9999999999',
  organizationId: 'org-1',
  role: Role.ADMIN,
};

function serviceWith(overrides: Record<string, unknown> = {}) {
  const repaymentsRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
  };
  const loansRepository = { findOne: jest.fn() };
  const dataSource = { transaction: jest.fn() };
  const auditLogService = { create: jest.fn() };

  const dependencies = {
    repaymentsRepository,
    loansRepository,
    dataSource,
    auditLogService,
    ...overrides,
  };

  return {
    service: new RepaymentsService(
      dependencies.repaymentsRepository as never,
      dependencies.loansRepository as never,
      dependencies.dataSource as never,
      dependencies.auditLogService as never,
    ),
    dependencies,
  };
}

describe('RepaymentsService tenant isolation', () => {
  it('rejects admin status updates for another organization repayment', async () => {
    const { service, dependencies } = serviceWith();
    dependencies.repaymentsRepository.findOne.mockResolvedValue({
      id: 'repayment-2',
      loanId: 'loan-2',
      customerId: 'customer-2',
      status: RepaymentStatus.PENDING,
      loan: { id: 'loan-2', organizationId: 'org-2' },
    });

    await expect(
      service.updateStatusForAdmin('repayment-2', RepaymentStatus.OVERDUE, scopedAdmin),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(dependencies.repaymentsRepository.save).not.toHaveBeenCalled();
    expect(dependencies.dataSource.transaction).not.toHaveBeenCalled();
  });
});
