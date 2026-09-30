import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { paginationMeta } from '../common/dto/pagination-query.dto';
import { organizationScope } from '../common/tenancy/organization-scope';
import { RequestUser } from '../common/types/request-user.interface';
import { AuditLog, Role } from '../database/entities';
import { verifyAuditChainRecords } from './audit-chain.util';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';
import { calculateAuditHash } from './audit-hash.util';

type CreateAuditLogInput = {
  action: string;
  entityType: string;
  entityId: string;
  actorUserId?: string | null;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogsRepository: Repository<AuditLog>,
  ) {}

  // Each entry hashes the previous one, so two concurrent writers reading the same "latest" row would fork
  // the chain and make verification report tampering. Writes are serialized; this relies on one backend
  // process per tenant database (PM2 fork mode, as in deploy/), not cluster mode.
  private writeQueue: Promise<unknown> = Promise.resolve();

  create(input: CreateAuditLogInput) {
    const write = this.writeQueue.then(() => this.append(input));
    this.writeQueue = write.catch(() => undefined);
    return write;
  }

  private async append(input: CreateAuditLogInput) {
    const latest = await this.auditLogsRepository.findOne({
      where: {},
      order: { sequence: 'DESC' },
      select: { currentHash: true },
    });
    const timestamp = new Date();
    const metadata = input.metadata ?? {};
    const previousHash = latest?.currentHash ?? null;
    const currentHash = calculateAuditHash({
      ...input,
      timestamp,
      metadata,
      previousHash,
    });

    return this.auditLogsRepository.save(
      this.auditLogsRepository.create({
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        actorUserId: input.actorUserId ?? null,
        timestamp,
        metadata,
        previousHash,
        currentHash,
      }),
    );
  }

  async findAll(user: RequestUser, query: AuditLogQueryDto = new AuditLogQueryDto()) {
    const organizationId = organizationScope(user);
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const builder = this.auditLogsRepository
      .createQueryBuilder('auditLog')
      .leftJoinAndSelect('auditLog.actor', 'actor');

    if (organizationId) {
      // Include the vendor's (SUPER_ADMIN) actions so the NBFC can see every support access, plus system
      // events tagged with this organization.
      builder.andWhere(
        "(actor.organizationId = :organizationId OR actor.role = :superAdmin OR JSON_UNQUOTE(JSON_EXTRACT(auditLog.metadata, '$.organizationId')) = :organizationId)",
        { organizationId, superAdmin: Role.SUPER_ADMIN },
      );
    }

    if (query.action) {
      builder.andWhere('auditLog.action = :action', { action: query.action });
    }

    if (query.entityType) {
      builder.andWhere('auditLog.entityType = :entityType', { entityType: query.entityType });
    }

    if (query.search) {
      builder.andWhere(
        '(auditLog.action LIKE :search OR auditLog.entityType LIKE :search OR auditLog.entityId LIKE :search OR actor.email LIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    const [logs, total] = await builder
      .orderBy('auditLog.sequence', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const items = logs.map((log) => {
      if (!log.actor) {
        return log;
      }
      const { password: _password, ...actor } = log.actor;
      return { ...log, actor };
    });

    return { items, meta: paginationMeta(total, page, limit) };
  }

  async verifyChain() {
    const logs = await this.auditLogsRepository.find({ order: { sequence: 'ASC' } });
    return verifyAuditChainRecords(logs);
  }
}
