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
import { Loan } from './loan.entity';
import { User } from './user.entity';

@Entity('loan_applications')
export class LoanApplication {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  userId: string;

  @Column({ type: 'double' })
  amount: number;

  @Column({ type: 'int' })
  tenureMonths: number;

  @Column({ type: 'double' })
  monthlyIncome: number;

  @Column({ type: 'enum', enum: EmploymentType })
  employmentType: EmploymentType;

  @Column({ type: 'double' })
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

  @Column({ type: 'double', default: 12 })
  annualInterestRate: number;

  @Column({ type: 'double' })
  emi: number;

  @Column({ type: 'double' })
  totalPayable: number;

  @Column({ type: 'double' })
  totalInterest: number;

  @Column({ type: 'text', nullable: true })
  adminComment?: string | null;

  @Column({ type: 'datetime', nullable: true })
  reviewedAt?: Date | null;

  @Column({ type: 'datetime', nullable: true })
  submittedAt?: Date | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  reviewerId?: string | null;

  @Column({ type: 'json', nullable: false })
  statusHistory: Record<string, unknown>[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User, (user) => user.loanApplications, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @OneToOne(() => Loan, (loan) => loan.application)
  loan?: Loan;
}
