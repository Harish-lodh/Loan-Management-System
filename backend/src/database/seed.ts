import dataSource from './data-source';
import {
  createAuditLog,
  ensureStaffUser,
  seedDefaultProviders,
  seedPermissionCatalogue,
  upsertOrganization,
} from './bootstrap/tenant-bootstrap';
import {
  ApplicationFieldType,
  Customer,
  CustomerStatus,
  DocumentTemplate,
  DocumentTemplateStatus,
  DocumentTemplateVersion,
  DocumentType,
  EmploymentType,
  FeeType,
  InterestCalculationMethod,
  InterestType,
  LoanApplicationStatus,
  MasterStatus,
  Organization,
  Partner,
  PartnerProduct,
  PartnerType,
  Product,
  ProductApplicationField,
  ProductEligibilityRule,
  ProductType,
  ProductVersion,
  ProductWorkflowDefinition,
  ProductWorkflowStep,
  RepaymentFrequency,
  Role,
  ServiceProvider,
  TenureUnit,
} from './entities';
import { calculateAuditHash } from '../audit-log/audit-hash.util';
import { encryptPii, hashPii, maskPan } from '../common/crypto/pii.util';
import { moneyToString, rateToString } from '../lending-platform/money.util';

// Local demo data. Production instances are onboarded with `npm run tenant:init` instead.

type DemoCustomerInput = Pick<
  Customer,
  'customerNumber' | 'fullName' | 'email' | 'phone' | 'addressLine' | 'city' | 'state' | 'pincode' | 'occupation' | 'employmentType' | 'monthlyIncome'
> & { pan: string };

async function upsertDemoCustomer(organization: Organization, data: DemoCustomerInput) {
  const repository = dataSource.getRepository(Customer);
  const { pan, ...profile } = data;
  const existing = await repository.findOne({ where: { customerNumber: data.customerNumber } });
  const payload = {
    ...profile,
    organizationId: organization.id,
    status: CustomerStatus.ACTIVE,
    panMasked: maskPan(pan),
    panHash: hashPii(pan),
    panEncrypted: encryptPii(pan),
  };
  if (existing) {
    Object.assign(existing, payload);
    return repository.save(existing);
  }
  return repository.save(repository.create(payload));
}

async function upsertProduct(
  organization: Organization,
  data: {
    productCode: string;
    name: string;
    productType: ProductType;
    minimumLoanAmount: number;
    maximumLoanAmount: number;
    minimumTenure: number;
    maximumTenure: number;
    defaultInterestRate: number;
    processingFeeValue: number;
    requiresManualApproval: boolean;
    requiresESign: boolean;
    requiresENach: boolean;
  },
) {
  const productRepository = dataSource.getRepository(Product);
  const versionRepository = dataSource.getRepository(ProductVersion);
  let product = await productRepository.findOne({ where: { organizationId: organization.id, productCode: data.productCode } });
  const payload = {
    organizationId: organization.id,
    productCode: data.productCode,
    name: data.name,
    description: `${data.name} seeded product`,
    productType: data.productType,
    status: MasterStatus.PUBLISHED,
    version: 1,
    currency: 'INR',
    minimumLoanAmount: moneyToString(data.minimumLoanAmount),
    maximumLoanAmount: moneyToString(data.maximumLoanAmount),
    minimumTenure: data.minimumTenure,
    maximumTenure: data.maximumTenure,
    tenureUnit: TenureUnit.MONTHS,
    repaymentFrequency: RepaymentFrequency.MONTHLY,
    interestType: InterestType.FIXED,
    interestCalculationMethod: InterestCalculationMethod.REDUCING_BALANCE,
    minimumInterestRate: rateToString(Math.max(0, data.defaultInterestRate - 4)),
    maximumInterestRate: rateToString(data.defaultInterestRate + 8),
    defaultInterestRate: rateToString(data.defaultInterestRate),
    processingFeeType: FeeType.PERCENTAGE,
    processingFeeValue: rateToString(data.processingFeeValue),
    gracePeriodDays: 3,
    lateFeeConfiguration: { type: 'FIXED', amount: 500, bounceCharge: 590 },
    minimumAge: 21,
    maximumAge: 65,
    minimumIncome: moneyToString(25000),
    requiredCreditScore: 650,
    requiresKyc: true,
    requiresBankVerification: true,
    requiresENach: data.requiresENach,
    requiresESign: data.requiresESign,
    requiresAgreement: true,
    requiresManualApproval: data.requiresManualApproval,
    allowsPrepayment: true,
    allowsPartPayment: false,
    chargeConfiguration: [{ chargeType: 'PROCESSING_FEE', value: data.processingFeeValue, valueType: 'PERCENTAGE' }],
  };
  if (product) {
    Object.assign(product, payload);
    product = await productRepository.save(product);
  } else {
    product = await productRepository.save(productRepository.create(payload));
  }

  let version = await versionRepository.findOne({ where: { productId: product.id, version: 1 } });
  const snapshot = {
    productCode: product.productCode,
    name: product.name,
    productType: product.productType,
    minimumLoanAmount: product.minimumLoanAmount,
    maximumLoanAmount: product.maximumLoanAmount,
    minimumTenure: product.minimumTenure,
    maximumTenure: product.maximumTenure,
    defaultInterestRate: product.defaultInterestRate,
    processingFeeValue: product.processingFeeValue,
    requiresKyc: product.requiresKyc,
    requiresBankVerification: product.requiresBankVerification,
    requiresESign: product.requiresESign,
    requiresENach: product.requiresENach,
    requiresAgreement: product.requiresAgreement,
    requiresManualApproval: product.requiresManualApproval,
  };
  if (version) {
    version.status = MasterStatus.PUBLISHED;
    version.configurationSnapshot = snapshot;
    version.publishedAt = new Date();
    version = await versionRepository.save(version);
  } else {
    version = await versionRepository.save(
      versionRepository.create({
        productId: product.id,
        version: 1,
        status: MasterStatus.PUBLISHED,
        configurationSnapshot: snapshot,
        publishedAt: new Date(),
      }),
    );
  }

  await seedProductConfiguration(product, version);
  return { product, version };
}

