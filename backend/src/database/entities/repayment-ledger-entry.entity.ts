import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { RepaymentLedgerTransactionType } from './enums';
import { Loan } from './loan.entity';
import { Repayment } from './repayment.entity';

@Entity('repayment_ledger_entries')
@Index(['loanId', 'createdAt'])
export class RepaymentLedgerEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  organizationId: string;

  @Index()
  @Column()
  loanId: string;

  @Index()
  @Column({ type: 'varchar', length: 36, nullable: true })
  repaymentId?: string | null;

  @Column({ type: 'enum', enum: RepaymentLedgerTransactionType })
  transactionType: RepaymentLedgerTransactionType;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  principalAmount: string;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  interestAmount: string;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  feeAmount: string;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  penaltyAmount: string;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  totalAmount: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  providerReference?: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  externalReference?: string | null;

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  createdBy?: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Loan, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'loanId' })
  loan: Loan;

  @ManyToOne(() => Repayment, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'repaymentId' })
  repayment?: Repayment | null;
}
