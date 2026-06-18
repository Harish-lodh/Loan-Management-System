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
import { MasterStatus } from './enums';
import { Partner } from './partner.entity';
import { Product } from './product.entity';

@Entity('partner_products')
@Index(['partnerId', 'productId'], { unique: true })
export class PartnerProduct {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  partnerId: string;

  @Index()
  @Column()
  productId: string;

  @Index()
  @Column({ type: 'varchar', length: 36, nullable: true })
  productVersionId?: string | null;

  @Column({ type: 'enum', enum: MasterStatus, default: MasterStatus.ACTIVE })
  status: MasterStatus;

  @Column({ default: true })
  requiresKyc: boolean;

  @Column({ default: false })
  requiresBankVerification: boolean;

  @Column({ default: false })
  requiresDocumentVerification: boolean;

  @Column({ default: true })
  requiresManualApproval: boolean;

  @Column({ default: false })
  allowsAutomatedApproval: boolean;

  @Column({ default: true })
  requiresAgreement: boolean;

  @Column({ default: false })
  requiresESign: boolean;

  @Column({ default: false })
  requiresENach: boolean;

  @Column({ default: false })
  requiresDisbursementConfirmation: boolean;

  @Column({ type: 'varchar', length: 36, nullable: true })
  esignProviderId?: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  enachProviderId?: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  kycProviderId?: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  disbursementProviderId?: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  workflowDefinitionId?: string | null;

  @Column({ type: 'datetime', nullable: true })
  effectiveFrom?: Date | null;

  @Column({ type: 'datetime', nullable: true })
  effectiveTo?: Date | null;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  minimumLoanAmount?: string | null;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  maximumLoanAmount?: string | null;

  @Column({ type: 'decimal', precision: 8, scale: 4, nullable: true })
  interestRateOverride?: string | null;

  @Column({ type: 'json', nullable: true })
  interestOverrides?: Record<string, unknown> | null;

  @Column({ type: 'json', nullable: true })
  feeOverrides?: Record<string, unknown> | null;

  @Column({ type: 'json', nullable: true })
  workflowOverrides?: Record<string, unknown> | null;

  @Column({ type: 'json', nullable: true })
  allowedProviderIds?: string[] | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Partner, (partner) => partner.productMappings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'partnerId' })
  partner: Partner;

  @ManyToOne(() => Product, (product) => product.partnerMappings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product: Product;
}