async function seedProductConfiguration(product: Product, version: ProductVersion) {
  const fieldRepository = dataSource.getRepository(ProductApplicationField);
  const ruleRepository = dataSource.getRepository(ProductEligibilityRule);
  const workflowDefinitionRepository = dataSource.getRepository(ProductWorkflowDefinition);
  const workflowStepRepository = dataSource.getRepository(ProductWorkflowStep);

  const fields = [
    { fieldKey: 'age', label: 'Age', fieldType: ApplicationFieldType.NUMBER, required: true, displayOrder: 10, validationRules: { min: 21, max: 65 } },
    { fieldKey: 'city', label: 'City', fieldType: ApplicationFieldType.TEXT, required: true, displayOrder: 20 },
    { fieldKey: 'bankAccountMasked', label: 'Masked bank account', fieldType: ApplicationFieldType.TEXT, required: true, displayOrder: 30, sensitive: true },
  ];
  for (const field of fields) {
    const existing = await fieldRepository.findOne({ where: { productId: product.id, fieldKey: field.fieldKey } });
    if (!existing) {
      await fieldRepository.save(fieldRepository.create({ ...field, productId: product.id, productVersionId: version.id }));
    }
  }

  const rules = [
    {
      ruleCode: 'AGE_INCOME_AMOUNT',
      name: 'Age, income, and amount eligibility',
      ruleDefinition: {
        all: [
          { field: 'applicant.age', operator: 'greaterThanOrEqual', value: 21 },
          { field: 'applicant.monthlyIncome', operator: 'greaterThanOrEqual', valueFrom: 'product.minimumIncome' },
          { field: 'application.requestedAmount', operator: 'lessThanOrEqual', valueFrom: 'product.maximumLoanAmount' },
        ],
      },
      score: 40,
      failureReason: 'Applicant does not satisfy age, income, or amount policy',
    },
    {
      ruleCode: 'CREDIT_SCORE',
      name: 'Credit score policy',
      ruleDefinition: { field: 'applicant.creditScore', operator: 'greaterThanOrEqual', valueFrom: 'product.requiredCreditScore' },
      score: 30,
      failureReason: 'Credit score is below product policy',
    },
  ];
  for (const rule of rules) {
    const existing = await ruleRepository.findOne({ where: { productId: product.id, ruleCode: rule.ruleCode, version: 1 } });
    if (!existing) {
      await ruleRepository.save(
        ruleRepository.create({ ...rule, productId: product.id, productVersionId: version.id, version: 1, status: MasterStatus.ACTIVE }),
      );
    }
  }

  let definition = await workflowDefinitionRepository.findOne({
    where: { productId: product.id, productVersionId: version.id, workflowCode: 'DEFAULT' },
  });
  if (!definition) {
    definition = await workflowDefinitionRepository.save(
      workflowDefinitionRepository.create({
        productId: product.id,
        productVersionId: version.id,
        workflowCode: 'DEFAULT',
        name: `${product.name} default workflow`,
        version: 1,
        status: MasterStatus.ACTIVE,
      }),
    );
  }
  const steps: Array<[string, string, LoanApplicationStatus, number, string]> = [
    ['submitted', 'Submitted', LoanApplicationStatus.SUBMITTED, 10, 'CUSTOMER'],
    ['kyc', 'KYC', LoanApplicationStatus.KYC_PENDING, 20, 'CUSTOMER'],
    ['bank', 'Bank verification', LoanApplicationStatus.BANK_VERIFICATION_PENDING, 30, 'OPERATIONS_USER'],
    product.requiresManualApproval
      ? ['review', 'Credit review', LoanApplicationStatus.UNDER_REVIEW, 40, 'CREDIT_MANAGER']
      : ['auto-approval', 'Automated approval', LoanApplicationStatus.CREDIT_APPROVED, 40, 'SYSTEM'],
    ...(product.requiresManualApproval
      ? ([['credit-approved', 'Credit approved', LoanApplicationStatus.CREDIT_APPROVED, 50, 'CREDIT_MANAGER']] as Array<[string, string, LoanApplicationStatus, number, string]>)
      : []),
    ['agreement', 'Agreement', LoanApplicationStatus.AGREEMENT_PENDING, 60, 'OPERATIONS_USER'],
    ...(product.requiresESign ? ([['esign', 'eSign', LoanApplicationStatus.ESIGN_PENDING, 70, 'CUSTOMER']] as Array<[string, string, LoanApplicationStatus, number, string]>) : []),
    ...(product.requiresENach ? ([['enach', 'eNACH', LoanApplicationStatus.ENACH_PENDING, 80, 'CUSTOMER']] as Array<[string, string, LoanApplicationStatus, number, string]>) : []),
    ['ready', 'Ready for disbursement', LoanApplicationStatus.READY_FOR_DISBURSEMENT, 90, 'OPERATIONS_MANAGER'],
    ['disbursement', 'Disbursement', LoanApplicationStatus.DISBURSEMENT_PENDING, 100, 'OPERATIONS_MANAGER'],
    ['active', 'Active loan', LoanApplicationStatus.ACTIVE, 110, 'SYSTEM'],
  ];
  for (const [stepKey, label, status, displayOrder, actorRole] of steps) {
    const existing = await workflowStepRepository.findOne({ where: { productId: product.id, stepKey } });
    if (!existing) {
      await workflowStepRepository.save(
        workflowStepRepository.create({
          productId: product.id,
          productVersionId: version.id,
          workflowDefinitionId: definition.id,
          stepKey,
          label,
          status,
          displayOrder,
          actorRole,
        }),
      );
    }
  }
}

