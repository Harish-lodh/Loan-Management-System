import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProviderCredentialStorage1758300000000 implements MigrationInterface {
  name = 'ProviderCredentialStorage1758300000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE service_providers
        ADD secretsEncrypted text NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE service_providers
        DROP COLUMN secretsEncrypted
    `);
  }
}
