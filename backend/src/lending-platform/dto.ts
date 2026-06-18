import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  ApplicationFieldType,
  DocumentType,
  FeeType,
  InterestCalculationMethod,
  InterestType,
  MasterStatus,
  PartnerType,
  ProductType,
  ProviderType,
  RepaymentFrequency,
  TenureUnit,
} from '../database/entities';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateOrganizationDto {
  @Transform(trim)
  @IsString()
  @Length(2, 40)
  organizationCode: string;

  @Transform(trim)
  @IsString()
  @Length(2, 120)
  name: string;

  @Transform(trim)
  @IsString()
  @Length(2, 180)
  legalName: string;

  @IsOptional()
  @IsString()
  cin?: string;

  @IsOptional()
  @IsString()
  rbiRegistrationNumber?: string;

  @IsOptional()
  @IsString()
  pan?: string;

  @IsOptional()
  @IsString()
  gstin?: string;

  @IsOptional()
  @IsString()
  registeredAddress?: string;

  @IsOptional()
  @IsObject()
  supportDetails?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  defaultCurrency?: string;

  @IsOptional()
  @IsString()
  timeZone?: string;

  @IsOptional()
  @IsEnum(MasterStatus)
  status?: MasterStatus;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsObject()
  authorizedSignatory?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  bankConfiguration?: Record<string, unknown>;
}

export class CreateServiceProviderDto {
  @IsString()
  organizationId: string;

  @Transform(trim)
  @IsString()
  @Length(2, 60)
  providerCode: string;

  @Transform(trim)
  @IsString()
  @Length(2, 140)
  providerName: string;

  @IsEnum(ProviderType)
  providerType: ProviderType;

  @IsOptional()
  @IsEnum(MasterStatus)
  status?: MasterStatus;

  @IsOptional()
  @IsBoolean()
  isSandbox?: boolean;

  @IsOptional()
  @IsString()
  baseUrl?: string;

  @IsOptional()
  @IsString()
  credentialReference?: string;

  @IsOptional()
  @IsString()
  webhookSecretReference?: string;

  @IsOptional()
  @IsArray()
  supportedCapabilities?: string[];

  @IsOptional()
  @IsObject()
  configuration?: Record<string, unknown>;
}

export class CreateProductDto {
  @IsString()
  organizationId: string;

  @Transform(trim)
  @IsString()
  @Length(2, 50)
  productCode: string;

  @Transform(trim)
  @IsString()
  @Length(2, 140)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(ProductType)
  productType: ProductType;

  @IsOptional()
  @IsEnum(MasterStatus)
  status?: MasterStatus;

  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsNumber()
  @Min(1)
  minimumLoanAmount: number;

  @IsNumber()
  @Min(1)
  maximumLoanAmount: number;

  @IsInt()
  @Min(1)
  minimumTenure: number;

  @IsInt()
  @Min(1)
  maximumTenure: number;

  @IsOptional()
  @IsEnum(TenureUnit)
  tenureUnit?: TenureUnit;

  @IsOptional()
  @IsEnum(RepaymentFrequency)
  repaymentFrequency?: RepaymentFrequency;

  @IsOptional()
  @IsEnum(InterestType)
  interestType?: InterestType;

  @IsOptional()
  @IsEnum(InterestCalculationMethod)
  interestCalculationMethod?: InterestCalculationMethod;

  @IsNumber()
  @Min(0)
  minimumInterestRate: number;

  @IsNumber()
  @Min(0)
  maximumInterestRate: number;

  @IsNumber()
  @Min(0)
  defaultInterestRate: number;

  @IsOptional()
  @IsEnum(FeeType)
  processingFeeType?: FeeType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  processingFeeValue?: number;

  @IsOptional()
  @IsObject()
  lateFeeConfiguration?: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  @Min(0)
  gracePeriodDays?: number;

  @IsOptional()
  @IsInt()
  @Min(18)
  minimumAge?: number;

  @IsOptional()
  @IsInt()
  @Max(100)
  maximumAge?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumIncome?: number;

  @IsOptional()
  @IsInt()
  @Min(300)
  @Max(900)
  requiredCreditScore?: number;

  @IsOptional()
  @IsBoolean()
  requiresKyc?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresBankVerification?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresENach?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresESign?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresAgreement?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresManualApproval?: boolean;

  @IsOptional()
  @IsBoolean()
  allowsPrepayment?: boolean;

  @IsOptional()
  @IsBoolean()
  allowsPartPayment?: boolean;

  @IsOptional()
  @IsArray()
  chargeConfiguration?: Record<string, unknown>[];

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateProductDto extends CreateProductDto {
  @IsOptional()
  organizationId: string;

  @IsOptional()
  productCode: string;

  @IsOptional()
  name: string;

  @IsOptional()
  productType: ProductType;

  @IsOptional()
  minimumLoanAmount: number;

  @IsOptional()
  maximumLoanAmount: number;

  @IsOptional()
  minimumTenure: number;

  @IsOptional()
  maximumTenure: number;

  @IsOptional()
  minimumInterestRate: number;

  @IsOptional()
  maximumInterestRate: number;

  @IsOptional()
  defaultInterestRate: number;
}

export class CreateApplicationFieldDto {
  @Transform(trim)
  @IsString()
  @Length(2, 80)
  fieldKey: string;

  @Transform(trim)
  @IsString()
  @Length(2, 120)
  label: string;

  @IsEnum(ApplicationFieldType)
  fieldType: ApplicationFieldType;