async function upsertPartner(organization: Organization, partnerCode: string, name: string, partnerType: PartnerType) {
  const repository = dataSource.getRepository(Partner);
  let partner = await repository.findOne({ where: { organizationId: organization.id, partnerCode } });
  const payload = {
    organizationId: organization.id,
    partnerCode,
    name,
    legalName: `${name} Private Limited`,
    partnerType,
    status: MasterStatus.ACTIVE,
    email: `${partnerCode.toLowerCase()}@partner.example`,
    phone: '+91 90000 00100',
    pan: 'PARTN1234F',
    gstin: '29PARTN1234F1Z5',
    address: 'Partner demo address',
    contactPerson: { name: 'Partner Ops', email: `${partnerCode.toLowerCase()}@partner.example` },
    settlementConfiguration: { cycle: 'T+1' },
    commissionConfiguration: { model: 'PERCENTAGE', value: 1.5 },
  };
  if (partner) {
    Object.assign(partner, payload);
    return repository.save(partner);
  }
  return repository.save(repository.create(payload));
}

async function assignPartnerProduct(
  partner: Partner,
  product: Product,
  version: ProductVersion,
  providers: { esign: ServiceProvider; enach: ServiceProvider; disbursement: ServiceProvider },
) {
  const repository = dataSource.getRepository(PartnerProduct);
  let mapping = await repository.findOne({ where: { partnerId: partner.id, productId: product.id } });
  const payload = {
    partnerId: partner.id,
    productId: product.id,
    productVersionId: version.id,
    status: MasterStatus.ACTIVE,
    requiresKyc: product.requiresKyc,
    requiresBankVerification: product.requiresBankVerification,
    requiresDocumentVerification: false,
    requiresManualApproval: product.requiresManualApproval,
    allowsAutomatedApproval: !product.requiresManualApproval,
    requiresAgreement: product.requiresAgreement,
    requiresESign: product.requiresESign,
    requiresENach: product.requiresENach,
    requiresDisbursementConfirmation: false,
    esignProviderId: providers.esign.id,
    enachProviderId: providers.enach.id,
    disbursementProviderId: providers.disbursement.id,
    minimumLoanAmount: product.minimumLoanAmount,
    maximumLoanAmount: product.maximumLoanAmount,
    interestRateOverride: null,
    feeOverrides: null,
  };
  if (mapping) {
    Object.assign(mapping, payload);
    return repository.save(mapping);
  }
  return repository.save(repository.create(payload));
}

