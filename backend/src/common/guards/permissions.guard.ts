import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Permission, RolePermission, UserRole } from '../../database/entities';
import { hasPermissions } from '../auth/role-permissions';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { RequestUser } from '../types/request-user.interface';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(UserRole)
    private readonly userRolesRepository: Repository<UserRole>,
    @InjectRepository(RolePermission)
    private readonly rolePermissionsRepository: Repository<RolePermission>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredPermissions?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as RequestUser | undefined;
    if (!user) {
      throw new UnauthorizedException('Authentication is required');
    }

    // Built-in role permissions plus any per-user grants.
    if (hasPermissions(user, requiredPermissions)) {
      return true;
    }

    // Optional custom roles configured in the database (user_roles -> role_permissions).
    const userRoles = await this.userRolesRepository.find({ where: { userId: user.id } });
    if (!userRoles.length) {
      throw new ForbiddenException('You do not have permission to access this resource');
    }
    const rolePermissions = await this.rolePermissionsRepository
      .createQueryBuilder('rolePermission')
      .leftJoinAndMapOne('rolePermission.permission', Permission, 'permission', 'permission.id = rolePermission.permissionId')
      .where('rolePermission.roleName IN (:...roleNames)', { roleNames: userRoles.map((role) => role.roleName) })
      .getMany();
    const allowed = new Set([
      ...rolePermissions.map((rolePermission) => rolePermission.permission?.code).filter(Boolean),
      ...(user.permissions ?? []),
    ]);
    if (!requiredPermissions.every((permission) => allowed.has(permission) || hasPermissions(user, [permission]))) {
      throw new ForbiddenException('You do not have permission to access this resource');
    }

    return true;
  }
}
