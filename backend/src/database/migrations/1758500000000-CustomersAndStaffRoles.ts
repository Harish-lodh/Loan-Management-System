import { MigrationInterface, QueryRunner } from 'typeorm';

const FINAL_ROLES = "'SUPER_ADMIN','ADMIN','CREDIT_OFFICER','OPERATIONS','COLLECTIONS','VIEWER'";
const TRANSITION_ROLES = `'USER','CUSTOMER',${FINAL_ROLES}`;

// Tables whose borrower reference moves from users(id) to customers(id).
const CUSTOMER_FOREIGN_KEYS: Array<{ table: string; column: string; oldConstraint: string; newConstraint: string }> = [
  { table: 'loan_applications', column: 'customerId', oldConstraint: 'FK_loan_applications_userId', newConstraint: 'FK_loan_applications_customer' },
  { table: 'loans', column: 'customerId', oldConstraint: 'FK_loans_userId', newConstraint: 'FK_loans_customer' },
  { table: 'repayments', column: 'customerId', oldConstraint: 'FK_repayments_userId', newConstraint: 'FK_repayments_customer' },
  { table: 'customer_consents', column: 'customerId', oldConstraint: 'FK_consents_customer', newConstraint: 'FK_consents_customer' },
  { table: 'enach_mandates', column: 'customerId', oldConstraint: 'FK_enach_customer', newConstraint: 'FK_enach_customer' },
  { table: 'esign_requests', column: 'customerId', oldConstraint: 'FK_esign_customer', newConstraint: 'FK_esign_customer' },
  { table: 'disbursements', column: 'customerId', oldConstraint: 'FK_disbursement_customer', newConstraint: 'FK_disbursement_customer' },
  {
    table: 'payment_collection_requests',
    column: 'customerId',
    oldConstraint: 'FK_payment_collection_customer',
    newConstraint: 'FK_payment_collection_customer',
  },
];

const RENAMED_COLUMNS = [
  { table: 'loan_applications', oldIndex: 'IDX_loan_applications_userId', newIndex: 'IDX_loan_applications_customerId' },
  { table: 'loans', oldIndex: 'IDX_loans_userId', newIndex: 'IDX_loans_customerId' },
  { table: 'repayments', oldIndex: 'IDX_repayments_userId', newIndex: 'IDX_repayments_customerId' },
];

