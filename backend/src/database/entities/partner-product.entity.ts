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

  @Column({ type: 'enum', enum: MasterStatus, default: MasterStatus.ACTIVE })
  status: MasterStatus;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  minimumLoanAmount?: string | null;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  maximumLoanAmount?: string | null;

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
