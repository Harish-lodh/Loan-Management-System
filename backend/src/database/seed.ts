import * as bcrypt from 'bcrypt';
import dataSource from './data-source';
import {
  AuditLog,
  ApplicationFieldType,
  DocumentTemplate,
  DocumentTemplateStatus,
  DocumentTemplateVersion,
  DocumentType,
  EmploymentType,
  FeeType,
  InterestCalculationMethod,
  InterestType,
  Loan,
  LoanApplication,
  LoanApplicationStatus,
  LoanStatus,
  MasterStatus,
  Notification,
  NotificationType,
  Organization,
  Partner,
  PartnerProduct,
  PartnerType,
  Permission,
  Product,
  ProductApplicationField,
  ProductEligibilityRule,
  ProductType,
  ProductVersion,
  ProductWorkflowDefinition,
  ProductWorkflowStep,
  ProviderType,
  RepaymentFrequency,
  Repayment,
  RepaymentStatus,
  Role,
  RolePermission,
  ServiceProvider,
  TenureUnit,
  UserRole,
  User,
} from './entities';
import { calculateAuditHash } from '../audit-log/audit-hash.util';
import { assessLoanRisk, calculateEmi, generateRepaymentSchedule } from '../loans/loan-calculations';
import { moneyToString, rateToString } from '../lending-platform/money.util';