export class CustomersAndStaffRoles1758500000000 implements MigrationInterface {
  name = 'CustomersAndStaffRoles1758500000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE customers (
        id varchar(36) NOT NULL,
        organizationId varchar(36) NULL,
        customerNumber varchar(40) NOT NULL,
        fullName varchar(120) NOT NULL,
        email varchar(160) NULL,
        phone varchar(24) NOT NULL,
        dateOfBirth date NULL,
        gender varchar(20) NULL,
        panMasked varchar(12) NULL,
        panHash char(64) NULL,
        panEncrypted text NULL,
        addressLine varchar(255) NULL,
        city varchar(80) NULL,
        state varchar(80) NULL,
        pincode varchar(10) NULL,
        occupation varchar(80) NULL,
        employmentType enum('SALARIED','SELF_EMPLOYED','BUSINESS_OWNER','CONTRACT','UNEMPLOYED') NULL,
        monthlyIncome decimal(18,2) NULL,
        status enum('ACTIVE','INACTIVE','BLOCKED') NOT NULL DEFAULT 'ACTIVE',
        createdById varchar(36) NULL,
        createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE INDEX IDX_customers_number (customerNumber),
        UNIQUE INDEX IDX_customers_org_pan (organizationId, panHash),
        INDEX IDX_customers_org (organizationId),
        INDEX IDX_customers_phone (phone),
        INDEX IDX_customers_status (status),
        PRIMARY KEY (id),
        CONSTRAINT FK_customers_organization FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE RESTRICT
      ) ENGINE=InnoDB
    `);

    // Every user that is a borrower (explicit CUSTOMER role, or referenced by any lending record) becomes a
    // customer with the same id, so existing foreign key values stay valid.
    await queryRunner.query(`
      CREATE TEMPORARY TABLE borrower_ids (id varchar(36) NOT NULL PRIMARY KEY)
    `);
    await queryRunner.query(`
      INSERT IGNORE INTO borrower_ids (id)
        SELECT id FROM users WHERE role = 'CUSTOMER'
        UNION SELECT userId FROM loan_applications
        UNION SELECT userId FROM loans
        UNION SELECT userId FROM repayments
        UNION SELECT customerId FROM customer_consents
        UNION SELECT customerId FROM enach_mandates
        UNION SELECT customerId FROM esign_requests
        UNION SELECT customerId FROM disbursements
        UNION SELECT customerId FROM payment_collection_requests
    `);
    await queryRunner.query(`
      INSERT INTO customers (id, organizationId, customerNumber, fullName, email, phone, addressLine, occupation, monthlyIncome, createdAt, updatedAt)
      SELECT
        u.id,
        COALESCE(u.organizationId, (SELECT la.organizationId FROM loan_applications la WHERE la.userId = u.id AND la.organizationId IS NOT NULL LIMIT 1)),
        CONCAT('CUS', UPPER(LEFT(REPLACE(u.id, '-', ''), 12))),
        u.name,
        u.email,
        u.phone,
        u.address,
        u.occupation,
        CASE WHEN u.annualIncome IS NULL THEN NULL ELSE ROUND(u.annualIncome / 12, 2) END,
        u.createdAt,
        u.updatedAt
      FROM users u
      INNER JOIN borrower_ids b ON b.id = u.id
    `);

    for (const fk of CUSTOMER_FOREIGN_KEYS) {
      await queryRunner.query(`ALTER TABLE ${fk.table} DROP FOREIGN KEY ${fk.oldConstraint}`);
    }
    for (const rename of RENAMED_COLUMNS) {
      await queryRunner.query(`
        ALTER TABLE ${rename.table}
          RENAME COLUMN userId TO customerId,
          RENAME INDEX ${rename.oldIndex} TO ${rename.newIndex}
      `);
    }
    // Lending records must never disappear because a customer row is deleted.
    for (const fk of CUSTOMER_FOREIGN_KEYS) {
      await queryRunner.query(`
        ALTER TABLE ${fk.table}
          ADD CONSTRAINT ${fk.newConstraint} FOREIGN KEY (${fk.column}) REFERENCES customers(id) ON DELETE RESTRICT
      `);
    }

    // Audit rows are immutable and hash-chained over actorUserId, so they must not be touched by user deletes.
    await queryRunner.query(`ALTER TABLE audit_logs DROP FOREIGN KEY FK_audit_logs_actorUserId`);

    await queryRunner.query(`DELETE FROM notifications WHERE userId IN (SELECT id FROM borrower_ids)`);
    await queryRunner.query(`DELETE FROM user_roles WHERE userId IN (SELECT id FROM borrower_ids)`);
    await queryRunner.query(`DELETE FROM users WHERE id IN (SELECT id FROM borrower_ids)`);
    await queryRunner.query(`DROP TEMPORARY TABLE borrower_ids`);

    await queryRunner.query(`ALTER TABLE users MODIFY role enum(${TRANSITION_ROLES}) NOT NULL DEFAULT 'VIEWER'`);
    await queryRunner.query(`UPDATE users SET role = 'SUPER_ADMIN' WHERE role = 'ADMIN' AND organizationId IS NULL`);
    await queryRunner.query(`UPDATE users SET role = 'OPERATIONS' WHERE role IN ('USER','CUSTOMER')`);
    await queryRunner.query(`ALTER TABLE users MODIFY role enum(${FINAL_ROLES}) NOT NULL DEFAULT 'VIEWER', DROP COLUMN annualIncome`);

    await queryRunner.query(`
      ALTER TABLE loan_applications
        ADD createdById varchar(36) NULL,
        ADD INDEX IDX_loan_applications_createdById (createdById),
        MODIFY amount decimal(18,2) NOT NULL,
        MODIFY monthlyIncome decimal(18,2) NOT NULL,
        MODIFY existingMonthlyDebt decimal(18,2) NOT NULL,
        MODIFY annualInterestRate decimal(7,4) NOT NULL DEFAULT 12,
        MODIFY emi decimal(18,2) NOT NULL,
        MODIFY totalPayable decimal(18,2) NOT NULL,
        MODIFY totalInterest decimal(18,2) NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE loans
        MODIFY principal decimal(18,2) NOT NULL,
        MODIFY annualInterestRate decimal(7,4) NOT NULL,
        MODIFY emi decimal(18,2) NOT NULL,
        MODIFY totalPayable decimal(18,2) NOT NULL,
        MODIFY outstandingBalance decimal(18,2) NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE repayments
        MODIFY emiAmount decimal(18,2) NOT NULL,
        MODIFY principalComponent decimal(18,2) NOT NULL,
        MODIFY interestComponent decimal(18,2) NOT NULL,
        MODIFY paidAmount decimal(18,2) NOT NULL DEFAULT 0
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE repayments
        MODIFY emiAmount double NOT NULL,
        MODIFY principalComponent double NOT NULL,
        MODIFY interestComponent double NOT NULL,
        MODIFY paidAmount double NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE loans
        MODIFY principal double NOT NULL,
        MODIFY annualInterestRate double NOT NULL,
        MODIFY emi double NOT NULL,
        MODIFY totalPayable double NOT NULL,
        MODIFY outstandingBalance double NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE loan_applications
        DROP INDEX IDX_loan_applications_createdById,
        DROP COLUMN createdById,
        MODIFY amount double NOT NULL,
        MODIFY monthlyIncome double NOT NULL,
        MODIFY existingMonthlyDebt double NOT NULL,
        MODIFY annualInterestRate double NOT NULL DEFAULT 12,
        MODIFY emi double NOT NULL,
        MODIFY totalPayable double NOT NULL,
        MODIFY totalInterest double NOT NULL
    `);

    await queryRunner.query(`ALTER TABLE users MODIFY role enum(${TRANSITION_ROLES}) NOT NULL DEFAULT 'USER', ADD annualIncome double NULL`);
    await queryRunner.query(`UPDATE users SET role = 'ADMIN' WHERE role = 'SUPER_ADMIN'`);
    await queryRunner.query(`UPDATE users SET role = 'USER' WHERE role IN ('CREDIT_OFFICER','OPERATIONS','COLLECTIONS','VIEWER')`);

    // Customers go back into users as non-login CUSTOMER accounts ('!' is not a valid bcrypt hash).
    await queryRunner.query(`
      INSERT INTO users (id, name, email, phone, password, address, occupation, annualIncome, organizationId, role, isActive, createdAt, updatedAt)
      SELECT id, LEFT(fullName, 80), COALESCE(email, CONCAT(id, '@customer.invalid')), phone, '!', addressLine, occupation,
             CASE WHEN monthlyIncome IS NULL THEN NULL ELSE monthlyIncome * 12 END, organizationId, 'CUSTOMER', 1, createdAt, updatedAt
      FROM customers
    `);
    await queryRunner.query(`ALTER TABLE users MODIFY role enum('USER','ADMIN','CUSTOMER') NOT NULL DEFAULT 'USER'`);

    await queryRunner.query(`
      ALTER TABLE audit_logs
        ADD CONSTRAINT FK_audit_logs_actorUserId FOREIGN KEY (actorUserId) REFERENCES users(id) ON DELETE SET NULL
    `);

    for (const fk of CUSTOMER_FOREIGN_KEYS) {
      await queryRunner.query(`ALTER TABLE ${fk.table} DROP FOREIGN KEY ${fk.newConstraint}`);
    }
    for (const rename of RENAMED_COLUMNS) {
      await queryRunner.query(`
        ALTER TABLE ${rename.table}
          RENAME COLUMN customerId TO userId,
          RENAME INDEX ${rename.newIndex} TO ${rename.oldIndex}
      `);
    }
    for (const fk of CUSTOMER_FOREIGN_KEYS) {
      const column = RENAMED_COLUMNS.some((rename) => rename.table === fk.table) ? 'userId' : fk.column;
      await queryRunner.query(`
        ALTER TABLE ${fk.table}
          ADD CONSTRAINT ${fk.oldConstraint} FOREIGN KEY (${column}) REFERENCES users(id) ON DELETE CASCADE
      `);
    }

    await queryRunner.query(`DROP TABLE customers`);
  }
}
