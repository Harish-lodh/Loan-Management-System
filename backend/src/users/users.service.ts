import { BadRequestException, ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AssignableStaffRole } from '../common/auth/role-permissions';
import { NotificationType, Role, User } from '../database/entities';
import { NotificationsService } from '../notifications/notifications.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

export type SafeUser = Omit<User, 'password' | 'refreshTokenHash'>;

interface CreateStaffUserInput {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: AssignableStaffRole;
  organizationId?: string | null;
}

interface UpdateStaffUserInput {
  name?: string;
  phone?: string;
  role?: AssignableStaffRole;
  isActive?: boolean;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly config: ConfigService,
    private readonly notificationsService: NotificationsService,
    private readonly auditLogService: AuditLogService,
  ) {}

  sanitize(user: User): SafeUser {
    const { password: _password, refreshTokenHash: _refreshTokenHash, ...safeUser } = user;
    return safeUser;
  }

  async createStaffUser(data: CreateStaffUserInput): Promise<SafeUser> {
    const existing = await this.findByEmail(data.email);
    if (existing) {
      throw new ConflictException('Email is already registered');
    }
    const saltRounds = Number(this.config.get<string>('BCRYPT_SALT_ROUNDS') ?? 12);
    const password = await bcrypt.hash(data.password, saltRounds);
    const user = await this.usersRepository.save(
      this.usersRepository.create({
        name: data.name,
        email: data.email,
        phone: data.phone,
        password,
        role: data.role,
        organizationId: data.organizationId ?? null,
      }),
    );
    return this.sanitize(user);
  }

  // Callers must already have checked organization scope and SUPER_ADMIN protection (see AdminService).
  async updateStaffUser(user: User, dto: UpdateStaffUserInput): Promise<SafeUser> {
    Object.assign(user, dto);
    if (dto.isActive === false) {
      // End the session immediately instead of letting the refresh token live for days.
      user.refreshTokenHash = null;
      user.refreshTokenExpiresAt = null;
    }
    const saved = await this.usersRepository.save(user);
    return this.sanitize(saved);
  }

  findByEmail(email: string) {
    return this.usersRepository.findOne({ where: { email: email.toLowerCase() } });
  }

  findById(id: string) {
    return this.usersRepository.findOne({ where: { id } });
  }

  findByIdWithRefreshToken(id: string) {
    return this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.refreshTokenHash')
      .where('user.id = :id', { id })
      .getOne();
  }

  async findSafeById(id: string): Promise<SafeUser> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.sanitize(user);
  }

  async setRefreshToken(userId: string, refreshTokenHash: string, expiresAt: Date) {
    await this.usersRepository.update(userId, {
      refreshTokenHash,
      refreshTokenExpiresAt: expiresAt,
      lastLoginAt: new Date(),
    });
  }

  async clearRefreshToken(userId: string) {
    await this.usersRepository.update(userId, {
      refreshTokenHash: null,
      refreshTokenExpiresAt: null,
    });
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!Object.keys(dto).length) {
      throw new BadRequestException('Provide at least one profile field to update');
    }

    Object.assign(user, {
      ...dto,
      address: dto.address === '' ? null : dto.address,
      occupation: dto.occupation === '' ? null : dto.occupation,
    });
    const saved = await this.usersRepository.save(user);

    await this.notificationsService.create({
      userId,
      title: 'Profile updated',
      message: 'Your profile information was updated successfully.',
      type: NotificationType.PROFILE_UPDATED,
      priority: 'LOW',
      actionUrl: '/profile',
    });
    await this.auditLogService.create({
      action: 'PROFILE_UPDATED',
      entityType: 'User',
      entityId: userId,
      actorUserId: userId,
      metadata: { fields: Object.keys(dto) },
    });

    return this.sanitize(saved);
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.findByIdWithRefreshToken(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const passwordMatches = await bcrypt.compare(dto.currentPassword, user.password);
    if (!passwordMatches) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const saltRounds = Number(this.config.get<string>('BCRYPT_SALT_ROUNDS') ?? 12);
    user.password = await bcrypt.hash(dto.newPassword, saltRounds);
    user.refreshTokenHash = null;
    user.refreshTokenExpiresAt = null;
    await this.usersRepository.save(user);

    await this.notificationsService.create({
      userId,
      title: 'Password changed',
      message: 'Your password was changed. Other sessions have been signed out.',
      type: NotificationType.PASSWORD_CHANGED,
      priority: 'HIGH',
      actionUrl: '/profile',
    });
    await this.auditLogService.create({
      action: 'PASSWORD_CHANGED',
      entityType: 'User',
      entityId: userId,
      actorUserId: userId,
      metadata: { rotatedRefreshToken: true },
    });

    return { message: 'Password updated successfully' };
  }
}
