import { MigrationInterface, QueryRunner } from 'typeorm';

export class InternalAccessModel1758200000000 implements MigrationInterface {
  name = 'InternalAccessModel1758200000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
        MODIFY role enum('USER','ADMIN','CUSTOMER') NOT NULL DEFAULT 'USER',
        ADD isActive tinyint NOT NULL DEFAULT 1
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
        DROP COLUMN isActive,
        MODIFY role enum('USER','ADMIN') NOT NULL DEFAULT 'USER'
    `);
  }
}
