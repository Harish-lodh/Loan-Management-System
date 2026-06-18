import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitLoanManagement1715688000000 implements MigrationInterface {
  name = 'InitLoanManagement1715688000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE users (
        id varchar(36) NOT NULL,
        name varchar(80) NOT NULL,
        email varchar(160) NOT NULL,
        phone varchar(24) NOT NULL,
        password varchar(120) NOT NULL,
        role enum('USER','ADMIN') NOT NULL DEFAULT 'USER',
        createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE INDEX IDX_users_email (email),
        INDEX IDX_users_role (role),
        PRIMARY KEY (id)
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE loan_applications (
        id varchar(36) NOT NULL,
        userId varchar(36) NOT NULL,
        amount double NOT NULL,
        tenureMonths int NOT NULL,
        monthlyIncome double NOT NULL,
        employmentType enum('SALARIED','SELF_EMPLOYED','BUSINESS_OWNER','CONTRACT','UNEMPLOYED') NOT NULL,
        existingMonthlyDebt double NOT NULL,
        creditScore int NOT NULL,
        purpose varchar(240) NOT NULL,
        status enum('PENDING','AUTO_REVIEWED','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
        riskScore int NOT NULL,
        approvalLikelihood varchar(40) NOT NULL,
        riskExplanation text NOT NULL,
        annualInterestRate double NOT NULL DEFAULT 12,
        emi double NOT NULL,
        totalPayable double NOT NULL,
        totalInterest double NOT NULL,
        adminComment text NULL,
        reviewedAt datetime NULL,
        reviewerId varchar(255) NULL,
        statusHistory json NOT NULL,
        createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        INDEX IDX_loan_applications_userId (userId),
        INDEX IDX_loan_applications_status (status),
        PRIMARY KEY (id),
        CONSTRAINT FK_loan_applications_userId FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE loans (
        id varchar(36) NOT NULL,
        userId varchar(36) NOT NULL,
        applicationId varchar(36) NOT NULL,
        principal double NOT NULL,
        annualInterestRate double NOT NULL,
        tenureMonths int NOT NULL,
        emi double NOT NULL,
        totalPayable double NOT NULL,
        outstandingBalance double NOT NULL,
        status enum('PENDING','AUTO_REVIEWED','APPROVED','REJECTED','DISBURSED','ACTIVE','CLOSED','DEFAULTED') NOT NULL DEFAULT 'APPROVED',
        statusHistory json NOT NULL,
        disbursedAt datetime NULL,
        startDate datetime NULL,
        closedAt datetime NULL,
        createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE INDEX IDX_loans_applicationId (applicationId),
        INDEX IDX_loans_userId (userId),
        INDEX IDX_loans_status (status),
        PRIMARY KEY (id),
        CONSTRAINT FK_loans_userId FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT FK_loans_applicationId FOREIGN KEY (applicationId) REFERENCES loan_applications(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE repayments (
        id varchar(36) NOT NULL,
        loanId varchar(36) NOT NULL,
        userId varchar(36) NOT NULL,
        dueDate datetime NOT NULL,
        emiAmount double NOT NULL,
        principalComponent double NOT NULL,
        interestComponent double NOT NULL,
        paidAmount double NOT NULL DEFAULT 0,
        status enum('PENDING','PAID','OVERDUE') NOT NULL DEFAULT 'PENDING',
        paidAt datetime NULL,
        createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        INDEX IDX_repayments_loanId (loanId),
        INDEX IDX_repayments_userId (userId),
        INDEX IDX_repayments_dueDate (dueDate),
        INDEX IDX_repayments_status (status),
        PRIMARY KEY (id),
        CONSTRAINT FK_repayments_loanId FOREIGN KEY (loanId) REFERENCES loans(id) ON DELETE CASCADE,
        CONSTRAINT FK_repayments_userId FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE notifications (
        id varchar(36) NOT NULL,
        userId varchar(36) NOT NULL,
        title varchar(120) NOT NULL,
        message text NOT NULL,
        type enum('APPLICATION_SUBMITTED','LOAN_APPROVED','LOAN_REJECTED','PAYMENT_DUE','PAYMENT_OVERDUE','REPAYMENT_RECEIVED','STATUS_CHANGE') NOT NULL,
        isRead tinyint NOT NULL DEFAULT 0,
        createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        INDEX IDX_notifications_userId (userId),
        INDEX IDX_notifications_isRead (isRead),
        PRIMARY KEY (id),
        CONSTRAINT FK_notifications_userId FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE audit_logs (
        id varchar(36) NOT NULL,
        sequence int NOT NULL AUTO_INCREMENT,
        action varchar(80) NOT NULL,
        entityType varchar(80) NOT NULL,
        entityId varchar(255) NOT NULL,
        actorUserId varchar(36) NULL,
        timestamp datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        metadata json NOT NULL,
        previousHash varchar(64) NULL,
        currentHash varchar(64) NOT NULL,
        UNIQUE INDEX IDX_audit_logs_sequence (sequence),
        UNIQUE INDEX IDX_audit_logs_currentHash (currentHash),
        INDEX IDX_audit_logs_actorUserId (actorUserId),
        INDEX IDX_audit_logs_entity (entityType, entityId),
        PRIMARY KEY (id),
        CONSTRAINT FK_audit_logs_actorUserId FOREIGN KEY (actorUserId) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE audit_logs');
    await queryRunner.query('DROP TABLE notifications');
    await queryRunner.query('DROP TABLE repayments');
    await queryRunner.query('DROP TABLE loans');
    await queryRunner.query('DROP TABLE loan_applications');
    await queryRunner.query('DROP TABLE users');
  }
}
