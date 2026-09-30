import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { EntityManager, Repository } from 'typeorm';
import { AuditLogService } from '../audit-log/audit-log.service';
import { hashPii, encryptPii, maskPan, normalizePan } from '../common/crypto/pii.util';
import { paginationMeta } from '../common/dto/pagination-query.dto';
import { organizationScope } from '../common/tenancy/organization-scope';
import { RequestUser } from '../common/types/request-user.interface';
import { Customer, CustomerStatus, Organization } from '../database/entities';
import { CreateCustomerDto, CustomersQueryDto, UpdateCustomerDto } from './dto/customer.dto';

export interface ApplicantIdentity {
  fullName?: string;
  email?: string;
  phone?: string;
}

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private readonly customersRepository: Repository<Customer>,
    @InjectRepository(Organization)
    private readonly organizationsRepository: Repository<Organization>,
    private readonly auditLogService: AuditLogService,
  ) {}

  async list(user: RequestUser, query: CustomersQueryDto) {
    const organizationId = organizationScope(user);
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const builder = this.customersRepository.createQueryBuilder('customer');

    if (organizationId) {
      builder.andWhere('customer.organizationId = :organizationId', { organizationId });
    }
    if (query.status) {
      builder.andWhere('customer.status = :status', { status: query.status });
    }
    if (query.search) {
      builder.andWhere(
        '(customer.fullName LIKE :search OR customer.email LIKE :search OR customer.phone LIKE :search OR customer.customerNumber LIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    const [items, total] = await builder
      .orderBy('customer.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { items, meta: paginationMeta(total, page, limit) };
  }

  async details(user: RequestUser, id: string) {
    const customer = await this.customersRepository.findOne({
      where: this.scopedWhere(user, { id }),
      relations: { loanApplications: true, loans: true, repayments: true },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }
    customer.repayments = [...(customer.repayments ?? [])].sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
    return customer;
  }

  async create(user: RequestUser, dto: CreateCustomerDto) {
    const organizationId = await this.resolveOrganization(user, dto.organizationId);
    const pan = dto.pan ? normalizePan(dto.pan) : null;
    const panHash = pan ? hashPii(pan) : null;
    await this.assertNoDuplicate(organizationId, dto.phone, panHash);

    const customer = await this.customersRepository.save(
      this.customersRepository.create({
        ...this.profileFields(dto),
        organizationId,
        customerNumber: this.customerNumber(),
        fullName: dto.fullName,
        phone: dto.phone,
        panMasked: pan ? maskPan(pan) : null,
        panHash,
        panEncrypted: pan ? encryptPii(pan) : null,
        status: CustomerStatus.ACTIVE,
        createdById: user.id,
      }),
    );

    await this.auditLogService.create({
      action: 'CUSTOMER_CREATED',
      entityType: 'Customer',
      entityId: customer.id,
      actorUserId: user.id,
      metadata: { organizationId, customerNumber: customer.customerNumber },
    });

    return this.stripSecrets(customer);
  }

  async update(user: RequestUser, id: string, dto: UpdateCustomerDto) {
    const customer = await this.customersRepository.findOne({ where: this.scopedWhere(user, { id }) });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const pan = dto.pan ? normalizePan(dto.pan) : null;
    const panHash = pan ? hashPii(pan) : undefined;
    if (dto.phone || panHash) {
      await this.assertNoDuplicate(customer.organizationId ?? null, dto.phone ?? null, panHash ?? null, customer.id);
    }

    Object.assign(customer, this.profileFields(dto));
    if (dto.fullName) customer.fullName = dto.fullName;
    if (dto.phone) customer.phone = dto.phone;
    if (dto.status) customer.status = dto.status;
    if (pan) {
      customer.panMasked = maskPan(pan);
      customer.panHash = panHash;
      customer.panEncrypted = encryptPii(pan);
    }
    const saved = await this.customersRepository.save(customer);

    await this.auditLogService.create({
      action: 'CUSTOMER_UPDATED',
      entityType: 'Customer',
      entityId: customer.id,
      actorUserId: user.id,
      // Never log PII values, only which fields changed.
      metadata: { organizationId: customer.organizationId ?? null, fields: Object.keys(dto) },
    });

    return this.stripSecrets(saved);
  }

  async findActiveForOrganization(id: string, organizationId: string) {
    const customer = await this.customersRepository.findOne({ where: { id, organizationId } });
    if (!customer) {
      throw new BadRequestException('customerId does not reference a customer in this organization');
    }
    if (customer.status !== CustomerStatus.ACTIVE) {
      throw new BadRequestException(`Customer is ${customer.status.toLowerCase()} and cannot take new applications`);
    }
    return customer;
  }

  // Used when staff capture a new application without first creating the customer: reuse by phone, else create.
  async findOrCreateFromApplicant(user: RequestUser, identity: ApplicantIdentity, organizationId: string, manager?: EntityManager) {
    const { fullName, email, phone } = identity;
    if (!fullName || !phone) {
      throw new BadRequestException('Provide an existing customerId, or applicant.fullName and applicant.phone to create a new customer');
    }
    const repository = manager ? manager.getRepository(Customer) : this.customersRepository;
    const existing = await repository.findOne({ where: { organizationId, phone } });
    if (existing) {
      if (existing.status !== CustomerStatus.ACTIVE) {
        throw new BadRequestException(`Customer is ${existing.status.toLowerCase()} and cannot take new applications`);
      }
      return existing;
    }
    const customer = await repository.save(
      repository.create({
        organizationId,
        customerNumber: this.customerNumber(),
        fullName,
        email: email ?? null,
        phone,
        status: CustomerStatus.ACTIVE,
        createdById: user.id,
      }),
    );
    await this.auditLogService.create({
      action: 'CUSTOMER_CREATED',
      entityType: 'Customer',
      entityId: customer.id,
      actorUserId: user.id,
      metadata: { organizationId, customerNumber: customer.customerNumber, source: 'loan_application' },
    });
    return customer;
  }

  private async resolveOrganization(user: RequestUser, requested?: string) {
    const scope = organizationScope(user);
    if (scope) {
      return scope;
    }
    if (requested) {
      const exists = await this.organizationsRepository.exists({ where: { id: requested } });
      if (!exists) {
        throw new BadRequestException('organizationId does not exist');
      }
      return requested;
    }
    // Single-NBFC instances have exactly one organization; let the SUPER_ADMIN omit it.
    const organizations = await this.organizationsRepository.find({ select: { id: true }, take: 2 });
    if (organizations.length === 1) {
      return organizations[0].id;
    }
    throw new BadRequestException('organizationId is required');
  }

  private async assertNoDuplicate(organizationId: string | null, phone: string | null, panHash: string | null, excludeId?: string) {
    if (phone) {
      const byPhone = await this.customersRepository.findOne({ where: { organizationId: organizationId ?? undefined, phone } });
      if (byPhone && byPhone.id !== excludeId) {
        throw new ConflictException(`A customer with this phone already exists (${byPhone.customerNumber})`);
      }
    }
    if (panHash) {
      const byPan = await this.customersRepository.findOne({ where: { organizationId: organizationId ?? undefined, panHash } });
      if (byPan && byPan.id !== excludeId) {
        throw new ConflictException(`A customer with this PAN already exists (${byPan.customerNumber})`);
      }
    }
  }

  private profileFields(dto: UpdateCustomerDto) {
    const fields: Partial<Customer> = {};
    const keys = ['email', 'dateOfBirth', 'gender', 'addressLine', 'city', 'state', 'pincode', 'occupation', 'employmentType', 'monthlyIncome'] as const;
    for (const key of keys) {
      if (dto[key] !== undefined) {
        (fields as Record<string, unknown>)[key] = dto[key];
      }
    }
    return fields;
  }

  private scopedWhere(user: RequestUser, where: { id: string }) {
    const organizationId = organizationScope(user);
    return organizationId ? { ...where, organizationId } : where;
  }

  private stripSecrets(customer: Customer) {
    const { panHash: _panHash, panEncrypted: _panEncrypted, ...safe } = customer;
    return safe;
  }

  private customerNumber() {
    return `CUS${Date.now().toString(36).toUpperCase()}${randomBytes(3).toString('hex').toUpperCase()}`;
  }
}
