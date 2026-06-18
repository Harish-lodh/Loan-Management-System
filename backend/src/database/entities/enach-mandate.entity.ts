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
import { ENachMandateStatus } from './enums';
import { ENachMandateStatusHistory } from './enach-mandate-status-history.entity';
import { LoanApplication } from './loan-application.entity';
import { Loan } from './loan.entity';
import { Partner } from './partner.entity';
import { Product } from './product.entity';
import { ServiceProvider } from './service-provider.entity';
import { User } from './user.entity';

@Entity('enach_mandates')
export class ENachMandate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  organizationId: string;

  @Index()
  @Column()
  loanApplicationId: string;

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
  mandateReference: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  customerBankAccountId?: string | null;

  @Column({ length: 40, default: 'DEBIT' })
  mandateType: string;

  @Column({ length: 40 })
  frequency: string;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  maximumAmount: string;

  @Column({ type: 'datetime', nullable: true })
  startDate?: Date | null;

  @Column({ type: 'datetime', nullable: true })
  endDate?: Date | null;

  @Index()
  @Column({ type: 'enum', enum: ENachMandateStatus, default: ENachMandateStatus.PENDING })
  status: ENachMandateStatus;

  @Column({ type: 'varchar', length: 80, nullable: true })
  providerStatus?: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  failureCode?: string | null;

  @Column({ type: 'text', nullable: true })
  failureReason?: string | null;

  @Column({ type: 'json', nullable: true })
  providerRequest?: Record<string, unknown> | null;

  @Column({ type: 'json', nullable: true })
  providerResponse?: Record<string, unknown> | null;

  @Column({ type: 'datetime', nullable: true })
  registeredAt?: Date | null;

  @Column({ type: 'datetime', nullable: true })
  cancelledAt?: Date | null;

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

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customerId' })
  customer: User;

  @ManyToOne(() => Partner, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'partnerId' })
  partner?: Partner | null;

  @ManyToOne(() => Product, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'productId' })
  product?: Product | null;

  @ManyToOne(() => ServiceProvider, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'providerId' })
  provider?: ServiceProvider | null;

  @OneToMany(() => ENachMandateStatusHistory, (history) => history.mandate)
  statusHistory: ENachMandateStatusHistory[];
}
