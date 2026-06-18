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
import { Loan } from './loan.entity';
import { User } from './user.entity';

@Entity('repayments')
export class Repayment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  loanId: string;

  @Index()
  @Column()
  userId: string;

  @Index()
  @Column({ type: 'datetime' })
  dueDate: Date;

  @Column({ type: 'double' })
  emiAmount: number;

  @Column({ type: 'double' })
  principalComponent: number;

  @Column({ type: 'double' })
  interestComponent: number;

  @Column({ type: 'double', default: 0 })
  paidAmount: number;

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

  @ManyToOne(() => User, (user) => user.repayments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;
}
