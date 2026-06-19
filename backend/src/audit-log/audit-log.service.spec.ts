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
    expect(builder.andWhere).toHaveBeenCalledWith('actor.organizationId = :organizationId', {
      organizationId: 'org-1',
    });
  });
});
