import dataSource from './data-source';
import {
  createAuditLog,
  ensureStaffUser,
  seedDefaultProviders,
  seedPermissionCatalogue,
  upsertOrganization,
} from './bootstrap/tenant-bootstrap';
import { Role } from './entities';

// Onboards one NBFC instance: its organization, the vendor SUPER_ADMIN and the NBFC's first admin.
// Safe to re-run; pass --reset-passwords to overwrite the two bootstrap passwords from the env file.
//
//   ENV_FILE=/etc/lms/tenants/nbfca.env npm --workspace backend run tenant:init

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required (set it in the tenant env file)`);
  }
  return value;
}

function strongPassword(name: string) {
  const value = required(name);
  if (value.length < 10 || !/[A-Za-z]/.test(value) || !/\d/.test(value)) {
    throw new Error(`${name} must be at least 10 characters and contain letters and numbers`);
  }
  return value;
}

async function tenantInit() {
  const resetPassword = process.argv.includes('--reset-passwords');
  const config = {
    organizationCode: required('TENANT_ORG_CODE').toUpperCase(),
    name: required('TENANT_ORG_NAME'),
    legalName: process.env.TENANT_ORG_LEGAL_NAME?.trim() || required('TENANT_ORG_NAME'),
    superAdmin: {
      name: process.env.SUPER_ADMIN_NAME?.trim() || 'Platform Support',
      email: required('SUPER_ADMIN_EMAIL'),
      phone: process.env.SUPER_ADMIN_PHONE?.trim() || '0000000000',
      password: strongPassword('SUPER_ADMIN_PASSWORD'),
    },
    nbfcAdmin: {
      name: required('NBFC_ADMIN_NAME'),
      email: required('NBFC_ADMIN_EMAIL'),
      phone: required('NBFC_ADMIN_PHONE'),
      password: strongPassword('NBFC_ADMIN_PASSWORD'),
    },
  };

  await dataSource.initialize();

  const organization = await upsertOrganization(dataSource, {
    organizationCode: config.organizationCode,
    name: config.name,
    legalName: config.legalName,
    rbiRegistrationNumber: process.env.TENANT_RBI_REGISTRATION?.trim() || null,
    supportDetails: {
      email: process.env.TENANT_SUPPORT_EMAIL?.trim() || config.nbfcAdmin.email,
      phone: process.env.TENANT_SUPPORT_PHONE?.trim() || config.nbfcAdmin.phone,
    },
  });
  await seedPermissionCatalogue(dataSource);
  await seedDefaultProviders(dataSource, organization);

  const superAdmin = await ensureStaffUser(
    dataSource,
    { ...config.superAdmin, role: Role.SUPER_ADMIN, organizationId: null, occupation: 'Platform vendor' },
    { resetPassword },
  );
  const nbfcAdmin = await ensureStaffUser(
    dataSource,
    { ...config.nbfcAdmin, role: Role.ADMIN, organizationId: organization.id, occupation: 'NBFC administrator' },
    { resetPassword },
  );

  await createAuditLog(dataSource, {
    action: 'TENANT_INITIALIZED',
    entityType: 'Organization',
    entityId: organization.id,
    actorUserId: null,
    metadata: { organizationCode: organization.organizationCode, resetPasswords: resetPassword },
  });

  console.log(`Tenant ready: ${organization.name} (${organization.organizationCode})`);
  console.log(`  SUPER_ADMIN ${superAdmin.user.email} ${superAdmin.created ? 'created' : 'already existed'}`);
  console.log(`  ADMIN       ${nbfcAdmin.user.email} ${nbfcAdmin.created ? 'created' : 'already existed'}`);

  await dataSource.destroy();
}

tenantInit().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  if (dataSource.isInitialized) {
    await dataSource.destroy();
  }
  process.exit(1);
});
