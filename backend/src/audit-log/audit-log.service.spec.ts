import { Role } from '../database/entities';
import { AuditLogService } from './audit-log.service';

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
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  };
}

describe('AuditLogService tenant isolation', () => {
  it('scopes audit-log reads by actor organization for organization admins', async () => {
    const builder = queryBuilder();
    const repository = {
      createQueryBuilder: jest.fn(() => builder),
    };
    const service = new AuditLogService(repository as never);

    await service.findAll(scopedAdmin, { page: 1, limit: 10 });

    expect(repository.createQueryBuilder).toHaveBeenCalledWith('auditLog');
    expect(builder.andWhere).toHaveBeenCalledWith(expect.stringContaining('actor.organizationId = :organizationId'), {
      organizationId: 'org-1',
      superAdmin: Role.SUPER_ADMIN,
    });
  });

  it('shows the vendor (SUPER_ADMIN) actions to the NBFC', async () => {
    const builder = queryBuilder();
    const service = new AuditLogService({ createQueryBuilder: jest.fn(() => builder) } as never);

    await service.findAll(scopedAdmin, { page: 1, limit: 10 });

    expect(builder.andWhere.mock.calls[0][0]).toContain('actor.role = :superAdmin');
  });
});

describe('AuditLogService chain writes', () => {
  it('serializes concurrent writes so each entry links to the previous one', async () => {
    const rows: Array<{ sequence: number; currentHash: string; previousHash: string | null }> = [];
    const repository = {
      findOne: jest.fn(async () => {
        // Simulate a slow read so unserialized writers would both see the same latest row.
        await new Promise((resolve) => setTimeout(resolve, 5));
        return rows[rows.length - 1] ?? null;
      }),
      create: jest.fn((input) => input),
      save: jest.fn(async (input) => {
        const row = { ...input, sequence: rows.length + 1 };
        rows.push(row);
        return row;
      }),
    };
    const service = new AuditLogService(repository as never);

    await Promise.all(
      Array.from({ length: 5 }, (_, index) => service.create({ action: 'TEST', entityType: 'Test', entityId: String(index) })),
    );

    expect(rows).toHaveLength(5);
    expect(rows[0].previousHash).toBeNull();
    for (let index = 1; index < rows.length; index += 1) {
      expect(rows[index].previousHash).toBe(rows[index - 1].currentHash);
    }
  });

  it('keeps writing after a failed entry', async () => {
    const repository = {
      findOne: jest.fn(async () => null),
      create: jest.fn((input) => input),
      save: jest.fn().mockRejectedValueOnce(new Error('db down')).mockImplementation(async (input) => input),
    };
    const service = new AuditLogService(repository as never);

    await expect(service.create({ action: 'A', entityType: 'T', entityId: '1' })).rejects.toThrow('db down');
    await expect(service.create({ action: 'B', entityType: 'T', entityId: '2' })).resolves.toMatchObject({ action: 'B' });
  });
});
