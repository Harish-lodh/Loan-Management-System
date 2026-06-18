import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { LoanStatus } from './enums';
import { LoanApplication } from './loan-application.entity';
import { Repayment } from './repayment.entity';
import { User } from './user.entity';

@Entity('loans')
export class Loan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  userId: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 40, nullable: true })
  loanAccountNumber?: string | null;

  @Index()
  @Column({ type: 'varchar', length: 36, nullable: true })
  organizationId?: string | null;

  @Index()
  @Column({ type: 'varchar', length: 36, nullable: true })
  partnerId?: string | null;

  @Index()
  @Column({ type: 'varchar', length: 36, nullable: true })
  productId?: string | null;

  @Index({ unique: true })
  @Column()
  applicationId: string;

  @Column({ type: 'double' })
  principal: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, nullable: true })
  sanctionedAmount?: string | null;

  @Column({ type: 'decimal', precision: 18, scale: 2, nullable: true })
  disbursedAmount?: string | null;

  @Column({ type: 'double' })
  annualInterestRate: number;

  @Column({ type: 'int' })
  tenureMonths: number;

  @Column({ type: 'double' })
  emi: number;

  @Column({ type: 'double' })
  totalPayable: number;

  @Column({ type: 'double' })
  outstandingBalance: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, nullable: true })
  principalOutstanding?: string | null;

  @Column({ type: 'decimal', precision: 18, scale: 2, nullable: true })
  interestOutstanding?: string | null;

  @Column({ type: 'decimal', precision: 18, scale: 2, nullable: true })
  feeOutstanding?: string | null;

  @Column({ type: 'decimal', precision: 18, scale: 2, nullable: true })
  penaltyOutstanding?: string | null;

  @Column({ type: 'decimal', precision: 18, scale: 2, nullable: true })
  totalOutstanding?: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  repaymentFrequency?: string | null;

  @Index()
  @Column({ type: 'enum', enum: LoanStatus, default: LoanStatus.APPROVED })
  status: LoanStatus;

  @Column({ type: 'json', nullable: false })
  statusHistory: Record<string, unknown>[];

  @Column({ type: 'datetime', nullable: true })
  disbursedAt?: Date | null;

  @Column({ type: 'datetime', nullable: true })
  startDate?: Date | null;

  @Column({ type: 'datetime', nullable: true })
  firstDueDate?: Date | null;

  @Column({ type: 'datetime', nullable: true })
  maturityDate?: Date | null;

  @Column({ type: 'datetime', nullable: true })
  closedAt?: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User, (user) => user.loans, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @OneToOne(() => LoanApplication, (application) => application.loan, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'applicationId' })
  application: LoanApplication;

  @OneToMany(() => Repayment, (repayment) => repayment.loan)
  repayments: Repayment[];
}
