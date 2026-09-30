import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PaymentCollectionStatus } from './enums';
import { Loan } from './loan.entity';
import { PaymentCollectionStatusHistory } from './payment-collection-status-history.entity';
import { Partner } from './partner.entity';
import { Repayment } from './repayment.entity';
import { ServiceProvider } from './service-provider.entity';
import { Customer } from './customer.entity';

@Entity('payment_collection_requests')
export class PaymentCollectionRequest {
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

  @Index()
  @Column()
  customerId: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  partnerId?: string | null;

  @Index()
  @Column({ type: 'varchar', length: 36, nullable: true })
  providerId?: string | null;

  @Index({ unique: true })
  @Column({ length: 120 })
  providerRequestId: string;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  amount: string;

  @Column({ type: 'varchar', length: 700, nullable: true })
  paymentUrl?: string | null;

  @Index()
  @Column({ type: 'enum', enum: PaymentCollectionStatus, default: PaymentCollectionStatus.INITIATED })
  status: PaymentCollectionStatus;

  @Column({ type: 'varchar', length: 80, nullable: true })
  providerStatus?: string | null;

  @Column({ type: 'datetime', nullable: true })
  expiresAt?: Date | null;

  @Column({ type: 'datetime', nullable: true })
  initiatedAt?: Date | null;

  @Column({ type: 'datetime', nullable: true })
  completedAt?: Date | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  bankReference?: string | null;

  @Column({ type: 'json', nullable: true })
  providerRequest?: Record<string, unknown> | null;

  @Column({ type: 'json', nullable: true })
  providerResponse?: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  createdBy?: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Loan, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'loanId' })
  loan: Loan;

  @ManyToOne(() => Repayment, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'repaymentId' })
  repayment?: Repayment | null;

  @ManyToOne(() => Customer, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'customerId' })
  customer: Customer;

  @ManyToOne(() => Partner, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'partnerId' })
  partner?: Partner | null;

  @ManyToOne(() => ServiceProvider, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'providerId' })
  provider?: ServiceProvider | null;

  @OneToMany(() => PaymentCollectionStatusHistory, (history) => history.paymentCollectionRequest)
  statusHistory: PaymentCollectionStatusHistory[];
}
