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
import { MasterStatus, PartnerType } from './enums';
import { Organization } from './organization.entity';
import { PartnerProduct } from './partner-product.entity';

@Entity('partners')
@Index(['organizationId', 'partnerCode'], { unique: true })
export class Partner {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  organizationId: string;

  @Column({ length: 50 })
  partnerCode: string;

  @Column({ length: 140 })
  name: string;

  @Column({ length: 180 })
  legalName: string;

  @Index()
  @Column({ type: 'enum', enum: PartnerType })
  partnerType: PartnerType;

  @Index()
  @Column({ type: 'enum', enum: MasterStatus, default: MasterStatus.ACTIVE })
  status: MasterStatus;

  @Column({ type: 'varchar', length: 160, nullable: true })
  email?: string | null;

  @Column({ type: 'varchar', length: 24, nullable: true })
  phone?: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  pan?: string | null;

  @Column({ type: 'varchar', length: 24, nullable: true })
  gstin?: string | null;

  @Column({ type: 'text', nullable: true })
  address?: string | null;

  @Column({ type: 'json', nullable: true })
  contactPerson?: Record<string, unknown> | null;

  @Column({ type: 'json', nullable: true })
  settlementConfiguration?: Record<string, unknown> | null;

  @Column({ type: 'json', nullable: true })
  commissionConfiguration?: Record<string, unknown> | null;

  @Column({ type: 'json', nullable: true })
  providerConfiguration?: Record<string, unknown> | null;

  @Column({ type: 'json', nullable: true })
  requiredCustomerFields?: Record<string, unknown>[] | null;

  @Column({ type: 'json', nullable: true })
  requiredDocuments?: Record<string, unknown>[] | null;

  @Column({ type: 'json', nullable: true })
  workflowOverrides?: Record<string, unknown> | null;

  @Column({ type: 'json', nullable: true, select: false })
  apiCredentialReference?: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  createdBy?: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  updatedBy?: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Organization, (organization) => organization.partners, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization: Organization;

  @OneToMany(() => PartnerProduct, (partnerProduct) => partnerProduct.partner)
  productMappings: PartnerProduct[];
}
