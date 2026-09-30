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
import { DisbursementStatus } from './enums';
import { DisbursementStatusHistory } from './disbursement-status-history.entity';
import { LoanApplication } from './loan-application.entity';
import { Loan } from './loan.entity';
import { Partner } from './partner.entity';
import { Product } from './product.entity';
import { ServiceProvider } from './service-provider.entity';
import { Customer } from './customer.entity';

@Entity('disbursements')
export class Disbursement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  organizationId: string;

  @Index()
  @Column()
  loanApplicationId: string;

  @Index()
  @Column({ type: 'varchar', length: 36, nullable: true })
  loanId?: string | null;

  @Index()
  @Column()
  customerId: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  partnerId?: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  productId?: string | null;

  @Index()
  @Column({ type: 'varchar', length: 36, nullable: true })
  providerId?: string | null;

  @Index({ unique: true })
  @Column({ length: 120 })
  disbursementReference: string;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  amount: string;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  netAmount: string;

  @Index()
  @Column({ type: 'enum', enum: DisbursementStatus, default: DisbursementStatus.NOT_INITIATED })
  status: DisbursementStatus;

  @Column({ type: 'varchar', length: 120, nullable: true })
  providerReference?: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  bankReference?: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  utr?: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  failureCode?: string | null;

  @Column({ type: 'text', nullable: true })
  failureReason?: string | null;

  @Column({ type: 'json', nullable: true })
  providerRequest?: Record<string, unknown> | null;

  @Column({ type: 'json', nullable: true })
  providerResponse?: Record<string, unknown> | null;

  @Column({ type: 'datetime', nullable: true })
  initiatedAt?: Date | null;

  @Column({ type: 'datetime', nullable: true })
  completedAt?: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => LoanApplication, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'loanApplicationId' })
  loanApplication: LoanApplication;

  @ManyToOne(() => Loan, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'loanId' })
  loan?: Loan | null;

  @ManyToOne(() => Customer, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'customerId' })
  customer: Customer;

  @ManyToOne(() => Partner, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'partnerId' })
  partner?: Partner | null;

  @ManyToOne(() => Product, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'productId' })
  product?: Product | null;

  @ManyToOne(() => ServiceProvider, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'providerId' })
  provider?: ServiceProvider | null;

  @OneToMany(() => DisbursementStatusHistory, (history) => history.disbursement)
  statusHistory: DisbursementStatusHistory[];
}
