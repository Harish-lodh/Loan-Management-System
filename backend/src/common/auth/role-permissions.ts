import { ForbiddenException } from '@nestjs/common';
import { Role } from '../../database/entities/enums';

export const ALL_PERMISSIONS = [
  'dashboard.view',
  'organization.create',
  'organization.view',
  'organization.update',
  'product.create',
  'product.view',
  'product.update',
  'product.publish',
  'partner.create',
  'partner.view',
  'partner.update',
  'provider.configure',
  'provider.view',
  'customer.view',
  'customer.manage',
  'application.create',
  'application.view',
  'application.review',
  'application.approve',
  'application.reject',
  'agreement.generate',
  'agreement.template.manage',
  'agreement.template.view',
  'esign.initiate',
  'enach.initiate',
  'disbursement.initiate',
  'repayment.view',
  'repayment.update',
  'payment.collect',
  'staff.manage',
  'audit.view',
] as const;

export type PermissionCode = (typeof ALL_PERMISSIONS)[number];

const READ_ONLY: PermissionCode[] = [
  'dashboard.view',
  'organization.view',
  'product.view',
  'partner.view',
  'customer.view',
  'application.view',
  'agreement.template.view',
  'repayment.view',
];

export const ROLE_PERMISSIONS: Record<Role, readonly PermissionCode[]> = {
  [Role.SUPER_ADMIN]: ALL_PERMISSIONS,
  // Creating additional organizations is a platform-level action reserved for the vendor.
  [Role.ADMIN]: ALL_PERMISSIONS.filter((permission) => permission !== 'organization.create'),
  [Role.CREDIT_OFFICER]: [
    ...READ_ONLY,
    'customer.manage',
    'application.create',
    'application.review',
    'application.approve',
    'application.reject',
  ],
  [Role.OPERATIONS]: [
    ...READ_ONLY,
    'provider.view',
    'customer.manage',
    'application.create',
    'application.review',
    'agreement.generate',
    'esign.initiate',
    'enach.initiate',
    'disbursement.initiate',
  ],
  [Role.COLLECTIONS]: [...READ_ONLY, 'repayment.update', 'payment.collect'],
  [Role.VIEWER]: READ_ONLY,
};

// Roles an NBFC admin may hand out. SUPER_ADMIN accounts are only created by the tenant bootstrap script.
export const ASSIGNABLE_STAFF_ROLES = [Role.ADMIN, Role.CREDIT_OFFICER, Role.OPERATIONS, Role.COLLECTIONS, Role.VIEWER] as const;
export type AssignableStaffRole = (typeof ASSIGNABLE_STAFF_ROLES)[number];

type PermissionSubject = { role: Role; permissions?: string[] | null };

export function effectivePermissions(user: PermissionSubject): string[] {
  return [...new Set([...(ROLE_PERMISSIONS[user.role] ?? []), ...(user.permissions ?? [])])];
}

export function hasPermissions(user: PermissionSubject, required: string[]): boolean {
  const granted = new Set(effectivePermissions(user));
  return required.every((permission) => granted.has(permission));
}

export function assertPermission(user: PermissionSubject, permission: PermissionCode) {
  if (!hasPermissions(user, [permission])) {
    throw new ForbiddenException('You do not have permission to perform this action');
  }
}

export function isSuperAdmin(user: { role: Role }) {
  return user.role === Role.SUPER_ADMIN;
}
