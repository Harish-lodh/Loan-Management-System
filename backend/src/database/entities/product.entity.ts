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
  VersionColumn,
} from 'typeorm';
import {
  FeeType,
  InterestCalculationMethod,
  InterestType,
  MasterStatus,
  ProductType,
  RepaymentFrequency,
  TenureUnit,
} from './enums';
import { Organization } from './organization.entity';
import { PartnerProduct } from './partner-product.entity';
import { ProductApplicationField } from './product-application-field.entity';
import { ProductEligibilityRule } from './product-eligibility-rule.entity';
import { ProductVersion } from './product-version.entity';
import { ProductWorkflowStep } from './product-workflow-step.entity';

@Entity('products')
@Index(['organizationId', 'productCode'], { unique: true })
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  organizationId: string;

  @Column({ length: 50 })
  productCode: string;

  @Column({ length: 140 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Index()
  @Column({ type: 'enum', enum: ProductType })
  productType: ProductType;

  @Index()
  @Column({ type: 'enum', enum: MasterStatus, default: MasterStatus.DRAFT })
  status: MasterStatus;

  @Column({ type: 'int', default: 1 })
  version: number;

  @Column({ type: 'datetime', nullable: true })
  effectiveFrom?: Date | null;

  @Column({ type: 'datetime', nullable: true })
  effectiveTo?: Date | null;

  @Column({ length: 3, default: 'INR' })
  currency: string;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  minimumLoanAmount: string;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  maximumLoanAmount: string;

  @Column({ type: 'int' })
  minimumTenure: number;

  @Column({ type: 'int' })
  maximumTenure: number;

  @Column({ type: 'enum', enum: TenureUnit, default: TenureUnit.MONTHS })
  tenureUnit: TenureUnit;

  @Column({ type: 'enum', enum: RepaymentFrequency, default: RepaymentFrequency.MONTHLY })
  repaymentFrequency: RepaymentFrequency;

  @Column({ type: 'enum', enum: InterestType, default: InterestType.FIXED })
  interestType: InterestType;

  @Column({ type: 'enum', enum: InterestCalculationMethod, default: InterestCalculationMethod.REDUCING_BALANCE })
  interestCalculationMethod: InterestCalculationMethod;

  @Column({ type: 'decimal', precision: 8, scale: 4 })
  minimumInterestRate: string;

  @Column({ type: 'decimal', precision: 8, scale: 4 })
  maximumInterestRate: string;

  @Column({ type: 'decimal', precision: 8, scale: 4 })
  defaultInterestRate: string;

  @Column({ type: 'enum', enum: FeeType, default: FeeType.PERCENTAGE })
  processingFeeType: FeeType;

  @Column({ type: 'decimal', precision: 12, scale: 4, default: 0 })
  processingFeeValue: string;

  @Column({ type: 'json', nullable: true })
  lateFeeConfiguration?: Record<string, unknown> | null;

  @Column({ type: 'int', default: 0 })
  gracePeriodDays: number;

  @Column({ type: 'int', nullable: true })
  minimumAge?: number | null;

  @Column({ type: 'int', nullable: true })
  maximumAge?: number | null;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  minimumIncome?: string | null;

  @Column({ type: 'int', nullable: true })
  requiredCreditScore?: number | null;

  @Column({ default: true })
  requiresKyc: boolean;

  @Column({ default: false })
  requiresBankVerification: boolean;

  @Column({ default: false })
  requiresENach: boolean;

  @Column({ default: false })
  requiresESign: boolean;

  @Column({ default: true })
  requiresAgreement: boolean;

  @Column({ default: true })
  requiresManualApproval: boolean;

  @Column({ default: true })
  allowsPrepayment: boolean;

  @Column({ default: false })
  allowsPartPayment: boolean;

  @Column({ type: 'json', nullable: true })
  chargeConfiguration?: Record<string, unknown>[] | null;

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  createdBy?: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  updatedBy?: string | null;

  @VersionColumn()
  lockVersion: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Organization, (organization) => organization.products, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization: Organization;

  @OneToMany(() => ProductVersion, (version) => version.product)
  versions: ProductVersion[];

  @OneToMany(() => ProductApplicationField, (field) => field.product)
  applicationFields: ProductApplicationField[];

  @OneToMany(() => ProductEligibilityRule, (rule) => rule.product)
  eligibilityRules: ProductEligibilityRule[];

  @OneToMany(() => ProductWorkflowStep, (step) => step.product)
  workflowSteps: ProductWorkflowStep[];

  @OneToMany(() => PartnerProduct, (partnerProduct) => partnerProduct.product)
  partnerMappings: PartnerProduct[];
}
