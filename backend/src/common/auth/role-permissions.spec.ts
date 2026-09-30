import { Role } from '../../database/entities/enums';
import { ALL_PERMISSIONS, ASSIGNABLE_STAFF_ROLES, effectivePermissions, hasPermissions } from './role-permissions';

describe('role permissions', () => {
  it('gives SUPER_ADMIN every permission', () => {
    expect(effectivePermissions({ role: Role.SUPER_ADMIN }).sort()).toEqual([...ALL_PERMISSIONS].sort());
  });

  it('keeps organization creation away from NBFC admins', () => {
    expect(hasPermissions({ role: Role.ADMIN }, ['staff.manage', 'provider.configure'])).toBe(true);
    expect(hasPermissions({ role: Role.ADMIN }, ['organization.create'])).toBe(false);
  });

  it('separates credit, operations and collections duties', () => {
    expect(hasPermissions({ role: Role.CREDIT_OFFICER }, ['application.approve'])).toBe(true);
    expect(hasPermissions({ role: Role.CREDIT_OFFICER }, ['disbursement.initiate'])).toBe(false);
    expect(hasPermissions({ role: Role.OPERATIONS }, ['disbursement.initiate'])).toBe(true);
    expect(hasPermissions({ role: Role.OPERATIONS }, ['application.approve'])).toBe(false);
    expect(hasPermissions({ role: Role.COLLECTIONS }, ['payment.collect'])).toBe(true);
    expect(hasPermissions({ role: Role.COLLECTIONS }, ['application.create'])).toBe(false);
  });

  it('makes VIEWER read-only', () => {
    const writes = effectivePermissions({ role: Role.VIEWER }).filter((permission) => !permission.endsWith('.view'));
    expect(writes).toEqual([]);
  });

  it('adds per-user grants on top of the role', () => {
    expect(hasPermissions({ role: Role.VIEWER, permissions: ['payment.collect'] }, ['payment.collect'])).toBe(true);
  });

  it('never lets NBFC admins hand out SUPER_ADMIN', () => {
    expect(ASSIGNABLE_STAFF_ROLES).not.toContain(Role.SUPER_ADMIN);
  });
});