async function createAuditLog(input: {
  action: string;
  entityType: string;
  entityId: string;
  actorUserId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const auditRepository = dataSource.getRepository(AuditLog);
  const latest = await auditRepository
    .createQueryBuilder('auditLog')
    .orderBy('auditLog.sequence', 'DESC')
    .getOne();
  const timestamp = new Date();
  const metadata = input.metadata ?? {};
  const previousHash = latest?.currentHash ?? null;
  const currentHash = calculateAuditHash({
    ...input,
    timestamp,
    metadata,
    previousHash,
  });

  await auditRepository.save(
    auditRepository.create({
      ...input,
      timestamp,
      metadata,
      previousHash,
      currentHash,
    }),
  );
}

async function upsertUser(
  data: Pick<User, 'name' | 'email' | 'phone' | 'role'> &
    Partial<Pick<User, 'address' | 'occupation' | 'annualIncome'>> & { password: string },
) {
  const userRepository = dataSource.getRepository(User);
  const existing = await userRepository.findOne({ where: { email: data.email } });
  const password = await bcrypt.hash(data.password, Number(process.env.BCRYPT_SALT_ROUNDS ?? 12));

  if (existing) {
    existing.name = data.name;
    existing.phone = data.phone;
    existing.role = data.role;
    existing.address = data.address ?? existing.address;
    existing.occupation = data.occupation ?? existing.occupation;
    existing.annualIncome = data.annualIncome ?? existing.annualIncome;
    existing.password = password;
    return userRepository.save(existing);
  }

  const user = await userRepository.save(
    userRepository.create({
      ...data,
      password,
    }),
  );
  await createAuditLog({
    action: 'USER_REGISTERED',
    entityType: 'User',
    entityId: user.id,
    actorUserId: user.id,
    metadata: { email: user.email, role: user.role, seeded: true },
  });
  return user;
}

async function createDemoLoan(user: User) {
  const applicationRepository = dataSource.getRepository(LoanApplication);
  const loanRepository = dataSource.getRepository(Loan);
  const repaymentRepository = dataSource.getRepository(Repayment);
  const notificationRepository = dataSource.getRepository(Notification);

  const existingApplication = await applicationRepository.findOne({ where: { userId: user.id } });
  if (existingApplication) {
    return;
  }

  const input = {
    amount: 250000,
    tenureMonths: 24,
    monthlyIncome: 85000,
    employmentType: EmploymentType.SALARIED,
    existingMonthlyDebt: 8000,
    creditScore: 760,
  };
  const annualInterestRate = Number(process.env.ANNUAL_INTEREST_RATE ?? 12);
  const risk = assessLoanRisk(input);
  const emi = calculateEmi({
    principal: input.amount,
    tenureMonths: input.tenureMonths,
    annualInterestRate,
  });
  const application = await applicationRepository.save(
    applicationRepository.create({
      userId: user.id,
      amount: input.amount,
      tenureMonths: input.tenureMonths,
      monthlyIncome: input.monthlyIncome,
      employmentType: input.employmentType,
      existingMonthlyDebt: input.existingMonthlyDebt,
      creditScore: input.creditScore,
      purpose: 'Home office renovation',
      status: LoanApplicationStatus.APPROVED,
      riskScore: risk.riskScore,
      approvalLikelihood: risk.approvalLikelihood,
      riskExplanation: risk.riskExplanation,
      scoreBreakdown: risk.scoreBreakdown,
      annualInterestRate,
      emi: emi.monthlyEmi,
      totalPayable: emi.totalPayable,
      totalInterest: emi.totalInterest,
      adminComment: 'Seeded approved demo loan',
      submittedAt: new Date(),
      reviewedAt: new Date(),
      statusHistory: [
        {
          status: LoanApplicationStatus.SUBMITTED,
          changedAt: new Date().toISOString(),
          actorUserId: user.id,
          comment: 'Seeded submitted application',
        },
        {
          status: LoanApplicationStatus.IN_REVIEW,
          changedAt: new Date().toISOString(),
          actorUserId: null,
          comment: 'Seeded transparent risk review',
        },
        {
          status: LoanApplicationStatus.APPROVED,
          changedAt: new Date().toISOString(),
          actorUserId: null,
          comment: 'Seeded approval',
        },
      ],
    }),
  );

  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 1);
  const loan = await loanRepository.save(
    loanRepository.create({
      userId: user.id,
      applicationId: application.id,
      principal: input.amount,
      annualInterestRate,
      tenureMonths: input.tenureMonths,
      emi: emi.monthlyEmi,
      totalPayable: emi.totalPayable,
      outstandingBalance: input.amount,
      status: LoanStatus.ACTIVE,
      disbursedAt: startDate,
      startDate,
      statusHistory: [
        {
          status: LoanStatus.ACTIVE,
          changedAt: new Date().toISOString(),
          actorUserId: null,
          comment: 'Seeded active loan',
        },
      ],
    }),
  );

  const schedule = generateRepaymentSchedule({
    principal: input.amount,
    tenureMonths: input.tenureMonths,
    annualInterestRate,
    startDate,
  });
  await repaymentRepository.save(
    schedule.map((item, index) =>
      repaymentRepository.create({
        loanId: loan.id,
        userId: user.id,
        dueDate: item.dueDate,
        emiAmount: item.emiAmount,
        principalComponent: item.principalComponent,
        interestComponent: item.interestComponent,
        status: index === 0 ? RepaymentStatus.PAID : RepaymentStatus.PENDING,
        paidAmount: index === 0 ? item.emiAmount : 0,
        paidAt: index === 0 ? new Date() : null,
      }),
    ),
  );

  await notificationRepository.save([
    notificationRepository.create({
      userId: user.id,
      title: 'Loan approved',
      message: 'Your demo loan is active with a generated repayment schedule.',
      type: NotificationType.LOAN_APPROVED,
      priority: 'HIGH',
      actionUrl: `/loans/${loan.id}`,
    }),
    notificationRepository.create({
      userId: user.id,
      title: 'Upcoming payment scheduled',
      message: `Your next EMI of ${emi.monthlyEmi.toFixed(2)} is coming up soon.`,
      type: NotificationType.PAYMENT_DUE,
      actionUrl: '/repayments',
    }),
  ]);

  await createAuditLog({
    action: 'LOAN_APPLICATION_SUBMITTED',
    entityType: 'LoanApplication',
    entityId: application.id,
    actorUserId: user.id,
    metadata: { seeded: true, amount: application.amount },
  });
  await createAuditLog({
    action: 'LOAN_APPROVED',
    entityType: 'LoanApplication',
    entityId: application.id,
    actorUserId: null,
    metadata: { seeded: true, riskScore: application.riskScore },
  });
  await createAuditLog({
    action: 'LOAN_DISBURSED',
    entityType: 'Loan',
    entityId: loan.id,
    actorUserId: null,
    metadata: { seeded: true, principal: loan.principal },
  });
}