  @IsOptional()
  @IsString()
  placeholder?: string;

  @IsOptional()
  @IsString()
  helpText?: string;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsInt()
  displayOrder?: number;

  @IsOptional()
  defaultValue?: unknown;

  @IsOptional()
  @IsObject()
  validationRules?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  options?: Record<string, unknown>[];

  @IsOptional()
  @IsObject()
  visibilityConditions?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  editableStatuses?: string[];

  @IsOptional()
  @IsBoolean()
  sensitive?: boolean;
}

export class CreateEligibilityRuleDto {
  @Transform(trim)
  @IsString()
  @Length(2, 80)
  ruleCode: string;

  @Transform(trim)
  @IsString()
  @Length(2, 140)
  name: string;

  @IsObject()
  ruleDefinition: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  score?: number;

  @IsOptional()
  @IsString()
  failureReason?: string;
}

export class CreateWorkflowStepDto {
  @Transform(trim)
  @IsString()
  @Length(2, 80)
  stepKey: string;

  @Transform(trim)
  @IsString()
  @Length(2, 120)
  label: string;

  @IsString()
  status: string;

  @IsOptional()
  @IsInt()
  displayOrder?: number;

  @IsOptional()
  @IsObject()
  requiredWhen?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  actorRole?: string;
}

export class CreatePartnerDto {
  @IsString()
  organizationId: string;

  @Transform(trim)
  @IsString()
  @Length(2, 50)
  partnerCode: string;

  @Transform(trim)
  @IsString()
  @Length(2, 140)
  name: string;

  @Transform(trim)
  @IsString()
  @Length(2, 180)
  legalName: string;

  @IsEnum(PartnerType)
  partnerType: PartnerType;

  @IsOptional()
  @IsEnum(MasterStatus)
  status?: MasterStatus;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  pan?: string;

  @IsOptional()
  @IsString()
  gstin?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsObject()
  contactPerson?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  settlementConfiguration?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  commissionConfiguration?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  providerConfiguration?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  requiredCustomerFields?: Record<string, unknown>[];

  @IsOptional()
  @IsArray()
  requiredDocuments?: Record<string, unknown>[];

  @IsOptional()
  @IsObject()
  workflowOverrides?: Record<string, unknown>;
}

export class UpdatePartnerDto extends CreatePartnerDto {
  @IsOptional()
  organizationId: string;

  @IsOptional()
  partnerCode: string;

  @IsOptional()
  name: string;

  @IsOptional()
  legalName: string;

  @IsOptional()
  partnerType: PartnerType;
}

export class AssignPartnerProductDto {
  @IsString()
  productId: string;

  @IsOptional()
  @IsString()
  productVersionId?: string;

  @IsOptional()
  @IsBoolean()
  requiresKyc?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresBankVerification?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresDocumentVerification?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresManualApproval?: boolean;

  @IsOptional()
  @IsBoolean()
  allowsAutomatedApproval?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresAgreement?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresESign?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresENach?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresDisbursementConfirmation?: boolean;

  @IsOptional()
  @IsString()
  esignProviderId?: string;

  @IsOptional()
  @IsString()
  enachProviderId?: string;

  @IsOptional()
  @IsString()
  disbursementProviderId?: string;

  @IsOptional()
  @IsString()
  workflowDefinitionId?: string;

  @IsOptional()
  @IsNumber()
  minimumLoanAmount?: number;

  @IsOptional()
  @IsNumber()
  maximumLoanAmount?: number;

  @IsOptional()
  @IsNumber()
  interestRateOverride?: number;

  @IsOptional()
  @IsObject()
  feeOverrides?: Record<string, unknown>;
}

class ApplicantDto {
  @IsNumber()
  @Min(1000)
  monthlyIncome: number;

  @IsNumber()
  @Min(0)
  existingMonthlyDebt: number;

  @IsString()
  employmentType: string;

  @IsInt()
  @Min(300)
  @Max(900)
  creditScore: number;

  @IsString()
  @Length(3, 240)
  purpose: string;
}

export class CreateConfigurableApplicationDto {
  @IsString()
  productId: string;

  @IsOptional()
  @IsString()
  partnerId?: string;

  @IsNumber()
  @Min(1)
  requestedAmount: number;

  @IsInt()
  @Min(1)
  tenure: number;

  @ValidateNested()
  @Type(() => ApplicantDto)
  applicant: ApplicantDto;

  @IsOptional()
  @IsObject()
  dynamicFields?: Record<string, unknown>;
}

export class UpdateConfigurableApplicationDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  requestedAmount?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  tenure?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => ApplicantDto)
  applicant?: ApplicantDto;

  @IsOptional()
  @IsObject()
  dynamicFields?: Record<string, unknown>;
}

export class DecisionDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  approvedAmount?: number;

  @IsOptional()
  @IsString()
  comments?: string;
}

export class CreateDocumentTemplateDto {
  @IsString()
  organizationId: string;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  partnerId?: string;

  @IsEnum(DocumentType)
  documentType: DocumentType;

  @IsOptional()
  @IsString()
  language?: string;

  @IsString()
  @Length(2, 160)
  title: string;

  @IsString()
  templateHtml: string;

  @IsOptional()
  @IsArray()
  allowedPlaceholders?: string[];
}

export class PreviewTemplateDto {
  @IsObject()
  sampleData: Record<string, unknown>;
}

export class ProviderWebhookDto {
  @IsString()
  eventId: string;

  @IsString()
  referenceId: string;

  @IsString()
  status: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
