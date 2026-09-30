import { ForbiddenException } from '@nestjs/common';
import { LoanApplicationStatus, Role } from '../database/entities';
import { LoansService } from './loans.service';

const creditOfficer = {
  id: 'credit-1',
  name: 'Credit Officer',
  email: 'credit@org1.test',
  phone: '9999999999',
  organizationId: 'org-1',
  role: Role.CREDIT_OFFICER,
};

function serviceWith() {
  const applicationsRepository = {
    create: jest.fn((input) => input),
    save: jest.fn(async (input) => input),
    findOne: jest.fn(),
  };
  const dataSource = { transaction: jest.fn() };
  const auditLogService = { create: jest.fn() };

  return {
    service: new LoansService(applicationsRepository as never, dataSource as never, auditLogService as never),
    dependencies: { applicationsRepository, dataSource, auditLogService },
  };
}

function inReviewApplication(overrides: Record<string, unknown> = {}) {
  return {
    id: 'application-1',
    customerId: 'customer-1',
    organizationId: 'org-1',
    createdById: 'ops-1',
    status: LoanApplicationStatus.IN_REVIEW,
    loan: null,
    ...overrides,
  };
}

describe('LoansService', () => {
  it('rejects approval of another organization application', async () => {
    const { service, dependencies } = serviceWith();
    dependencies.applicationsRepository.findOne.mockResolvedValue(inReviewApplication({ organizationId: 'org-2' }));

    await expect(service.approveApplication('application-1', creditOfficer, 'ok')).rejects.toBeInstanceOf(ForbiddenException);
    expect(dependencies.dataSource.transaction).not.toHaveBeenCalled();
  });

  it('enforces maker-checker: the creator cannot approve their own application', async () => {
    const { service, dependencies } = serviceWith();
    dependencies.applicationsRepository.findOne.mockResolvedValue(inReviewApplication({ createdById: 'credit-1' }));

    await expect(service.approveApplication('application-1', creditOfficer, 'ok')).rejects.toThrow('Maker-checker');
    expect(dependencies.dataSource.transaction).not.toHaveBeenCalled();
  });

  it('does not let roles without approval rights approve', async () => {
    const { service, dependencies } = serviceWith();
    dependencies.applicationsRepository.findOne.mockResolvedValue(inReviewApplication());

    await expect(
      service.approveApplication('application-1', { ...creditOfficer, id: 'viewer-1', role: Role.VIEWER }, 'ok'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lets a different staff member reject the application', async () => {
    const { service, dependencies } = serviceWith();
    dependencies.applicationsRepository.findOne.mockResolvedValue(inReviewApplication());

    const result = await service.rejectApplication('application-1', creditOfficer, 'Income not verified');

    expect(result.status).toBe(LoanApplicationStatus.REJECTED);
    expect(result.reviewerId).toBe('credit-1');
  });
});