async function createDemoDraft(user: User) {
  const applicationRepository = dataSource.getRepository(LoanApplication);
  const notificationRepository = dataSource.getRepository(Notification);

  const existingApplication = await applicationRepository.findOne({ where: { userId: user.id } });
  if (existingApplication) {
    return;
  }

  const input = {
    amount: 180000,
    tenureMonths: 18,
    monthlyIncome: 62000,
    employmentType: EmploymentType.SELF_EMPLOYED,
    existingMonthlyDebt: 12000,
    creditScore: 690,
  };
  const annualInterestRate = Number(process.env.ANNUAL_INTEREST_RATE ?? 12);
  const risk = assessLoanRisk(input);
  const emi = calculateEmi({
    principal: input.amount,
    tenureMonths: input.tenureMonths,
    annualInterestRate,
  });

  const application = await applicationRepository.save(
    applicationRepository.create({
      userId: user.id,
      amount: input.amount,
      tenureMonths: input.tenureMonths,
      monthlyIncome: input.monthlyIncome,
      employmentType: input.employmentType,
      existingMonthlyDebt: input.existingMonthlyDebt,
      creditScore: input.creditScore,
      purpose: 'Two-wheeler purchase',
      status: LoanApplicationStatus.DRAFT,
      riskScore: risk.riskScore,
      approvalLikelihood: risk.approvalLikelihood,
      riskExplanation: risk.riskExplanation,
      scoreBreakdown: risk.scoreBreakdown,
      annualInterestRate,
      emi: emi.monthlyEmi,
      totalPayable: emi.totalPayable,
      totalInterest: emi.totalInterest,
      statusHistory: [
        {
          status: LoanApplicationStatus.DRAFT,
          changedAt: new Date().toISOString(),
          actorUserId: user.id,
          comment: 'Seeded draft application',
        },
      ],
    }),
  );

  await notificationRepository.save(
    notificationRepository.create({
      userId: user.id,
      title: 'Loan draft saved',
      message: 'Your two-wheeler loan draft is ready to submit.',
      type: NotificationType.APPLICATION_DRAFTED,
      priority: 'LOW',
      actionUrl: `/loans/${application.id}`,
    }),
  );

  await createAuditLog({
    action: 'LOAN_APPLICATION_DRAFTED',
    entityType: 'LoanApplication',
    entityId: application.id,
    actorUserId: user.id,
    metadata: { seeded: true, amount: application.amount },
  });
}

async function upsertOrganization() {
  const repository = dataSource.getRepository(Organization);
  const existing = await repository.findOne({ where: { organizationCode: 'FTLEND' } });
  const payload = {
    organizationCode: 'FTLEND',
    name: 'Fintree Lending',
    legalName: 'Fintree Financial Services Private Limited',
    cin: 'U65990KA2026PTC000001',
    rbiRegistrationNumber: 'RBI-LENDING-DEMO-001',
    pan: 'ABCDE1234F',
    gstin: '29ABCDE1234F1Z5',
    registeredAddress: 'Bengaluru, Karnataka',
    supportDetails: { email: 'support@demo.bank', phone: '+91 90000 00000' },
    defaultCurrency: 'INR',
    timeZone: 'Asia/Kolkata',
    status: MasterStatus.ACTIVE,
    authorizedSignatory: { name: 'Demo Signatory', designation: 'Authorized Officer' },
    bankConfiguration: { disbursementAccountMasked: 'XXXXXX4321', ifsc: 'DEMO0001234' },
  };
  if (existing) {
    Object.assign(existing, payload);
    return repository.save(existing);
  }
  return repository.save(repository.create(payload));
}

