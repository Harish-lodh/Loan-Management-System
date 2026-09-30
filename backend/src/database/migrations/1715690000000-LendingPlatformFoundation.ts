import { MigrationInterface, QueryRunner } from 'typeorm';

const applicationStatuses = [
  'DRAFT',
  'SUBMITTED',
  'IN_REVIEW',
  'PENDING',
  'AUTO_REVIEWED',
  'APPROVED',
  'REJECTED',
  'KYC_PENDING',
  'KYC_IN_PROGRESS',
  'KYC_COMPLETED',
  'DOCUMENT_PENDING',
  'DOCUMENT_VERIFICATION',
  'BANK_VERIFICATION_PENDING',
  'UNDER_REVIEW',
  'CREDIT_APPROVED',
  'CREDIT_REJECTED',
  'AGREEMENT_PENDING',
  'AGREEMENT_GENERATED',
  'ESIGN_PENDING',
  'ESIGN_COMPLETED',
  'ENACH_PENDING',
  'ENACH_REGISTERED',
  'ENACH_FAILED',
  'READY_FOR_DISBURSEMENT',
  'DISBURSEMENT_PENDING',
  'DISBURSED',
  'ACTIVE',
  'CLOSED',
  'CANCELLED',
  'WRITTEN_OFF',
].map((status) => `'${status}'`).join(',');

