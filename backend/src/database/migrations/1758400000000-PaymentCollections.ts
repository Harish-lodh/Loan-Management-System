import { MigrationInterface, QueryRunner } from 'typeorm';

const paymentStatuses = "'INITIATED','LINK_CREATED','PENDING','SUCCESS','FAILED','EXPIRED','CANCELLED'";

export class PaymentCollections1758400000000 implements MigrationInterface {
  name = 'PaymentCollections1758400000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE payment_collection_requests (
        id varchar(36) NOT NULL,
        organizationId varchar(36) NOT NULL,
        loanId varchar(36) NOT NULL,
        repaymentId varchar(36) NULL,
        customerId varchar(36) NOT NULL,
        partnerId varchar(36) NULL,
        providerId varchar(36) NULL,
        providerRequestId varchar(120) NOT NULL,
        amount decimal(18,2) NOT NULL,
        paymentUrl varchar(700) NULL,
        status enum(${paymentStatuses}) NOT NULL DEFAULT 'INITIATED',
        providerStatus varchar(80) NULL,
        expiresAt datetime NULL,
        initiatedAt datetime NULL,
        completedAt datetime NULL,
        bankReference varchar(120) NULL,
        providerRequest json NULL,
        providerResponse json NULL,
        createdBy varchar(36) NULL,
        createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE INDEX IDX_payment_collection_provider_request (providerRequestId),
        INDEX IDX_payment_collection_org (organizationId),
        INDEX IDX_payment_collection_loan (loanId),
        INDEX IDX_payment_collection_repayment (repaymentId),
        INDEX IDX_payment_collection_customer (customerId),
        INDEX IDX_payment_collection_provider (providerId),
        INDEX IDX_payment_collection_status (status),
        PRIMARY KEY (id),
        CONSTRAINT FK_payment_collection_loan FOREIGN KEY (loanId) REFERENCES loans(id) ON DELETE CASCADE,
        CONSTRAINT FK_payment_collection_repayment FOREIGN KEY (repaymentId) REFERENCES repayments(id) ON DELETE SET NULL,
        CONSTRAINT FK_payment_collection_customer FOREIGN KEY (customerId) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT FK_payment_collection_partner FOREIGN KEY (partnerId) REFERENCES partners(id) ON DELETE SET NULL,
        CONSTRAINT FK_payment_collection_provider FOREIGN KEY (providerId) REFERENCES service_providers(id) ON DELETE SET NULL
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE payment_collection_status_history (
        id varchar(36) NOT NULL,
        paymentCollectionRequestId varchar(36) NOT NULL,
        previousStatus enum(${paymentStatuses}) NULL,
        newStatus enum(${paymentStatuses}) NOT NULL,
        actorUserId varchar(36) NULL,
        reason text NULL,
        createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        INDEX IDX_payment_collection_history_request (paymentCollectionRequestId),
        PRIMARY KEY (id),
        CONSTRAINT FK_payment_collection_history_request FOREIGN KEY (paymentCollectionRequestId) REFERENCES payment_collection_requests(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE payment_collection_status_history');
    await queryRunner.query('DROP TABLE payment_collection_requests');
  }
}
