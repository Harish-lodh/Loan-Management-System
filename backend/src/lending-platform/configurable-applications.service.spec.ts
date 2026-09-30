import { ForbiddenException } from '@nestjs/common';
import { LoanApplicationStatus, Role } from '../database/entities';
import { ConfigurableApplicationsService } from './configurable-applications.service';

const scopedAdmin = {
  id: 'admin-1',
  name: 'Org Admin',
  email: 'admin@org1.test',
  phone: '9999999999',
  organizationId: 'org-1',
  role: Role.ADMIN,
};

function serviceWith(overrides: Record<string, unknown> = {}) {
  const applicationsRepository = { findOne: jest.fn(), find: jest.fn(), save: jest.fn(), create: jest.fn() };
  const snapshotsRepository = { findOne: jest.fn() };
  const transitionsRepository = { find: jest.fn(), save: jest.fn(), create: jest.fn() };
  const dataSource = { transaction: jest.fn() };
  const resolver = { resolveLive: jest.fn(), resolveForApplication: jest.fn(), createSnapshotPayload: jest.fn() };
  const ruleEngine = { evaluateRules: jest.fn() };
  const workflowService = { nextCustomerActions: jest.fn(), allowedNextStatuses: jest.fn(), assertTransition: jest.fn(), statusAfterCreditApproval: jest.fn() };
  const auditLogService = { create: jest.fn() };
  const usersService = { findById: jest.fn(), findCustomerByEmail: jest.fn(), createCustomer: jest.fn() };

  const dependencies = {
    applicationsRepository,
    snapshotsRepository,
    transitionsRepository,
    dataSource,
    resolver,
    ruleEngine,
    workflowService,
    auditLogService,
    usersService,
    ...overrides,
  };

  return {
    service: new ConfigurableApplicationsService(
      dependencies.applicationsRepository as never,
      dependencies.snapshotsRepository as never,
      dependencies.transitionsRepository as never,
      dependencies.dataSource as never,
      dependencies.resolver as never,
      dependencies.ruleEngine as never,
      dependencies.workflowService as never,
      dependencies.auditLogService as never,
      dependencies.usersService as never,
    ),
    dependencies,
  };
}

describe('ConfigurableApplicationsService organization scope', () => {
  it('rejects reading an application from another organization', async () => {
    const { service, dependencies } = serviceWith();
    dependencies.applicationsRepository.findOne.mockResolvedValue({
      id: 'application-2',
      organizationId: 'org-2',
      userId: 'borrower-2',
      status: LoanApplicationStatus.DRAFT,
    });

    await expect(service.findOne('application-2', scopedAdmin)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('scopes admin application lists to the authenticated organization', async () => {
    const { service, dependencies } = serviceWith();
    dependencies.applicationsRepository.find.mockResolvedValue([]);

    await service.findAllForAdmin(scopedAdmin);

    expect(dependencies.applicationsRepository.find).toHaveBeenCalledWith({
      where: { organizationId: 'org-1' },
      order: { createdAt: 'DESC' },
      relations: { user: true },
    });
  });
});
