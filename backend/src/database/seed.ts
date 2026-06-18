import * as bcrypt from 'bcrypt';
import dataSource from './data-source';
import {
  AuditLog,
  EmploymentType,
  Loan,
  LoanApplication,
  LoanApplicationStatus,
  LoanStatus,
  Notification,
  NotificationType,
  Repayment,
  RepaymentStatus,
  Role,
  User,
} from './entities';
import { calculateAuditHash } from '../audit-log/audit-hash.util';
import { assessLoanRisk, calculateEmi, generateRepaymentSchedule } from '../loans/loan-calculations';

async function createAuditLog(input: {
  action: string;
  entityType: string;
  entityId: string;
  actorUserId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const auditRepository = dataSource.getRepository(AuditLog);
  const latest = await auditRepository.findOne({ order: { sequence: 'DESC' } });
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

  await createDemoLoan(maya);
  await createDemoDraft(arjun);
  await createAuditLog({
    action: 'SEED_COMPLETED',
    entityType: 'User',
    entityId: admin.id,
    actorUserId: admin.id,
    metadata: { demoUsers: 2 },
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