async function upsertAgreementTemplate(organization: Organization, product: Product) {
  const templateRepository = dataSource.getRepository(DocumentTemplate);
  const versionRepository = dataSource.getRepository(DocumentTemplateVersion);
  let template = await templateRepository.findOne({
    where: { organizationId: organization.id, productId: product.id, documentType: DocumentType.LOAN_AGREEMENT, version: 1 },
  });
  const templateHtml = `
    <h1>Loan Agreement</h1>
    <p>This agreement is between {{organization.legalName}} and {{customer.fullName}}.</p>
    <p>Application: {{loan.applicationNumber}}</p>
    <p>Sanctioned amount: {{loan.sanctionedAmount}}</p>
    <p>Interest rate: {{loan.interestRate}}</p>
    <p>Tenure: {{loan.tenure}}</p>
    <p>EMI: {{loan.emiAmount}}</p>
    <p>Processing fee: {{loan.processingFee}}</p>
  `;
  const payload = {
    organizationId: organization.id,
    productId: product.id,
    partnerId: null,
    documentType: DocumentType.LOAN_AGREEMENT,
    language: 'en-IN',
    version: 1,
    status: DocumentTemplateStatus.PUBLISHED,
    title: `${product.name} Loan Agreement`,
    templateHtml,
    allowedPlaceholders: [
      'organization.legalName',
      'customer.fullName',
      'loan.applicationNumber',
      'loan.sanctionedAmount',
      'loan.interestRate',
      'loan.tenure',
      'loan.emiAmount',
      'loan.processingFee',
    ],
  };
  if (template) {
    
    Object.assign(template, payload);
    template = await templateRepository.save(template);
  } else {
    template = await templateRepository.save(templateRepository.create(payload));
  }
  let version = await versionRepository.findOne({ where: { templateId: template.id, version: 1 } });
  const versionPayload = {
    templateId: template.id,
    version: 1,
    status: DocumentTemplateStatus.PUBLISHED,
    templateHtml,
    placeholders: payload.allowedPlaceholders,
    checksum: calculateAuditHash({
      action: 'TEMPLATE',
      entityType: 'DocumentTemplate',
      entityId: template.id,
      timestamp: new Date(),
      metadata: { templateHtml },
      previousHash: null,
    }),
    publishedAt: new Date(),
  };
  if (version) {
    Object.assign(version, versionPayload);
    return versionRepository.save(version);
  }
  return versionRepository.save(versionRepository.create(versionPayload));
}

