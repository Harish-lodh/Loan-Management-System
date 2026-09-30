import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { calculateAuditHash } from '../../audit-log/audit-hash.util';
import { ALL_PERMISSIONS } from '../../common/auth/role-permissions';
import { AuditLog, MasterStatus, Organization, Permission, ProviderType, Role, ServiceProvider, User } from '../entities';

// Idempotent building blocks shared by `tenant:init` (production onboarding) and `db:seed` (demo data).

export async function createAuditLog(
  dataSource: DataSource,
  input: { action: string; entityType: string; entityId: string; actorUserId?: string | null; metadata?: Record<string, unknown> },
) {
  const auditRepository = dataSource.getRepository(AuditLog);
  const latest = await auditRepository.createQueryBuilder('auditLog').orderBy('auditLog.sequence', 'DESC').getOne();
  const timestamp = new Date();
  const metadata = input.metadata ?? {};
  const previousHash = latest?.currentHash ?? null;
  const currentHash = calculateAuditHash({ ...input, timestamp, metadata, previousHash });
  await auditRepository.save(auditRepository.create({ ...input, timestamp, metadata, previousHash, currentHash }));
}

export type OrganizationInput = Pick<Organization, 'organizationCode' | 'name' | 'legalName'> &
  Partial<
    Pick<
      Organization,
      'cin' | 'rbiRegistrationNumber' | 'pan' | 'gstin' | 'registeredAddress' | 'supportDetails' | 'logoUrl' | 'authorizedSignatory' | 'bankConfiguration'
    >
  >;

export async function upsertOrganization(dataSource: DataSource, input: OrganizationInput) {
  const repository = dataSource.getRepository(Organization);
  const existing = await repository.findOne({ where: { organizationCode: input.organizationCode } });
  const payload = { defaultCurrency: 'INR', timeZone: 'Asia/Kolkata', status: MasterStatus.ACTIVE, ...input };
  if (existing) {
    Object.assign(existing, payload);
    return repository.save(existing);
  }
  return repository.save(repository.create(payload));
}

export interface StaffUserInput {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: Role;
  organizationId: string | null;
  occupation?: string;
}

// Creates the account if missing. Existing passwords are only replaced when resetPassword is set,
// so re-running onboarding never locks anyone out.
export async function ensureStaffUser(dataSource: DataSource, input: StaffUserInput, options: { resetPassword?: boolean } = {}) {
  const repository = dataSource.getRepository(User);
  const email = input.email.trim().toLowerCase();
  const existing = await repository.findOne({ where: { email } });
  const hashPassword = () => bcrypt.hash(input.password, Number(process.env.BCRYPT_SALT_ROUNDS ?? 12));

  if (existing) {
    existing.name = input.name;
    existing.phone = input.phone;
    existing.role = input.role;
    existing.organizationId = input.organizationId;
    existing.occupation = input.occupation ?? existing.occupation;
    existing.isActive = true;
    if (options.resetPassword) {
      existing.password = await hashPassword();
    }
    return { user: await repository.save(existing), created: false };
  }

  const user = await repository.save(
    repository.create({
      name: input.name,
      email,
      phone: input.phone,
      password: await hashPassword(),
      role: input.role,
      organizationId: input.organizationId,
      occupation: input.occupation ?? null,
      isActive: true,
    }),
  );
  await createAuditLog(dataSource, {
    action: 'STAFF_USER_CREATED',
    entityType: 'User',
    entityId: user.id,
    actorUserId: null,
    metadata: { email: user.email, role: user.role, organizationId: user.organizationId ?? null, source: 'bootstrap' },
  });
  return { user, created: true };
}

// Stores the permission catalogue so custom database roles (user_roles/role_permissions) can reference it.
export async function seedPermissionCatalogue(dataSource: DataSource) {
  const repository = dataSource.getRepository(Permission);
  for (const code of ALL_PERMISSIONS) {
    const existing = await repository.findOne({ where: { code } });
    if (!existing) {
      await repository.save(repository.create({ code, description: code.replaceAll('.', ' ') }));
    }
  }
}

export async function upsertProvider(
  dataSource: DataSource,
  organization: Organization,
  providerCode: string,
  providerName: string,
  providerType: ProviderType,
) {
  const repository = dataSource.getRepository(ServiceProvider);
  const existing = await repository.findOne({ where: { organizationId: organization.id, providerCode } });
  if (existing) {
    // Never overwrite a provider the NBFC has already configured.
    return existing;
  }
  return repository.save(
    repository.create({
      organizationId: organization.id,
      providerCode,
      providerName,
      providerType,
      status: MasterStatus.ACTIVE,
      isSandbox: true,
      baseUrl: 'https://mock-provider.local',
      credentialReference: `${providerCode}_CREDENTIAL_REF`,
      webhookSecretReference: `mock-${providerCode}`,
      supportedCapabilities: ['initiate', 'webhook', 'status'],
      configuration: { mock: true },
    }),
  );
}

// The provider rows every instance starts with. Real providers run in mock mode until the NBFC adds keys.
export async function seedDefaultProviders(dataSource: DataSource, organization: Organization) {
  const esign = await upsertProvider(dataSource, organization, 'MOCK_ESIGN', 'Mock eSign Provider', ProviderType.ESIGN);
  const enach = await upsertProvider(dataSource, organization, 'MOCK_ENACH', 'Mock eNACH Provider', ProviderType.ENACH);
  const disbursement = await upsertProvider(dataSource, organization, 'MOCK_DISBURSEMENT', 'Mock Disbursement Provider', ProviderType.DISBURSEMENT);
  await upsertProvider(dataSource, organization, 'EASEBUZZ', 'Easebuzz', ProviderType.PAYMENT_GATEWAY);
  await upsertProvider(dataSource, organization, 'DIGIO', 'Digio', ProviderType.ESIGN);
  await upsertProvider(dataSource, organization, 'DOQUFY', 'Doqufy', ProviderType.ESIGN);
  return { esign, enach, disbursement };
}
