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
import { ESignRequestStatus } from './enums';
import { ESignStatusHistory } from './esign-status-history.entity';
import { GeneratedDocument } from './generated-document.entity';
import { LoanApplication } from './loan-application.entity';
import { Loan } from './loan.entity';
import { Partner } from './partner.entity';
import { Product } from './product.entity';
import { ServiceProvider } from './service-provider.entity';
import { Customer } from './customer.entity';

@Entity('esign_requests')
export class ESignRequest {
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

  @Index()
  @Column()
  agreementDocumentId: string;

  @Index({ unique: true })
  @Column({ length: 120 })
  providerRequestId: string;

  @Column({ type: 'varchar', length: 700, nullable: true })
  signingUrl?: string | null;

  @Index()
  @Column({ type: 'enum', enum: ESignRequestStatus, default: ESignRequestStatus.PENDING })
  status: ESignRequestStatus;

  @Column({ type: 'varchar', length: 80, nullable: true })
  providerStatus?: string | null;

  @Column({ type: 'datetime', nullable: true })
  expiresAt?: Date | null;

  @Column({ type: 'datetime', nullable: true })
  signedAt?: Date | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  failureCode?: string | null;

  @Column({ type: 'text', nullable: true })
  failureReason?: string | null;

  @Column({ type: 'json', nullable: true })
  providerRequest?: Record<string, unknown> | null;

  @Column({ type: 'json', nullable: true })
  providerResponse?: Record<string, unknown> | null;

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

  @ManyToOne(() => GeneratedDocument, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'agreementDocumentId' })
  agreementDocument: GeneratedDocument;

  @OneToMany(() => ESignStatusHistory, (history) => history.esignRequest)
  statusHistory: ESignStatusHistory[];
}