async function seedPermissions(organization: Organization, admin: User) {
  const permissionRepository = dataSource.getRepository(Permission);
  const rolePermissionRepository = dataSource.getRepository(RolePermission);
  const userRoleRepository = dataSource.getRepository(UserRole);
  const codes = [
    'organization.create',
    'organization.view',
    'product.create',
    'product.view',
    'product.update',
    'product.publish',
    'partner.create',
    'partner.view',
    'partner.update',
    'provider.configure',
    'provider.view',
    'application.create',
    'application.view',
    'application.review',
    'application.approve',
    'application.reject',
    'agreement.generate',
    'agreement.template.manage',
    'agreement.template.view',
    'esign.initiate',
    'enach.initiate',
    'disbursement.initiate',
    'audit.view',
  ];

  for (const code of codes) {
    let permission = await permissionRepository.findOne({ where: { code } });
    if (!permission) {
      permission = await permissionRepository.save(permissionRepository.create({ code, description: code.replaceAll('.', ' ') }));
    }
    const existingRolePermission = await rolePermissionRepository.findOne({
      where: { roleName: 'LENDING_ADMIN', permissionId: permission.id },
    });
    if (!existingRolePermission) {
      await rolePermissionRepository.save(rolePermissionRepository.create({ roleName: 'LENDING_ADMIN', permissionId: permission.id }));
    }
  }

  const existingUserRole = await userRoleRepository.findOne({
    where: { userId: admin.id, organizationId: organization.id, roleName: 'LENDING_ADMIN' },
  });
  if (!existingUserRole) {
    await userRoleRepository.save(
      userRoleRepository.create({ userId: admin.id, organizationId: organization.id, roleName: 'LENDING_ADMIN' }),
    );
  }
}

async function upsertProvider(organization: Organization, providerCode: string, providerName: string, providerType: ProviderType) {
  const repository = dataSource.getRepository(ServiceProvider);
  const existing = await repository.findOne({ where: { organizationId: organization.id, providerCode } });
  const payload = {
    organizationId: organization.id,
    providerCode,
    providerName,
    providerType,
    status: MasterStatus.ACTIVE,
    isSandbox: true,
    baseUrl: 'https://mock-provider.local',
    credentialReference: `${providerCode}_CREDENTIAL_REF`,
    webhookSecretReference: `mock-${providerCode}`,
    supportedCapabilities: ['initiate', 'webhook', 'status'],
    configuration: { mock: true },
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

  const admin = await upsertUser({
    name: 'Demo Admin',
    email: 'admin@demo.bank',
    phone: '+91 90000 00001',
    password: 'Admin@12345',
    role: Role.ADMIN,
    occupation: 'Loan operations manager',
  });
  const organization = await upsertOrganization();
  await dataSource.getRepository(User).update(admin.id, { organizationId: organization.id });
  await seedPermissions(organization, admin);

  const esignProvider = await upsertProvider(organization, 'MOCK_ESIGN', 'Mock eSign Provider', ProviderType.ESIGN);
  const enachProvider = await upsertProvider(organization, 'MOCK_ENACH', 'Mock eNACH Provider', ProviderType.ENACH);
  const disbursementProvider = await upsertProvider(
    organization,
    'MOCK_DISBURSEMENT',
    'Mock Disbursement Provider',
    ProviderType.DISBURSEMENT,
  );

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
  const providers = { esign: esignProvider, enach: enachProvider, disbursement: disbursementProvider };
  await assignPartnerProduct(lendingPartner, personalLoan.product, personalLoan.version, providers);
  await assignPartnerProduct(lendingPartner, salaryAdvance.product, salaryAdvance.version, providers);
  await assignPartnerProduct(dsaPartner, merchantLoan.product, merchantLoan.version, providers);
  await upsertAgreementTemplate(organization, personalLoan.product);
  await upsertAgreementTemplate(organization, salaryAdvance.product);
  await upsertAgreementTemplate(organization, merchantLoan.product);

  const maya = await upsertUser({
    name: 'Maya Sharma',
    email: 'maya@example.com',
    phone: '+91 90000 00002',
    password: 'User@12345',
    role: Role.USER,
    address: 'Indiranagar, Bengaluru',
    occupation: 'Product designer',
    annualIncome: 1020000,
  });
  await dataSource.getRepository(User).update(maya.id, { organizationId: organization.id });
  const arjun = await upsertUser({
    name: 'Arjun Mehta',
    email: 'arjun@example.com',
    phone: '+91 90000 00003',
    password: 'User@12345',
    role: Role.USER,
    address: 'Andheri West, Mumbai',
    occupation: 'Freelance consultant',
    annualIncome: 744000,
  });
  await dataSource.getRepository(User).update(arjun.id, { organizationId: organization.id });

  await createDemoLoan(maya);
  await createDemoDraft(arjun);
  await createAuditLog({
    action: 'SEED_COMPLETED',
    entityType: 'User',
    entityId: admin.id,
    actorUserId: admin.id,
    metadata: { demoUsers: 2, products: 3, partners: 2, mockProviders: 3 },
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
