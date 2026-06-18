import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { RequestUser } from '../common/types/request-user.interface';
import { Role } from '../database/entities';

type OrganizationScopedUser = Pick<RequestUser, 'organizationId' | 'role'>;

export function organizationScope(user: OrganizationScopedUser): string | null {
  if (user.organizationId) {
    return user.organizationId;
  }
  if (user.role === Role.ADMIN) {
    return null;
  }
  throw new ForbiddenException('User is not associated with an organization');
}

export function organizationScopedWhere<T extends Record<string, unknown>>(user: OrganizationScopedUser, where?: T): T | (T & { organizationId: string }) {
  const scope = organizationScope(user);
  return scope ? ({ ...(where ?? ({} as T)), organizationId: scope } as T & { organizationId: string }) : (where ?? ({} as T));
}

export function resolveOrganizationForCreate(
  user: OrganizationScopedUser,
  requestedOrganizationId: string | null | undefined,
  resourceName: string,
) {
  const scope = organizationScope(user);
  if (scope) {
    if (requestedOrganizationId && requestedOrganizationId !== scope) {
      throw new ForbiddenException(`You cannot create ${resourceName} for another organization`);
    }
    return scope;
  }
  if (!requestedOrganizationId) {
    throw new BadRequestException(`organizationId is required to create ${resourceName}`);
  }
  return requestedOrganizationId;
}

export function assertOrganizationAccess(
  user: OrganizationScopedUser,
  organizationId: string | null | undefined,
  resourceName = 'record',
) {
  const scope = organizationScope(user);
  if (!scope) {
    return;
  }
  if (!organizationId || organizationId !== scope) {
    throw new ForbiddenException(`You cannot access ${resourceName} from another organization`);
  }
}
