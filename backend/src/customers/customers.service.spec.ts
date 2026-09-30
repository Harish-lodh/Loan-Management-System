import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { CustomerStatus, Role } from '../database/entities';
import { CustomersService } from './customers.service';

const opsUser = {
  id: 'ops-1',
  name: 'Ops',
  email: 'ops@org1.test',
  phone: '9999999999',
  organizationId: 'org-1',
  role: Role.OPERATIONS,
};

function queryBuilder() {
  return {
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  };
}

function serviceWith() {
  const builder = queryBuilder();
  const customersRepository = {
    createQueryBuilder: jest.fn(() => builder),
    findOne: jest.fn(),
    create: jest.fn((input) => input),
    save: jest.fn(async (input) => ({ id: 'customer-1', ...input })),
  };
  const organizationsRepository = { exists: jest.fn(), find: jest.fn() };
  const auditLogService = { create: jest.fn() };
  return {
    service: new CustomersService(customersRepository as never, organizationsRepository as never, auditLogService as never),
    customersRepository,
    organizationsRepository,
    auditLogService,
    builder,
  };
}

describe('CustomersService', () => {
  const previousKey = process.env.CREDENTIALS_ENCRYPTION_KEY;

  beforeAll(() => {
    process.env.CREDENTIALS_ENCRYPTION_KEY = 'a'.repeat(64);
  });

  afterAll(() => {
    process.env.CREDENTIALS_ENCRYPTION_KEY = previousKey;
  });

  it('scopes customer lists to the staff member organization', async () => {
    const { service, builder } = serviceWith();

    await service.list(opsUser, { page: 1, limit: 10 });

    expect(builder.andWhere).toHaveBeenCalledWith('customer.organizationId = :organizationId', { organizationId: 'org-1' });
  });

  it('hides customers from other organizations', async () => {
    const { service, customersRepository } = serviceWith();
    customersRepository.findOne.mockResolvedValue(null);

    await expect(service.details(opsUser, 'customer-9')).rejects.toBeInstanceOf(NotFoundException);
    expect(customersRepository.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'customer-9', organizationId: 'org-1' } }));
  });

  it('stores PAN encrypted and masked, and never returns the encrypted value', async () => {
    const { service, customersRepository, auditLogService } = serviceWith();
    customersRepository.findOne.mockResolvedValue(null);

    const created = await service.create(opsUser, { fullName: 'Maya Sharma', phone: '9000000002', pan: 'abcpm1234k' });

    const saved = customersRepository.save.mock.calls[0][0];
    expect(saved.organizationId).toBe('org-1');
    expect(saved.panMasked).toBe('XXXXXX234K');
    expect(saved.panEncrypted).toBeTruthy();
    expect(saved.panEncrypted).not.toContain('ABCPM1234K');
    expect(saved.panHash).toHaveLength(64);
    expect(created).not.toHaveProperty('panEncrypted');
    expect(created).not.toHaveProperty('panHash');
    expect(JSON.stringify(auditLogService.create.mock.calls)).not.toContain('ABCPM1234K');
  });

  it('rejects a duplicate phone within the organization', async () => {
    const { service, customersRepository } = serviceWith();
    customersRepository.findOne.mockResolvedValue({ id: 'customer-2', customerNumber: 'CUS2' });

    await expect(service.create(opsUser, { fullName: 'Dup', phone: '9000000002' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('refuses new applications for blocked customers', async () => {
    const { service, customersRepository } = serviceWith();
    customersRepository.findOne.mockResolvedValue({ id: 'customer-1', status: CustomerStatus.BLOCKED });

    await expect(service.findActiveForOrganization('customer-1', 'org-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lets the SUPER_ADMIN omit organizationId on a single-NBFC instance', async () => {
    const { service, customersRepository, organizationsRepository } = serviceWith();
    customersRepository.findOne.mockResolvedValue(null);
    organizationsRepository.find.mockResolvedValue([{ id: 'org-1' }]);

    await service.create({ ...opsUser, role: Role.SUPER_ADMIN, organizationId: null }, { fullName: 'Arjun', phone: '9000000003' });

    expect(customersRepository.save.mock.calls[0][0].organizationId).toBe('org-1');
  });
});
