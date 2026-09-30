import 'reflect-metadata';
import { config } from 'dotenv';
import * as path from 'path';
import { DataSource } from 'typeorm';

const backend = 'D:/LMS/backend';
config({ path: path.join(backend, '.env') });
const TEST_DB = 'lms_mig_test';

const base = {
  type: 'mysql' as const,
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
};

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
  console.log(`  ok - ${message}`);
}

async function main() {
  const admin = new DataSource({ ...base });
  await admin.initialize();
  await admin.query(`DROP DATABASE IF EXISTS ${TEST_DB}`);
  await admin.query(`CREATE DATABASE ${TEST_DB}`);
  await admin.destroy();

  const all = new DataSource({ ...base, database: TEST_DB, migrations: [path.join(backend, 'src/database/migrations/*.ts')] });
  await all.initialize();
  const migrations = all.migrations.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
  const last = migrations[migrations.length - 1];
  console.log('migrations:', migrations.map((m) => m.name).join(', '));
  const runner = all.createQueryRunner();

  for (const migration of migrations.slice(0, -1)) {
    await migration.up(runner);
  }
  console.log('Applied all migrations before', last.name);

  // Legacy data as the old code would have written it.
  const q = (sql: string, params: unknown[] = []) => runner.query(sql, params);
  await q(`INSERT INTO organizations (id, organizationCode, name, legalName) VALUES ('org-1','ORG1','Org One','Org One Pvt Ltd')`);
  const user = (id: string, email: string, role: string, org: string | null, extra = '') =>
    q(`INSERT INTO users (id, name, email, phone, password, role, organizationId, annualIncome, address, occupation) VALUES (?,?,?,?,?,?,?,?,?,?)`, [
      id, `Name ${id}`, email, '9000000000', 'hash', role, org, extra ? 600000 : null, extra || null, extra ? 'Job' : null,
    ]);
  await user('vendor', 'vendor@x.test', 'ADMIN', null);
  await user('nbfc-admin', 'admin@x.test', 'ADMIN', 'org-1');
  await user('staff', 'staff@x.test', 'USER', 'org-1');
  await user('cust-explicit', 'c1@x.test', 'CUSTOMER', 'org-1');
  await user('legacy-borrower', 'b1@x.test', 'USER', null, 'Some address');

  await q(`INSERT INTO loan_applications (id, userId, organizationId, amount, tenureMonths, monthlyIncome, employmentType, existingMonthlyDebt, creditScore, purpose, status, riskScore, approvalLikelihood, riskExplanation, annualInterestRate, emi, totalPayable, totalInterest, statusHistory)
           VALUES ('app-1','legacy-borrower','org-1',100000.129,12,50000,'SALARIED',0,750,'Test','APPROVED',70,'High','x',12.5,8884.88,106618.56,6618.56,'[]')`);
  await q(`INSERT INTO loans (id, userId, applicationId, organizationId, principal, annualInterestRate, tenureMonths, emi, totalPayable, outstandingBalance, status, statusHistory)
           VALUES ('loan-1','legacy-borrower','app-1','org-1',100000,12.5,12,8884.88,106618.56,100000,'ACTIVE','[]')`);
  await q(`INSERT INTO repayments (id, loanId, userId, dueDate, emiAmount, principalComponent, interestComponent) VALUES ('rep-1','loan-1','legacy-borrower', NOW(), 8884.88, 7843.21, 1041.67)`);
  await q(`INSERT INTO notifications (id, userId, title, message, type) VALUES ('n-1','legacy-borrower','t','m','LOAN_APPROVED'), ('n-2','nbfc-admin','t','m','LOAN_APPROVED')`);
  await q(`INSERT INTO audit_logs (id, action, entityType, entityId, actorUserId, metadata, previousHash, currentHash) VALUES ('a-1','LOAN_APPLICATION_STARTED','LoanApplication','app-1','legacy-borrower','{}',NULL,'${'f'.repeat(64)}')`);

  console.log('Running', last.name, 'up');
  await last.up(runner);

  const customers = await q(`SELECT id, organizationId, fullName, monthlyIncome, addressLine FROM customers ORDER BY id`);
  assert(customers.length === 2, 'both borrowers moved to customers');
  const legacy = customers.find((c: { id: string }) => c.id === 'legacy-borrower');
  assert(legacy.organizationId === 'org-1', 'legacy borrower without org inherits org from their application');
  assert(Number(legacy.monthlyIncome) === 50000, 'annual income converted to monthly');
  assert(legacy.addressLine === 'Some address', 'address carried over');

  const users = await q(`SELECT id, role FROM users ORDER BY id`);
  const roles = Object.fromEntries(users.map((u: { id: string; role: string }) => [u.id, u.role]));
  assert(!('legacy-borrower' in roles) && !('cust-explicit' in roles), 'borrowers removed from users');
  assert(roles.vendor === 'SUPER_ADMIN', 'org-less ADMIN became SUPER_ADMIN');
  assert(roles['nbfc-admin'] === 'ADMIN', 'org ADMIN stays ADMIN');
  assert(roles.staff === 'OPERATIONS', 'USER staff became OPERATIONS');

  const [app] = await q(`SELECT customerId, amount, annualInterestRate FROM loan_applications WHERE id='app-1'`);
  assert(app.customerId === 'legacy-borrower', 'application points at customer');
  assert(app.amount === '100000.13', 'amount now DECIMAL(18,2)');
  assert(app.annualInterestRate === '12.5000', 'rate now DECIMAL(7,4)');
  const [rep] = await q(`SELECT customerId, emiAmount FROM repayments WHERE id='rep-1'`);
  assert(rep.customerId === 'legacy-borrower' && rep.emiAmount === '8884.88', 'repayment migrated');

  const notifications = await q(`SELECT id FROM notifications`);
  assert(notifications.length === 1 && notifications[0].id === 'n-2', 'borrower notifications removed, staff kept');
  const [audit] = await q(`SELECT actorUserId FROM audit_logs WHERE id='a-1'`);
  assert(audit.actorUserId === 'legacy-borrower', 'audit row untouched (hash input preserved)');

  let restricted = false;
  try {
    await q(`DELETE FROM customers WHERE id='legacy-borrower'`);
  } catch {
    restricted = true;
  }
  assert(restricted, 'customers with loans cannot be deleted (ON DELETE RESTRICT)');

  console.log('Running', last.name, 'down');
  await last.down(runner);
  const [appDown] = await q(`SELECT userId FROM loan_applications WHERE id='app-1'`);
  assert(appDown.userId === 'legacy-borrower', 'down restores userId column');
  const [borrowerDown] = await q(`SELECT role FROM users WHERE id='legacy-borrower'`);
  assert(borrowerDown.role === 'CUSTOMER', 'down restores borrower as CUSTOMER user');

  console.log('Running', last.name, 'up again');
  await last.up(runner);
  const [count] = await q(`SELECT COUNT(*) c FROM customers`);
  assert(Number(count.c) === 2, 're-applied cleanly');

  await runner.release();
  await all.destroy();
  console.log('MIGRATION TEST PASSED');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    const admin = new DataSource({ ...base });
    await admin.initialize();
    await admin.query(`DROP DATABASE IF EXISTS ${TEST_DB}`);
    await admin.destroy();
  });
