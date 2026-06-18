import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProductionEnhancements1715689000000 implements MigrationInterface {
  name = 'ProductionEnhancements1715689000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
        ADD address varchar(180) NULL,
        ADD occupation varchar(80) NULL,
        ADD annualIncome double NULL,
        ADD refreshTokenHash text NULL,
        ADD refreshTokenExpiresAt datetime NULL,
        ADD lastLoginAt datetime NULL
    `);

    await queryRunner.query(`
      ALTER TABLE loan_applications
        MODIFY status enum('DRAFT','SUBMITTED','IN_REVIEW','PENDING','AUTO_REVIEWED','APPROVED','REJECTED') NOT NULL DEFAULT 'DRAFT',
        ADD scoreBreakdown json NULL,
        ADD submittedAt datetime NULL
    `);

    await queryRunner.query(`
      ALTER TABLE repayments
        ADD daysOverdue int NOT NULL DEFAULT 0,
        ADD overdueMarkedAt datetime NULL,
        ADD lastReminderAt datetime NULL
    `);

    await queryRunner.query(`
      ALTER TABLE notifications
        MODIFY type enum('APPLICATION_DRAFTED','APPLICATION_SUBMITTED','APPLICATION_REVIEW_STARTED','LOAN_APPROVED','LOAN_REJECTED','PAYMENT_DUE','PAYMENT_OVERDUE','REPAYMENT_RECEIVED','PROFILE_UPDATED','PASSWORD_CHANGED','STATUS_CHANGE') NOT NULL,
        ADD priority varchar(20) NOT NULL DEFAULT 'NORMAL',
        ADD actionUrl varchar(240) NULL,
        ADD metadata json NULL,
        ADD readAt datetime NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE notifications
        DROP COLUMN readAt,
        DROP COLUMN metadata,
        DROP COLUMN actionUrl,
        DROP COLUMN priority,
        MODIFY type enum('APPLICATION_SUBMITTED','LOAN_APPROVED','LOAN_REJECTED','PAYMENT_DUE','PAYMENT_OVERDUE','REPAYMENT_RECEIVED','STATUS_CHANGE') NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE repayments
        DROP COLUMN lastReminderAt,
        DROP COLUMN overdueMarkedAt,
        DROP COLUMN daysOverdue
    `);

    await queryRunner.query(`
      ALTER TABLE loan_applications
        DROP COLUMN submittedAt,
        DROP COLUMN scoreBreakdown,
        MODIFY status enum('PENDING','AUTO_REVIEWED','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING'
    `);

    await queryRunner.query(`
      ALTER TABLE users
        DROP COLUMN lastLoginAt,
        DROP COLUMN refreshTokenExpiresAt,
        DROP COLUMN refreshTokenHash,
        DROP COLUMN annualIncome,
        DROP COLUMN occupation,
        DROP COLUMN address
    `);
  }
}
