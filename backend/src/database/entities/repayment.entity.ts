import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { RepaymentStatus } from './enums';
import { MONEY_COLUMN } from '../transformers/decimal.transformer';
import { Customer } from './customer.entity';
import { Loan } from './loan.entity';

@Entity('repayments')
export class Repayment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  loanId: string;

  @Index()
  @Column()
  customerId: string;

  @Index()
  @Column({ type: 'datetime' })
  dueDate: Date;

  @Column(MONEY_COLUMN)
  emiAmount: number;

  @Column(MONEY_COLUMN)
  principalComponent: number;

  @Column(MONEY_COLUMN)
  interestComponent: number;

  @Column({ ...MONEY_COLUMN, default: 0 })
  paidAmount: number;

  // Flat charges per RBI penal-charges rules; they never change the EMI or the interest rate.
  @Column({ ...MONEY_COLUMN, default: 0 })
  lateFeeAmount: number;

  @Column({ ...MONEY_COLUMN, default: 0 })
  bounceChargeAmount: number;

  @Column({ type: 'int', default: 0 })
  bounceCount: number;

  @Column({ type: 'datetime', nullable: true })
  lateFeeAppliedAt?: Date | null;

  @Index()
  @Column({ type: 'enum', enum: RepaymentStatus, default: RepaymentStatus.PENDING })
  status: RepaymentStatus;

  @Column({ type: 'datetime', nullable: true })
  paidAt?: Date | null;

  @Column({ type: 'int', default: 0 })
  daysOverdue: number;

  @Column({ type: 'datetime', nullable: true })
  overdueMarkedAt?: Date | null;

  @Column({ type: 'datetime', nullable: true })
  lastReminderAt?: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Loan, (loan) => loan.repayments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'loanId' })
  loan: Loan;

  @ManyToOne(() => Customer, (customer) => customer.repayments, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'customerId' })
  customer: Customer;
}
