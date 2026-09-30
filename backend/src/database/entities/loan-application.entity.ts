import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EmploymentType, LoanApplicationStatus } from './enums';
import { ApplicationConfigurationSnapshot } from './application-configuration-snapshot.entity';
import { MONEY_COLUMN, RATE_COLUMN } from '../transformers/decimal.transformer';
import { Customer } from './customer.entity';
import { Loan } from './loan.entity';

@Entity('loan_applications')
export class LoanApplication {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  customerId: string;

  // Staff user who captured the application (maker). Used for maker-checker on approval.
  @Index()
  @Column({ type: 'varchar', length: 36, nullable: true })
  createdById?: string | null;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 40, nullable: true })
  applicationNumber?: string | null;

  @Index()
  @Column({ type: 'varchar', length: 36, nullable: true })
  organizationId?: string | null;

  @Index()
  @Column({ type: 'varchar', length: 36, nullable: true })
  partnerId?: string | null;

  @Index()
  @Column({ type: 'varchar', length: 36, nullable: true })
  productId?: string | null;

  @Index()
  @Column({ type: 'varchar', length: 36, nullable: true })
  productVersionId?: string | null;

  @Index()
  @Column({ type: 'varchar', length: 36, nullable: true })
  configurationSnapshotId?: string | null;

  @Column(MONEY_COLUMN)
  amount: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, nullable: true })
  requestedAmount?: string | null;

  @Column({ type: 'decimal', precision: 18, scale: 2, nullable: true })
  approvedAmount?: string | null;

  @Column({ type: 'decimal', precision: 18, scale: 2, nullable: true })
  sanctionedAmount?: string | null;

  @Column({ type: 'decimal', precision: 18, scale: 2, nullable: true })
  grossDisbursementAmount?: string | null;

  @Column({ type: 'decimal', precision: 18, scale: 2, nullable: true })
  upfrontDeductions?: string | null;

  @Column({ type: 'decimal', precision: 18, scale: 2, nullable: true })
  netDisbursementAmount?: string | null;

  @Column({ type: 'int' })
  tenureMonths: number;

  @Column(MONEY_COLUMN)
  monthlyIncome: number;

  @Column({ type: 'enum', enum: EmploymentType })
  employmentType: EmploymentType;

  @Column(MONEY_COLUMN)
  existingMonthlyDebt: number;

  @Column({ type: 'int' })
  creditScore: number;

  @Column({ type: 'varchar', length: 240 })
  purpose: string;

  @Index()
  @Column({ type: 'enum', enum: LoanApplicationStatus, default: LoanApplicationStatus.PENDING })
  status: LoanApplicationStatus;

  @Column({ type: 'int' })
  riskScore: number;

  @Column({ length: 40 })
  approvalLikelihood: string;

  @Column({ type: 'text' })
  riskExplanation: string;

  @Column({ type: 'json', nullable: true })
  scoreBreakdown?: Record<string, unknown>[] | null;

  @Column({ ...RATE_COLUMN, default: 12 })
  annualInterestRate: number;

  @Column(MONEY_COLUMN)
  emi: number;

  @Column(MONEY_COLUMN)
  totalPayable: number;

  @Column(MONEY_COLUMN)
  totalInterest: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, nullable: true })
  totalRepayableAmount?: string | null;

  @Column({ type: 'json', nullable: true })
  dynamicFields?: Record<string, unknown> | null;

  @Column({ type: 'json', nullable: true })
  pricingBreakdown?: Record<string, unknown> | null;

  @Column({ type: 'json', nullable: true })
  productSnapshot?: Record<string, unknown> | null;

  @Column({ type: 'json', nullable: true })
  partnerSnapshot?: Record<string, unknown> | null;

  @Column({ type: 'json', nullable: true })
  eligibilitySnapshot?: Record<string, unknown> | null;

  @Column({ type: 'json', nullable: true })
  workflowSnapshot?: Record<string, unknown>[] | null;

  @Column({ type: 'json', nullable: true })
  applicantSnapshot?: Record<string, unknown> | null;

  @Column({ type: 'json', nullable: true })
  ruleEvaluationResult?: Record<string, unknown> | null;

  @Column({ type: 'text', nullable: true })
  adminComment?: string | null;

  @Column({ type: 'datetime', nullable: true })
  reviewedAt?: Date | null;

  @Column({ type: 'datetime', nullable: true })
  submittedAt?: Date | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  reviewerId?: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  currentWorkflowStep?: string | null;

  @Column({ type: 'json', nullable: false })
  statusHistory: Record<string, unknown>[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Customer, (customer) => customer.loanApplications, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'customerId' })
  customer: Customer;

  @OneToOne(() => Loan, (loan) => loan.application)
  loan?: Loan;

  @OneToOne(() => ApplicationConfigurationSnapshot, (snapshot) => snapshot.loanApplication)
  configurationSnapshot?: ApplicationConfigurationSnapshot;
}