export class LendingPlatformFoundation1715690000000 implements MigrationInterface {
  name = 'LendingPlatformFoundation1715690000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE organizations (
        id varchar(36) NOT NULL,
        organizationCode varchar(40) NOT NULL,
        name varchar(120) NOT NULL,
        legalName varchar(180) NOT NULL,
        cin varchar(40) NULL,
        rbiRegistrationNumber varchar(80) NULL,
        pan varchar(20) NULL,
        gstin varchar(24) NULL,
        registeredAddress text NULL,
        supportDetails json NULL,
        defaultCurrency varchar(3) NOT NULL DEFAULT 'INR',
        timeZone varchar(80) NOT NULL DEFAULT 'Asia/Kolkata',
        status enum('DRAFT','ACTIVE','INACTIVE','PUBLISHED','ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
        logoUrl varchar(500) NULL,
        authorizedSignatory json NULL,
        bankConfiguration json NULL,
        createdBy varchar(36) NULL,
        updatedBy varchar(36) NULL,
        createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE INDEX IDX_org_code (organizationCode),
        INDEX IDX_org_status (status),
        PRIMARY KEY (id)
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE permissions (
        id varchar(36) NOT NULL,
        code varchar(120) NOT NULL,
        description varchar(160) NOT NULL,
        createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE INDEX IDX_permissions_code (code),
        PRIMARY KEY (id)
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE role_permissions (
        id varchar(36) NOT NULL,
        roleName varchar(80) NOT NULL,
        permissionId varchar(36) NOT NULL,
        createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        UNIQUE INDEX IDX_role_perm_role_permission (roleName, permissionId),
        INDEX IDX_role_perm_role (roleName),
        INDEX IDX_role_perm_permission (permissionId),
        PRIMARY KEY (id),
        CONSTRAINT FK_role_perm_permission FOREIGN KEY (permissionId) REFERENCES permissions(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      ALTER TABLE users
        ADD organizationId varchar(36) NULL,
        ADD permissions json NULL,
        ADD INDEX IDX_users_organizationId (organizationId),
        ADD CONSTRAINT FK_users_organizationId FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE SET NULL
    `);

    await queryRunner.query(`
      CREATE TABLE user_roles (
        id varchar(36) NOT NULL,
        userId varchar(36) NOT NULL,
        organizationId varchar(36) NOT NULL,
        roleName varchar(80) NOT NULL,
        createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        UNIQUE INDEX IDX_user_roles_unique (userId, organizationId, roleName),
        INDEX IDX_user_roles_userId (userId),
        INDEX IDX_user_roles_orgId (organizationId),
        INDEX IDX_user_roles_roleName (roleName),
        PRIMARY KEY (id),
        CONSTRAINT FK_user_roles_userId FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT FK_user_roles_orgId FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE service_providers (
        id varchar(36) NOT NULL,
        organizationId varchar(36) NOT NULL,
        providerCode varchar(60) NOT NULL,
        providerName varchar(140) NOT NULL,
        providerType enum('ENACH','ESIGN','KYC','BANK_VERIFICATION','CREDIT_BUREAU','PAYMENT_GATEWAY','DISBURSEMENT','SMS','EMAIL','WHATSAPP','DOCUMENT_STORAGE') NOT NULL,
        status enum('DRAFT','ACTIVE','INACTIVE','PUBLISHED','ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
        isSandbox tinyint NOT NULL DEFAULT 1,
        baseUrl varchar(500) NULL,
        credentialReference varchar(180) NULL,
        webhookSecretReference varchar(180) NULL,
        supportedCapabilities json NULL,
        configuration json NULL,
        createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE INDEX IDX_sp_org_code (organizationId, providerCode),
        INDEX IDX_sp_org (organizationId),
        INDEX IDX_sp_type (providerType),
        INDEX IDX_sp_status (status),
        PRIMARY KEY (id),
        CONSTRAINT FK_sp_org FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE products (
        id varchar(36) NOT NULL,
        organizationId varchar(36) NOT NULL,
        productCode varchar(50) NOT NULL,
        name varchar(140) NOT NULL,
        description text NULL,
        productType enum('PERSONAL_LOAN','BUSINESS_LOAN','CONSUMER_DURABLE_LOAN','SALARY_ADVANCE','MERCHANT_CASH_ADVANCE','EDUCATION_LOAN','VEHICLE_LOAN','BNPL','CREDIT_LINE','SECURED_LOAN') NOT NULL,
        status enum('DRAFT','ACTIVE','INACTIVE','PUBLISHED','ARCHIVED') NOT NULL DEFAULT 'DRAFT',
        version int NOT NULL DEFAULT 1,
        effectiveFrom datetime NULL,
        effectiveTo datetime NULL,
        currency varchar(3) NOT NULL DEFAULT 'INR',
        minimumLoanAmount decimal(15,2) NOT NULL,
        maximumLoanAmount decimal(15,2) NOT NULL,
        minimumTenure int NOT NULL,
        maximumTenure int NOT NULL,
        tenureUnit enum('DAYS','WEEKS','MONTHS','YEARS') NOT NULL DEFAULT 'MONTHS',
        repaymentFrequency enum('MONTHLY','WEEKLY','FORTNIGHTLY','QUARTERLY','CUSTOM') NOT NULL DEFAULT 'MONTHLY',
        interestType enum('FIXED','VARIABLE') NOT NULL DEFAULT 'FIXED',
        interestCalculationMethod enum('FLAT','REDUCING_BALANCE') NOT NULL DEFAULT 'REDUCING_BALANCE',
        minimumInterestRate decimal(8,4) NOT NULL,
        maximumInterestRate decimal(8,4) NOT NULL,
        defaultInterestRate decimal(8,4) NOT NULL,
        processingFeeType enum('FIXED','PERCENTAGE','SLAB') NOT NULL DEFAULT 'PERCENTAGE',
        processingFeeValue decimal(12,4) NOT NULL DEFAULT 0,
        lateFeeConfiguration json NULL,
        gracePeriodDays int NOT NULL DEFAULT 0,
        minimumAge int NULL,
        maximumAge int NULL,
        minimumIncome decimal(15,2) NULL,
        requiredCreditScore int NULL,
        requiresKyc tinyint NOT NULL DEFAULT 1,
        requiresBankVerification tinyint NOT NULL DEFAULT 0,
        requiresENach tinyint NOT NULL DEFAULT 0,
        requiresESign tinyint NOT NULL DEFAULT 0,
        requiresAgreement tinyint NOT NULL DEFAULT 1,
        requiresManualApproval tinyint NOT NULL DEFAULT 1,
        allowsPrepayment tinyint NOT NULL DEFAULT 1,
        allowsPartPayment tinyint NOT NULL DEFAULT 0,
        chargeConfiguration json NULL,
        metadata json NULL,
        createdBy varchar(36) NULL,
        updatedBy varchar(36) NULL,
        lockVersion int NOT NULL DEFAULT 1,
        createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE INDEX IDX_products_org_code (organizationId, productCode),
        INDEX IDX_products_org (organizationId),
        INDEX IDX_products_type (productType),
        INDEX IDX_products_status (status),
        PRIMARY KEY (id),
        CONSTRAINT FK_products_org FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE product_versions (
        id varchar(36) NOT NULL,
        productId varchar(36) NOT NULL,
        version int NOT NULL,
        status enum('DRAFT','ACTIVE','INACTIVE','PUBLISHED','ARCHIVED') NOT NULL DEFAULT 'DRAFT',
        effectiveFrom datetime NULL,
        effectiveTo datetime NULL,
        configurationSnapshot json NOT NULL,
        createdBy varchar(36) NULL,
        publishedAt datetime NULL,
        createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        UNIQUE INDEX IDX_product_versions_unique (productId, version),
        INDEX IDX_product_versions_product (productId),
        PRIMARY KEY (id),
        CONSTRAINT FK_product_versions_product FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE partners (
        id varchar(36) NOT NULL,
        organizationId varchar(36) NOT NULL,
        partnerCode varchar(50) NOT NULL,
        name varchar(140) NOT NULL,
        legalName varchar(180) NOT NULL,
        partnerType enum('LENDING_PARTNER','LOAN_SOURCING_PARTNER','DSA','FINTECH_PLATFORM','MERCHANT','EMPLOYER','COLLECTION_PARTNER','SERVICE_PROVIDER','CO_LENDING_PARTNER') NOT NULL,
        status enum('DRAFT','ACTIVE','INACTIVE','PUBLISHED','ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
        email varchar(160) NULL,
        phone varchar(24) NULL,
        pan varchar(20) NULL,
        gstin varchar(24) NULL,
        address text NULL,
        contactPerson json NULL,
        settlementConfiguration json NULL,
        commissionConfiguration json NULL,
        providerConfiguration json NULL,
        requiredCustomerFields json NULL,
        requiredDocuments json NULL,
        workflowOverrides json NULL,
        apiCredentialReference json NULL,
        createdBy varchar(36) NULL,
        updatedBy varchar(36) NULL,
        createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE INDEX IDX_partners_org_code (organizationId, partnerCode),
        INDEX IDX_partners_org (organizationId),
        INDEX IDX_partners_type (partnerType),
        INDEX IDX_partners_status (status),
        PRIMARY KEY (id),
        CONSTRAINT FK_partners_org FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE partner_products (
        id varchar(36) NOT NULL,
        partnerId varchar(36) NOT NULL,
        productId varchar(36) NOT NULL,
        productVersionId varchar(36) NULL,
        status enum('DRAFT','ACTIVE','INACTIVE','PUBLISHED','ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
        requiresKyc tinyint NOT NULL DEFAULT 1,
        requiresBankVerification tinyint NOT NULL DEFAULT 0,
        requiresDocumentVerification tinyint NOT NULL DEFAULT 0,
        requiresManualApproval tinyint NOT NULL DEFAULT 1,
        allowsAutomatedApproval tinyint NOT NULL DEFAULT 0,
        requiresAgreement tinyint NOT NULL DEFAULT 1,
        requiresESign tinyint NOT NULL DEFAULT 0,
        requiresENach tinyint NOT NULL DEFAULT 0,
        requiresDisbursementConfirmation tinyint NOT NULL DEFAULT 0,
        esignProviderId varchar(36) NULL,
        enachProviderId varchar(36) NULL,
        kycProviderId varchar(36) NULL,
        disbursementProviderId varchar(36) NULL,
        workflowDefinitionId varchar(36) NULL,
        effectiveFrom datetime NULL,
        effectiveTo datetime NULL,
        minimumLoanAmount decimal(15,2) NULL,
        maximumLoanAmount decimal(15,2) NULL,
        interestRateOverride decimal(8,4) NULL,
        interestOverrides json NULL,
        feeOverrides json NULL,
        workflowOverrides json NULL,
        allowedProviderIds json NULL,
        createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE INDEX IDX_partner_products_unique (partnerId, productId),
        INDEX IDX_partner_products_partner (partnerId),
        INDEX IDX_partner_products_product (productId),
        INDEX IDX_partner_products_version (productVersionId),
        PRIMARY KEY (id),
        CONSTRAINT FK_partner_products_partner FOREIGN KEY (partnerId) REFERENCES partners(id) ON DELETE CASCADE,
        CONSTRAINT FK_partner_products_product FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE,
        CONSTRAINT FK_partner_products_version FOREIGN KEY (productVersionId) REFERENCES product_versions(id) ON DELETE SET NULL
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE product_application_fields (
        id varchar(36) NOT NULL,
        productId varchar(36) NOT NULL,
        productVersionId varchar(36) NULL,
        fieldKey varchar(80) NOT NULL,
        label varchar(120) NOT NULL,
        fieldType enum('TEXT','NUMBER','CURRENCY','DATE','SELECT','MULTI_SELECT','CHECKBOX','RADIO','FILE_UPLOAD','ADDRESS','BANK_DETAILS','EMPLOYMENT_DETAILS','BUSINESS_DETAILS','GUARANTOR_DETAILS','CO_APPLICANT_DETAILS') NOT NULL,
        placeholder varchar(180) NULL,
        helpText text NULL,
        required tinyint NOT NULL DEFAULT 0,
        displayOrder int NOT NULL DEFAULT 0,
        defaultValue json NULL,
        validationRules json NULL,
        options json NULL,
        visibilityConditions json NULL,
        editableStatuses json NULL,
        \`sensitive\` tinyint NOT NULL DEFAULT 0,
        createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE INDEX IDX_product_fields_unique (productId, fieldKey),
        INDEX IDX_product_fields_product (productId),
        INDEX IDX_product_fields_version (productVersionId),
        PRIMARY KEY (id),
        CONSTRAINT FK_product_fields_product FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE,
        CONSTRAINT FK_product_fields_version FOREIGN KEY (productVersionId) REFERENCES product_versions(id) ON DELETE SET NULL
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE product_eligibility_rules (
        id varchar(36) NOT NULL,
        productId varchar(36) NOT NULL,
        productVersionId varchar(36) NULL,
        ruleCode varchar(80) NOT NULL,
        name varchar(140) NOT NULL,
        version int NOT NULL DEFAULT 1,
        status enum('DRAFT','ACTIVE','INACTIVE','PUBLISHED','ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
        ruleDefinition json NOT NULL,
        score int NOT NULL DEFAULT 0,
        failureReason text NULL,
        createdBy varchar(36) NULL,
        updatedBy varchar(36) NULL,
        createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE INDEX IDX_product_rules_unique (productId, ruleCode, version),
        INDEX IDX_product_rules_product (productId),
        INDEX IDX_product_rules_version (productVersionId),
        INDEX IDX_product_rules_status (status),
        PRIMARY KEY (id),
        CONSTRAINT FK_product_rules_product FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE,
        CONSTRAINT FK_product_rules_version FOREIGN KEY (productVersionId) REFERENCES product_versions(id) ON DELETE SET NULL
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE product_workflow_definitions (
        id varchar(36) NOT NULL,
        productId varchar(36) NOT NULL,
        productVersionId varchar(36) NOT NULL,
        workflowCode varchar(80) NOT NULL,
        name varchar(140) NOT NULL,
        version int NOT NULL DEFAULT 1,
        status enum('DRAFT','ACTIVE','INACTIVE','PUBLISHED','ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
        metadata json NULL,
        createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE INDEX IDX_workflow_defs_unique (productId, productVersionId, workflowCode),
        INDEX IDX_workflow_defs_product (productId),
        INDEX IDX_workflow_defs_version (productVersionId),
        INDEX IDX_workflow_defs_status (status),
        PRIMARY KEY (id),
        CONSTRAINT FK_workflow_defs_product FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE,
        CONSTRAINT FK_workflow_defs_version FOREIGN KEY (productVersionId) REFERENCES product_versions(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE product_workflow_steps (
        id varchar(36) NOT NULL,
        productId varchar(36) NOT NULL,
        productVersionId varchar(36) NULL,
        workflowDefinitionId varchar(36) NULL,
        stepKey varchar(80) NOT NULL,
        label varchar(120) NOT NULL,
        status enum(${applicationStatuses}) NOT NULL,
        displayOrder int NOT NULL DEFAULT 0,
        requiredWhen json NULL,
        actorRole varchar(80) NULL,
        createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE INDEX IDX_workflow_steps_unique (productId, stepKey),
        INDEX IDX_workflow_steps_product (productId),
        INDEX IDX_workflow_steps_version (productVersionId),
        INDEX IDX_workflow_steps_definition (workflowDefinitionId),
        PRIMARY KEY (id),
        CONSTRAINT FK_workflow_steps_product FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE,
        CONSTRAINT FK_workflow_steps_version FOREIGN KEY (productVersionId) REFERENCES product_versions(id) ON DELETE SET NULL,
        CONSTRAINT FK_workflow_steps_definition FOREIGN KEY (workflowDefinitionId) REFERENCES product_workflow_definitions(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE product_provider_configurations (
        id varchar(36) NOT NULL,
        productId varchar(36) NOT NULL,
        productVersionId varchar(36) NOT NULL,
        providerType enum('ENACH','ESIGN','KYC','BANK_VERIFICATION','CREDIT_BUREAU','PAYMENT_GATEWAY','DISBURSEMENT','SMS','EMAIL','WHATSAPP','DOCUMENT_STORAGE') NOT NULL,
        providerId varchar(36) NULL,
        status enum('DRAFT','ACTIVE','INACTIVE','PUBLISHED','ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
        configuration json NULL,
        createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        UNIQUE INDEX IDX_product_provider_unique (productId, productVersionId, providerType),
        INDEX IDX_product_provider_provider (providerId),
        PRIMARY KEY (id),
        CONSTRAINT FK_product_provider_product FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE,
        CONSTRAINT FK_product_provider_version FOREIGN KEY (productVersionId) REFERENCES product_versions(id) ON DELETE CASCADE,
        CONSTRAINT FK_product_provider_provider FOREIGN KEY (providerId) REFERENCES service_providers(id) ON DELETE SET NULL
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE partner_provider_configurations (
        id varchar(36) NOT NULL,
        partnerId varchar(36) NOT NULL,
        providerType enum('ENACH','ESIGN','KYC','BANK_VERIFICATION','CREDIT_BUREAU','PAYMENT_GATEWAY','DISBURSEMENT','SMS','EMAIL','WHATSAPP','DOCUMENT_STORAGE') NOT NULL,
        providerId varchar(36) NULL,
        status enum('DRAFT','ACTIVE','INACTIVE','PUBLISHED','ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
        configuration json NULL,
        createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        UNIQUE INDEX IDX_partner_provider_unique (partnerId, providerType),
        INDEX IDX_partner_provider_provider (providerId),
        PRIMARY KEY (id),
        CONSTRAINT FK_partner_provider_partner FOREIGN KEY (partnerId) REFERENCES partners(id) ON DELETE CASCADE,
        CONSTRAINT FK_partner_provider_provider FOREIGN KEY (providerId) REFERENCES service_providers(id) ON DELETE SET NULL
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      ALTER TABLE loan_applications
        MODIFY status enum(${applicationStatuses}) NOT NULL DEFAULT 'DRAFT',
        ADD applicationNumber varchar(40) NULL,
        ADD organizationId varchar(36) NULL,
        ADD partnerId varchar(36) NULL,
        ADD productId varchar(36) NULL,
        ADD productVersionId varchar(36) NULL,
        ADD configurationSnapshotId varchar(36) NULL,
        ADD requestedAmount decimal(18,2) NULL,
        ADD approvedAmount decimal(18,2) NULL,
        ADD sanctionedAmount decimal(18,2) NULL,
        ADD grossDisbursementAmount decimal(18,2) NULL,
        ADD upfrontDeductions decimal(18,2) NULL,
        ADD netDisbursementAmount decimal(18,2) NULL,
        ADD totalRepayableAmount decimal(18,2) NULL,
        ADD dynamicFields json NULL,
        ADD pricingBreakdown json NULL,
        ADD productSnapshot json NULL,
        ADD partnerSnapshot json NULL,
        ADD eligibilitySnapshot json NULL,
        ADD workflowSnapshot json NULL,
        ADD applicantSnapshot json NULL,
        ADD ruleEvaluationResult json NULL,
        ADD currentWorkflowStep varchar(80) NULL,
        ADD UNIQUE INDEX IDX_app_applicationNumber (applicationNumber),
        ADD INDEX IDX_app_organizationId (organizationId),
        ADD INDEX IDX_app_partnerId (partnerId),
        ADD INDEX IDX_app_productId (productId),
        ADD INDEX IDX_app_productVersionId (productVersionId),
        ADD INDEX IDX_app_configurationSnapshotId (configurationSnapshotId),
        ADD CONSTRAINT FK_app_org FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE SET NULL,
        ADD CONSTRAINT FK_app_partner FOREIGN KEY (partnerId) REFERENCES partners(id) ON DELETE SET NULL,
        ADD CONSTRAINT FK_app_product FOREIGN KEY (productId) REFERENCES products(id) ON DELETE SET NULL,
        ADD CONSTRAINT FK_app_product_version FOREIGN KEY (productVersionId) REFERENCES product_versions(id) ON DELETE SET NULL
    `);

    await queryRunner.query(`
      CREATE TABLE application_configuration_snapshots (
        id varchar(36) NOT NULL,
        loanApplicationId varchar(36) NOT NULL,
        organizationId varchar(36) NOT NULL,
        productId varchar(36) NOT NULL,
        productVersionId varchar(36) NOT NULL,
        partnerId varchar(36) NULL,
        resolvedConfiguration json NOT NULL,
        productSnapshot json NOT NULL,
        partnerSnapshot json NULL,
        partnerProductSnapshot json NULL,
        fieldsSnapshot json NOT NULL,
        eligibilityRulesSnapshot json NOT NULL,
        workflowSnapshot json NOT NULL,
        applicantSnapshot json NOT NULL,
        pricingSnapshot json NULL,
        createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        UNIQUE INDEX IDX_app_snapshot_application (loanApplicationId),
        INDEX IDX_app_snapshot_org (organizationId),
        INDEX IDX_app_snapshot_product (productId),
        INDEX IDX_app_snapshot_version (productVersionId),
        INDEX IDX_app_snapshot_partner (partnerId),
        PRIMARY KEY (id),
        CONSTRAINT FK_app_snapshot_application FOREIGN KEY (loanApplicationId) REFERENCES loan_applications(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE application_status_transitions (
        id varchar(36) NOT NULL,
        loanApplicationId varchar(36) NOT NULL,
        previousStatus enum(${applicationStatuses}) NULL,
        newStatus enum(${applicationStatuses}) NOT NULL,
        action varchar(80) NOT NULL,
        actorUserId varchar(36) NULL,
        actorRole varchar(80) NULL,
        reason text NULL,
        comments text NULL,
        metadata json NULL,
        createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        INDEX IDX_app_trans_application_created (loanApplicationId, createdAt),
        INDEX IDX_app_trans_application (loanApplicationId),
        INDEX IDX_app_trans_new_status (newStatus),
        PRIMARY KEY (id),
        CONSTRAINT FK_app_trans_application FOREIGN KEY (loanApplicationId) REFERENCES loan_applications(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      ALTER TABLE loans
        MODIFY status enum('PENDING','AUTO_REVIEWED','APPROVED','REJECTED','DISBURSED','ACTIVE','CLOSED','DEFAULTED','WRITTEN_OFF') NOT NULL DEFAULT 'APPROVED',
        ADD loanAccountNumber varchar(40) NULL,
        ADD organizationId varchar(36) NULL,
        ADD partnerId varchar(36) NULL,
        ADD productId varchar(36) NULL,
        ADD sanctionedAmount decimal(18,2) NULL,
        ADD disbursedAmount decimal(18,2) NULL,
        ADD principalOutstanding decimal(18,2) NULL,
        ADD interestOutstanding decimal(18,2) NULL,
        ADD feeOutstanding decimal(18,2) NULL,
        ADD penaltyOutstanding decimal(18,2) NULL,
        ADD totalOutstanding decimal(18,2) NULL,
        ADD repaymentFrequency varchar(40) NULL,
        ADD firstDueDate datetime NULL,
        ADD maturityDate datetime NULL,
        ADD UNIQUE INDEX IDX_loans_account_number (loanAccountNumber),
        ADD INDEX IDX_loans_organizationId (organizationId),
        ADD INDEX IDX_loans_partnerId (partnerId),
        ADD INDEX IDX_loans_productId (productId),
        ADD CONSTRAINT FK_loans_org FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE SET NULL,
        ADD CONSTRAINT FK_loans_partner FOREIGN KEY (partnerId) REFERENCES partners(id) ON DELETE SET NULL,
        ADD CONSTRAINT FK_loans_product FOREIGN KEY (productId) REFERENCES products(id) ON DELETE SET NULL
    `);

    await queryRunner.query(`
      CREATE TABLE document_templates (
        id varchar(36) NOT NULL,
        organizationId varchar(36) NOT NULL,
        productId varchar(36) NULL,
        partnerId varchar(36) NULL,
        documentType enum('LOAN_AGREEMENT','SANCTION_LETTER','KEY_FACT_STATEMENT','REPAYMENT_SCHEDULE','MANDATE_FORM','CONSENT_FORM','DISCLOSURE_DOCUMENT','WELCOME_LETTER','CLOSURE_LETTER','NOC') NOT NULL,
        language varchar(12) NOT NULL DEFAULT 'en-IN',
        version int NOT NULL DEFAULT 1,
        effectiveFrom datetime NULL,
        effectiveTo datetime NULL,
        status enum('DRAFT','PUBLISHED','ARCHIVED') NOT NULL DEFAULT 'DRAFT',
        title varchar(160) NOT NULL,
        templateHtml mediumtext NOT NULL,
        allowedPlaceholders json NULL,
        createdBy varchar(36) NULL,
        updatedBy varchar(36) NULL,
        createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE INDEX IDX_templates_unique (organizationId, documentType, productId, partnerId, language, version),
        INDEX IDX_templates_org (organizationId),
        INDEX IDX_templates_product (productId),
        INDEX IDX_templates_partner (partnerId),
        INDEX IDX_templates_status (status),
        PRIMARY KEY (id),
        CONSTRAINT FK_templates_org FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE,
        CONSTRAINT FK_templates_product FOREIGN KEY (productId) REFERENCES products(id) ON DELETE SET NULL,
        CONSTRAINT FK_templates_partner FOREIGN KEY (partnerId) REFERENCES partners(id) ON DELETE SET NULL
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE document_template_versions (
        id varchar(36) NOT NULL,
        templateId varchar(36) NOT NULL,
        version int NOT NULL,
        status enum('DRAFT','PUBLISHED','ARCHIVED') NOT NULL DEFAULT 'DRAFT',
        templateHtml mediumtext NOT NULL,
        placeholders json NULL,
        checksum varchar(64) NULL,
        createdBy varchar(36) NULL,
        publishedAt datetime NULL,
        createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        UNIQUE INDEX IDX_template_versions_unique (templateId, version),
        INDEX IDX_template_versions_template (templateId),
        PRIMARY KEY (id),
        CONSTRAINT FK_template_versions_template FOREIGN KEY (templateId) REFERENCES document_templates(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE generated_documents (
        id varchar(36) NOT NULL,
        organizationId varchar(36) NOT NULL,
        loanApplicationId varchar(36) NOT NULL,
        loanId varchar(36) NULL,
        templateVersionId varchar(36) NULL,
        documentType enum('LOAN_AGREEMENT','SANCTION_LETTER','KEY_FACT_STATEMENT','REPAYMENT_SCHEDULE','MANDATE_FORM','CONSENT_FORM','DISCLOSURE_DOCUMENT','WELCOME_LETTER','CLOSURE_LETTER','NOC') NOT NULL,
        fileName varchar(180) NOT NULL,
        storageUrl varchar(500) NULL,
        contentHtml mediumtext NULL,
        checksum varchar(64) NOT NULL,
        generatedBy varchar(36) NULL,
        immutable tinyint NOT NULL DEFAULT 0,
        createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        INDEX IDX_generated_docs_org (organizationId),
        INDEX IDX_generated_docs_application (loanApplicationId),
        INDEX IDX_generated_docs_loan (loanId),
        INDEX IDX_generated_docs_template_version (templateVersionId),
        PRIMARY KEY (id),
        CONSTRAINT FK_generated_docs_application FOREIGN KEY (loanApplicationId) REFERENCES loan_applications(id) ON DELETE CASCADE,
        CONSTRAINT FK_generated_docs_loan FOREIGN KEY (loanId) REFERENCES loans(id) ON DELETE SET NULL,
        CONSTRAINT FK_generated_docs_template_version FOREIGN KEY (templateVersionId) REFERENCES document_template_versions(id) ON DELETE SET NULL
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE customer_consents (
        id varchar(36) NOT NULL,
        customerId varchar(36) NOT NULL,
        loanApplicationId varchar(36) NOT NULL,
        consentType enum('PRIVACY_POLICY','CREDIT_BUREAU','KYC','DATA_SHARING','ENACH','ESIGN','LOAN_AGREEMENT_ACCEPTANCE','MARKETING') NOT NULL,
        consentVersion varchar(40) NOT NULL,
        accepted tinyint NOT NULL,
        acceptedAt datetime NULL,
        ipAddress varchar(80) NULL,
        userAgent varchar(500) NULL,
        source varchar(80) NULL,
        consentTextHash varchar(64) NOT NULL,
        metadata json NULL,
        createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        UNIQUE INDEX IDX_consents_unique (customerId, loanApplicationId, consentType, consentVersion),
        INDEX IDX_consents_customer (customerId),
        INDEX IDX_consents_application (loanApplicationId),
        PRIMARY KEY (id),
        CONSTRAINT FK_consents_customer FOREIGN KEY (customerId) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT FK_consents_application FOREIGN KEY (loanApplicationId) REFERENCES loan_applications(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE provider_webhook_events (
        id varchar(36) NOT NULL,
        organizationId varchar(36) NOT NULL,
        providerCode varchar(60) NOT NULL,
        providerType enum('ENACH','ESIGN','KYC','BANK_VERIFICATION','CREDIT_BUREAU','PAYMENT_GATEWAY','DISBURSEMENT','SMS','EMAIL','WHATSAPP','DOCUMENT_STORAGE') NOT NULL,
        providerEventId varchar(160) NOT NULL,
        eventType varchar(80) NOT NULL,
        headersSnapshot json NOT NULL,
        payload json NOT NULL,
        signatureVerified tinyint NOT NULL DEFAULT 0,
        processed tinyint NOT NULL DEFAULT 0,
        processedAt datetime NULL,
        processingError text NULL,
        payloadHash varchar(64) NULL,
        createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE INDEX IDX_webhook_provider_event (providerCode, providerEventId),
        INDEX IDX_webhook_org (organizationId),
        PRIMARY KEY (id)
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE idempotency_records (
        id varchar(36) NOT NULL,
        scope varchar(80) NOT NULL,
        idempotencyKey varchar(160) NOT NULL,
        actorUserId varchar(36) NULL,
        entityId varchar(36) NULL,
        requestHash json NULL,
        responseSnapshot json NULL,
        status varchar(40) NOT NULL DEFAULT 'PROCESSING',
        createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE INDEX IDX_idempotency_scope_key (scope, idempotencyKey),
        PRIMARY KEY (id)
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE enach_mandates (
        id varchar(36) NOT NULL,
        organizationId varchar(36) NOT NULL,
        loanApplicationId varchar(36) NOT NULL,
        loanId varchar(36) NULL,
        customerId varchar(36) NOT NULL,
        partnerId varchar(36) NULL,
        productId varchar(36) NULL,
        providerId varchar(36) NULL,
        mandateReference varchar(120) NOT NULL,
        customerBankAccountId varchar(36) NULL,
        mandateType varchar(40) NOT NULL DEFAULT 'DEBIT',
        frequency varchar(40) NOT NULL,
        maximumAmount decimal(18,2) NOT NULL,
        startDate datetime NULL,
        endDate datetime NULL,
        status enum('NOT_REQUIRED','PENDING','INITIATED','CUSTOMER_ACTION_PENDING','PROCESSING','REGISTERED','FAILED','EXPIRED','CANCELLED','SUSPENDED') NOT NULL DEFAULT 'PENDING',
        providerStatus varchar(80) NULL,
        failureCode varchar(80) NULL,
        failureReason text NULL,
        providerRequest json NULL,
        providerResponse json NULL,
        registeredAt datetime NULL,
        cancelledAt datetime NULL,
        createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE INDEX IDX_enach_reference (mandateReference),
        INDEX IDX_enach_org (organizationId),
        INDEX IDX_enach_application (loanApplicationId),
        INDEX IDX_enach_customer (customerId),
        INDEX IDX_enach_provider (providerId),
        INDEX IDX_enach_status (status),
        PRIMARY KEY (id),
        CONSTRAINT FK_enach_application FOREIGN KEY (loanApplicationId) REFERENCES loan_applications(id) ON DELETE CASCADE,
        CONSTRAINT FK_enach_loan FOREIGN KEY (loanId) REFERENCES loans(id) ON DELETE SET NULL,
        CONSTRAINT FK_enach_customer FOREIGN KEY (customerId) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT FK_enach_partner FOREIGN KEY (partnerId) REFERENCES partners(id) ON DELETE SET NULL,
        CONSTRAINT FK_enach_product FOREIGN KEY (productId) REFERENCES products(id) ON DELETE SET NULL,
        CONSTRAINT FK_enach_provider FOREIGN KEY (providerId) REFERENCES service_providers(id) ON DELETE SET NULL
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE enach_mandate_status_history (
        id varchar(36) NOT NULL,
        mandateId varchar(36) NOT NULL,
        previousStatus enum('NOT_REQUIRED','PENDING','INITIATED','CUSTOMER_ACTION_PENDING','PROCESSING','REGISTERED','FAILED','EXPIRED','CANCELLED','SUSPENDED') NULL,
        newStatus enum('NOT_REQUIRED','PENDING','INITIATED','CUSTOMER_ACTION_PENDING','PROCESSING','REGISTERED','FAILED','EXPIRED','CANCELLED','SUSPENDED') NOT NULL,
        actorUserId varchar(36) NULL,
        reason text NULL,
        metadata json NULL,
        createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        INDEX IDX_enach_history_mandate (mandateId),
        PRIMARY KEY (id),
        CONSTRAINT FK_enach_history_mandate FOREIGN KEY (mandateId) REFERENCES enach_mandates(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE esign_requests (
        id varchar(36) NOT NULL,
        organizationId varchar(36) NOT NULL,
        loanApplicationId varchar(36) NOT NULL,
        loanId varchar(36) NULL,
        customerId varchar(36) NOT NULL,
        partnerId varchar(36) NULL,
        productId varchar(36) NULL,
        providerId varchar(36) NULL,
        agreementDocumentId varchar(36) NOT NULL,
        providerRequestId varchar(120) NOT NULL,
        signingUrl varchar(700) NULL,
        status enum('NOT_REQUIRED','PENDING','INITIATED','SIGNING_LINK_CREATED','CUSTOMER_ACTION_PENDING','SIGNED','FAILED','EXPIRED','CANCELLED') NOT NULL DEFAULT 'PENDING',
        providerStatus varchar(80) NULL,
        expiresAt datetime NULL,
        signedAt datetime NULL,
        failureCode varchar(80) NULL,
        failureReason text NULL,
        providerRequest json NULL,
        providerResponse json NULL,
        createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE INDEX IDX_esign_provider_request (providerRequestId),
        INDEX IDX_esign_org (organizationId),
        INDEX IDX_esign_application (loanApplicationId),
        INDEX IDX_esign_customer (customerId),
        INDEX IDX_esign_provider (providerId),
        INDEX IDX_esign_document (agreementDocumentId),
        INDEX IDX_esign_status (status),
        PRIMARY KEY (id),
        CONSTRAINT FK_esign_application FOREIGN KEY (loanApplicationId) REFERENCES loan_applications(id) ON DELETE CASCADE,
        CONSTRAINT FK_esign_loan FOREIGN KEY (loanId) REFERENCES loans(id) ON DELETE SET NULL,
        CONSTRAINT FK_esign_customer FOREIGN KEY (customerId) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT FK_esign_partner FOREIGN KEY (partnerId) REFERENCES partners(id) ON DELETE SET NULL,
        CONSTRAINT FK_esign_product FOREIGN KEY (productId) REFERENCES products(id) ON DELETE SET NULL,
        CONSTRAINT FK_esign_provider FOREIGN KEY (providerId) REFERENCES service_providers(id) ON DELETE SET NULL,
        CONSTRAINT FK_esign_document FOREIGN KEY (agreementDocumentId) REFERENCES generated_documents(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE esign_status_history (
        id varchar(36) NOT NULL,
        esignRequestId varchar(36) NOT NULL,
        previousStatus enum('NOT_REQUIRED','PENDING','INITIATED','SIGNING_LINK_CREATED','CUSTOMER_ACTION_PENDING','SIGNED','FAILED','EXPIRED','CANCELLED') NULL,
        newStatus enum('NOT_REQUIRED','PENDING','INITIATED','SIGNING_LINK_CREATED','CUSTOMER_ACTION_PENDING','SIGNED','FAILED','EXPIRED','CANCELLED') NOT NULL,
        actorUserId varchar(36) NULL,
        reason text NULL,
        metadata json NULL,
        createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        INDEX IDX_esign_history_request (esignRequestId),
        PRIMARY KEY (id),
        CONSTRAINT FK_esign_history_request FOREIGN KEY (esignRequestId) REFERENCES esign_requests(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE disbursements (
        id varchar(36) NOT NULL,
        organizationId varchar(36) NOT NULL,
        loanApplicationId varchar(36) NOT NULL,
        loanId varchar(36) NULL,
        customerId varchar(36) NOT NULL,
        partnerId varchar(36) NULL,
        productId varchar(36) NULL,
        providerId varchar(36) NULL,
        disbursementReference varchar(120) NOT NULL,
        amount decimal(18,2) NOT NULL,
        netAmount decimal(18,2) NOT NULL,
        status enum('NOT_INITIATED','READY','INITIATED','PROCESSING','SUCCESS','FAILED','REVERSED','CANCELLED') NOT NULL DEFAULT 'NOT_INITIATED',
        providerReference varchar(120) NULL,
        bankReference varchar(120) NULL,
        utr varchar(120) NULL,
        failureCode varchar(80) NULL,
        failureReason text NULL,
        providerRequest json NULL,
        providerResponse json NULL,
        initiatedAt datetime NULL,
        completedAt datetime NULL,
        createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE INDEX IDX_disbursement_reference (disbursementReference),
        INDEX IDX_disbursement_org (organizationId),
        INDEX IDX_disbursement_application (loanApplicationId),
        INDEX IDX_disbursement_loan (loanId),
        INDEX IDX_disbursement_customer (customerId),
        INDEX IDX_disbursement_provider (providerId),
        INDEX IDX_disbursement_status (status),
        PRIMARY KEY (id),
        CONSTRAINT FK_disbursement_application FOREIGN KEY (loanApplicationId) REFERENCES loan_applications(id) ON DELETE CASCADE,
        CONSTRAINT FK_disbursement_loan FOREIGN KEY (loanId) REFERENCES loans(id) ON DELETE SET NULL,
        CONSTRAINT FK_disbursement_customer FOREIGN KEY (customerId) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT FK_disbursement_partner FOREIGN KEY (partnerId) REFERENCES partners(id) ON DELETE SET NULL,
        CONSTRAINT FK_disbursement_product FOREIGN KEY (productId) REFERENCES products(id) ON DELETE SET NULL,
        CONSTRAINT FK_disbursement_provider FOREIGN KEY (providerId) REFERENCES service_providers(id) ON DELETE SET NULL
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE disbursement_status_history (
        id varchar(36) NOT NULL,
        disbursementId varchar(36) NOT NULL,
        previousStatus enum('NOT_INITIATED','READY','INITIATED','PROCESSING','SUCCESS','FAILED','REVERSED','CANCELLED') NULL,
        newStatus enum('NOT_INITIATED','READY','INITIATED','PROCESSING','SUCCESS','FAILED','REVERSED','CANCELLED') NOT NULL,
        actorUserId varchar(36) NULL,
        reason text NULL,
        metadata json NULL,
        createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        INDEX IDX_disbursement_history_disbursement (disbursementId),
        PRIMARY KEY (id),
        CONSTRAINT FK_disbursement_history_disbursement FOREIGN KEY (disbursementId) REFERENCES disbursements(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE repayment_ledger_entries (
        id varchar(36) NOT NULL,
        organizationId varchar(36) NOT NULL,
        loanId varchar(36) NOT NULL,
        repaymentId varchar(36) NULL,
        transactionType enum('DISBURSEMENT','PRINCIPAL_DUE','INTEREST_DUE','FEE_DUE','PENALTY_DUE','PAYMENT_RECEIVED','PAYMENT_REVERSED','FEE_WAIVED','PENALTY_WAIVED','WRITE_OFF','REFUND','ADJUSTMENT') NOT NULL,
        principalAmount decimal(18,2) NOT NULL DEFAULT 0,
        interestAmount decimal(18,2) NOT NULL DEFAULT 0,
        feeAmount decimal(18,2) NOT NULL DEFAULT 0,
        penaltyAmount decimal(18,2) NOT NULL DEFAULT 0,
        totalAmount decimal(18,2) NOT NULL,
        providerReference varchar(120) NULL,
        externalReference varchar(120) NULL,
        metadata json NULL,
        createdBy varchar(36) NULL,
        createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        INDEX IDX_ledger_loan_created (loanId, createdAt),
        INDEX IDX_ledger_org (organizationId),
        INDEX IDX_ledger_loan (loanId),
        INDEX IDX_ledger_repayment (repaymentId),
        PRIMARY KEY (id),
        CONSTRAINT FK_ledger_loan FOREIGN KEY (loanId) REFERENCES loans(id) ON DELETE CASCADE,
        CONSTRAINT FK_ledger_repayment FOREIGN KEY (repaymentId) REFERENCES repayments(id) ON DELETE SET NULL
      ) ENGINE=InnoDB
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE repayment_ledger_entries');
    await queryRunner.query('DROP TABLE disbursement_status_history');
    await queryRunner.query('DROP TABLE disbursements');
    await queryRunner.query('DROP TABLE esign_status_history');
    await queryRunner.query('DROP TABLE esign_requests');
    await queryRunner.query('DROP TABLE enach_mandate_status_history');
    await queryRunner.query('DROP TABLE enach_mandates');
    await queryRunner.query('DROP TABLE idempotency_records');
    await queryRunner.query('DROP TABLE provider_webhook_events');
    await queryRunner.query('DROP TABLE customer_consents');
    await queryRunner.query('DROP TABLE generated_documents');
    await queryRunner.query('DROP TABLE document_template_versions');
    await queryRunner.query('DROP TABLE document_templates');

    await queryRunner.query(`
      ALTER TABLE loans
        DROP FOREIGN KEY FK_loans_product,
        DROP FOREIGN KEY FK_loans_partner,
        DROP FOREIGN KEY FK_loans_org,
        DROP INDEX IDX_loans_productId,
        DROP INDEX IDX_loans_partnerId,
        DROP INDEX IDX_loans_organizationId,
        DROP INDEX IDX_loans_account_number,
        DROP COLUMN maturityDate,
        DROP COLUMN firstDueDate,
        DROP COLUMN repaymentFrequency,
        DROP COLUMN totalOutstanding,
        DROP COLUMN penaltyOutstanding,
        DROP COLUMN feeOutstanding,
        DROP COLUMN interestOutstanding,
        DROP COLUMN principalOutstanding,
        DROP COLUMN disbursedAmount,
        DROP COLUMN sanctionedAmount,
        DROP COLUMN productId,
        DROP COLUMN partnerId,
        DROP COLUMN organizationId,
        DROP COLUMN loanAccountNumber,
        MODIFY status enum('PENDING','AUTO_REVIEWED','APPROVED','REJECTED','DISBURSED','ACTIVE','CLOSED','DEFAULTED') NOT NULL DEFAULT 'APPROVED'
    `);

    await queryRunner.query('DROP TABLE application_status_transitions');
    await queryRunner.query('DROP TABLE application_configuration_snapshots');

    await queryRunner.query(`
      ALTER TABLE loan_applications
        DROP FOREIGN KEY FK_app_product_version,
        DROP FOREIGN KEY FK_app_product,
        DROP FOREIGN KEY FK_app_partner,
        DROP FOREIGN KEY FK_app_org,
        DROP INDEX IDX_app_configurationSnapshotId,
        DROP INDEX IDX_app_productVersionId,
        DROP INDEX IDX_app_productId,
        DROP INDEX IDX_app_partnerId,
        DROP INDEX IDX_app_organizationId,
        DROP INDEX IDX_app_applicationNumber,
        DROP COLUMN currentWorkflowStep,
        DROP COLUMN ruleEvaluationResult,
        DROP COLUMN applicantSnapshot,
        DROP COLUMN workflowSnapshot,
        DROP COLUMN eligibilitySnapshot,
        DROP COLUMN partnerSnapshot,
        DROP COLUMN productSnapshot,
        DROP COLUMN pricingBreakdown,
        DROP COLUMN dynamicFields,
        DROP COLUMN totalRepayableAmount,
        DROP COLUMN netDisbursementAmount,
        DROP COLUMN upfrontDeductions,
        DROP COLUMN grossDisbursementAmount,
        DROP COLUMN sanctionedAmount,
        DROP COLUMN approvedAmount,
        DROP COLUMN requestedAmount,
        DROP COLUMN configurationSnapshotId,
        DROP COLUMN productVersionId,
        DROP COLUMN productId,
        DROP COLUMN partnerId,
        DROP COLUMN organizationId,
        DROP COLUMN applicationNumber,
        MODIFY status enum('DRAFT','SUBMITTED','IN_REVIEW','PENDING','AUTO_REVIEWED','APPROVED','REJECTED') NOT NULL DEFAULT 'DRAFT'
    `);

    await queryRunner.query('DROP TABLE partner_provider_configurations');
    await queryRunner.query('DROP TABLE product_provider_configurations');
    await queryRunner.query('DROP TABLE product_workflow_steps');
    await queryRunner.query('DROP TABLE product_workflow_definitions');
    await queryRunner.query('DROP TABLE product_eligibility_rules');
    await queryRunner.query('DROP TABLE product_application_fields');
    await queryRunner.query('DROP TABLE partner_products');
    await queryRunner.query('DROP TABLE partners');
    await queryRunner.query('DROP TABLE product_versions');
    await queryRunner.query('DROP TABLE products');
    await queryRunner.query('DROP TABLE service_providers');
    await queryRunner.query('DROP TABLE user_roles');

    await queryRunner.query(`
      ALTER TABLE users
        DROP FOREIGN KEY FK_users_organizationId,
        DROP INDEX IDX_users_organizationId,
        DROP COLUMN permissions,
        DROP COLUMN organizationId
    `);

    await queryRunner.query('DROP TABLE role_permissions');
    await queryRunner.query('DROP TABLE permissions');
    await queryRunner.query('DROP TABLE organizations');
  }
}
