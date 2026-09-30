import { MigrationInterface, QueryRunner } from 'typeorm';

const CLASSIFICATIONS = "'STANDARD','SMA_0','SMA_1','SMA_2','NPA_SUBSTANDARD','NPA_DOUBTFUL','NPA_LOSS'";

// DPD / asset classification on loans, late fee and bounce charges on repayments,
// and the disbursement initiator (for maker-checker on confirmation).
export class CreditRiskAndCharges1758600000000 implements MigrationInterface {
  name = 'CreditRiskAndCharges1758600000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE loans
        ADD dpd int NOT NULL DEFAULT 0,
        ADD assetClassification enum(${CLASSIFICATIONS}) NOT NULL DEFAULT 'STANDARD',
        ADD npaDate date NULL,
        ADD classificationUpdatedAt datetime NULL,
        ADD INDEX IDX_loans_asset_classification (assetClassification)
    `);
    await queryRunner.query(`
      ALTER TABLE repayments
        ADD lateFeeAmount decimal(18,2) NOT NULL DEFAULT 0,
        ADD bounceChargeAmount decimal(18,2) NOT NULL DEFAULT 0,
        ADD bounceCount int NOT NULL DEFAULT 0,
        ADD lateFeeAppliedAt datetime NULL
    `);
    await queryRunner.query(`ALTER TABLE disbursements ADD initiatedBy varchar(36) NULL`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE disbursements DROP COLUMN initiatedBy`);
    await queryRunner.query(`
      ALTER TABLE repayments
        DROP COLUMN lateFeeAppliedAt,
        DROP COLUMN bounceCount,
        DROP COLUMN bounceChargeAmount,
        DROP COLUMN lateFeeAmount
    `);
    await queryRunner.query(`
      ALTER TABLE loans
        DROP INDEX IDX_loans_asset_classification,
        DROP COLUMN classificationUpdatedAt,
        DROP COLUMN npaDate,
        DROP COLUMN assetClassification,
        DROP COLUMN dpd
    `);
  }
}
