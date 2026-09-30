import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuditLogService } from '../audit-log/audit-log.service';
import { effectivePermissions } from '../common/auth/role-permissions';
import { Role } from '../database/entities/enums';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

interface RefreshPayload {
  sub: string;
  email: string;
  role: Role;
  tokenType: 'refresh';
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const safeUser = this.usersService.sanitize(user);
    await this.auditLogService.create({
      action: 'USER_LOGIN',
      entityType: 'User',
      entityId: user.id,
      actorUserId: user.id,
      metadata: { email: user.email },
    });

    return this.issueSession(safeUser);
  }

  async refresh(dto: RefreshTokenDto) {
    let payload: RefreshPayload;
    try {
      payload = await this.jwtService.verifyAsync<RefreshPayload>(dto.refreshToken, {
        secret: this.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (payload.tokenType !== 'refresh') {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.usersService.findByIdWithRefreshToken(payload.sub);
    if (!user?.refreshTokenHash || !user.refreshTokenExpiresAt || !user.isActive) {
      throw new UnauthorizedException('Refresh token is no longer active');
    }

    if (user.refreshTokenExpiresAt.getTime() <= Date.now()) {
      await this.usersService.clearRefreshToken(user.id);
      throw new UnauthorizedException('Refresh token expired');
    }

    const matches = await bcrypt.compare(dto.refreshToken, user.refreshTokenHash);
    if (!matches) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return this.issueSession(this.usersService.sanitize(user));
  }

  async logout(userId: string) {
    await this.usersService.clearRefreshToken(userId);
    await this.auditLogService.create({
      action: 'USER_LOGOUT',
      entityType: 'User',
      entityId: userId,
      actorUserId: userId,
      metadata: {},
    });
    return { message: 'Logged out successfully' };
  }

  private async issueSession(user: { id: string; email: string; role: Role; name: string; phone: string; permissions?: string[] | null }) {
    const accessToken = this.signAccessToken(user.id, user.email, user.role);
    const refreshToken = this.signRefreshToken(user.id, user.email, user.role);
    const refreshTokenHash = await bcrypt.hash(refreshToken, Number(this.config.get<string>('BCRYPT_SALT_ROUNDS') ?? 12));
    await this.usersService.setRefreshToken(user.id, refreshTokenHash, this.refreshExpiryDate());

    return {
      user: { ...user, effectivePermissions: effectivePermissions(user) },
      accessToken,
      refreshToken,
    };
  }

  private signAccessToken(userId: string, email: string, role: Role): string {
    return this.jwtService.sign({ sub: userId, email, role, tokenType: 'access' });
  }

  private signRefreshToken(userId: string, email: string, role: Role): string {
    return this.jwtService.sign(
      { sub: userId, email, role, tokenType: 'refresh' },
      {
        secret: this.refreshSecret,
        expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d',
      },
    );
  }

  private refreshExpiryDate(): Date {
    const value = this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d';
    return new Date(Date.now() + parseDurationMs(value, 7 * 24 * 60 * 60 * 1000));
  }

  private get refreshSecret(): string {
    return this.config.get<string>('JWT_REFRESH_SECRET') ?? this.config.getOrThrow<string>('JWT_SECRET');
  }
}

function parseDurationMs(value: string, fallback: number): number {
  const match = /^(\d+)(ms|s|m|h|d)?$/.exec(value.trim());
  if (!match) {
    return fallback;
  }

  const amount = Number(match[1]);
  const unit = match[2] ?? 'ms';
  const multipliers: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return amount * multipliers[unit];
}