async function seed() {
  await dataSource.initialize();

  const organization = await upsertOrganization(dataSource, {
    organizationCode: 'FTLEND',
    name: 'Fintree Lending',
    legalName: 'Fintree Financial Services Private Limited',
    cin: 'U65990KA2026PTC000001',
    rbiRegistrationNumber: 'RBI-LENDING-DEMO-001',
    pan: 'ABCDE1234F',
    gstin: '29ABCDE1234F1Z5',
    registeredAddress: 'Bengaluru, Karnataka',
    supportDetails: { email: 'support@demo.bank', phone: '+91 90000 00000' },
    authorizedSignatory: { name: 'Demo Signatory', designation: 'Authorized Officer' },
    bankConfiguration: { disbursementAccountMasked: 'XXXXXX4321', ifsc: 'DEMO0001234' },
  });
  await seedPermissionCatalogue(dataSource);

  const staff = [
    { name: 'Platform Support', email: 'superadmin@demo.bank', phone: '+91 90000 00009', password: 'Super@12345', role: Role.SUPER_ADMIN, organizationId: null },
    { name: 'Demo Admin', email: 'admin@demo.bank', phone: '+91 90000 00001', password: 'Admin@12345', role: Role.ADMIN, organizationId: organization.id },
    { name: 'Credit Officer', email: 'credit@demo.bank', phone: '+91 90000 00005', password: 'Credit@12345', role: Role.CREDIT_OFFICER, organizationId: organization.id },
    { name: 'Ops Staff', email: 'staff@demo.bank', phone: '+91 90000 00004', password: 'Staff@12345', role: Role.OPERATIONS, organizationId: organization.id },
    { name: 'Collections Agent', email: 'collections@demo.bank', phone: '+91 90000 00006', password: 'Collect@12345', role: Role.COLLECTIONS, organizationId: organization.id },
  ];
  for (const member of staff) {
    await ensureStaffUser(dataSource, member, { resetPassword: true });
  }

  const providers = await seedDefaultProviders(dataSource, organization);

  const personalLoan = await upsertProduct(organization, {
    productCode: 'PERSONAL_LOAN',
    name: 'Personal Loan',
    productType: ProductType.PERSONAL_LOAN,
    minimumLoanAmount: 25000,
    maximumLoanAmount: 1000000,
    minimumTenure: 6,
    maximumTenure: 60,
    defaultInterestRate: 14,
    processingFeeValue: 2,
    requiresManualApproval: true,
    requiresESign: true,
    requiresENach: true,
  });
  const salaryAdvance = await upsertProduct(organization, {
    productCode: 'SALARY_ADVANCE',
    name: 'Salary Advance',
    productType: ProductType.SALARY_ADVANCE,
    minimumLoanAmount: 5000,
    maximumLoanAmount: 150000,
    minimumTenure: 1,
    maximumTenure: 12,
    defaultInterestRate: 10,
    processingFeeValue: 1,
    requiresManualApproval: false,
    requiresESign: false,
    requiresENach: false,
  });
  const merchantLoan = await upsertProduct(organization, {
    productCode: 'MERCHANT_LOAN',
    name: 'Merchant Loan',
    productType: ProductType.MERCHANT_CASH_ADVANCE,
    minimumLoanAmount: 100000,
    maximumLoanAmount: 2500000,
    minimumTenure: 6,
    maximumTenure: 48,
    defaultInterestRate: 18,
    processingFeeValue: 2.5,
    requiresManualApproval: true,
    requiresESign: true,
    requiresENach: true,
  });
  const lendingPartner = await upsertPartner(organization, 'LEND_DEFAULT', 'Default Lending Partner', PartnerType.LENDING_PARTNER);
  const dsaPartner = await upsertPartner(organization, 'GROWTH_DSA', 'Growth DSA Partner', PartnerType.DSA);
  await assignPartnerProduct(lendingPartner, personalLoan.product, personalLoan.version, providers);
  await assignPartnerProduct(lendingPartner, salaryAdvance.product, salaryAdvance.version, providers);
  await assignPartnerProduct(dsaPartner, merchantLoan.product, merchantLoan.version, providers);
  await upsertAgreementTemplate(organization, personalLoan.product);
  await upsertAgreementTemplate(organization, salaryAdvance.product);
  await upsertAgreementTemplate(organization, merchantLoan.product);

  await upsertDemoCustomer(organization, {
    customerNumber: 'CUSDEMO0001',
    fullName: 'Maya Sharma',
    email: 'maya@example.com',
    phone: '+91 90000 00002',
    pan: 'ABCPM1234K',
    addressLine: 'Indiranagar',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560038',
    occupation: 'Product designer',
    employmentType: EmploymentType.SALARIED,
    monthlyIncome: 85000,
  });
  await upsertDemoCustomer(organization, {
    customerNumber: 'CUSDEMO0002',
    fullName: 'Arjun Mehta',
    email: 'arjun@example.com',
    phone: '+91 90000 00003',
    pan: 'BCDPM5678L',
    addressLine: 'Andheri West',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400053',
    occupation: 'Freelance consultant',
    employmentType: EmploymentType.SELF_EMPLOYED,
    monthlyIncome: 62000,
  });

  await createAuditLog(dataSource, {
    action: 'SEED_COMPLETED',
    entityType: 'Organization',
    entityId: organization.id,
    actorUserId: null,
    metadata: { staffUsers: staff.length, customers: 2, products: 3, partners: 2, providers: 6 },
  });

  await dataSource.destroy();
}

seed().catch(async (error) => {
  console.error(error);
  if (dataSource.isInitialized) {
    await dataSource.destroy();
  }
  process.exit(1);
});
