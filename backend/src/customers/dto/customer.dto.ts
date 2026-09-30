import { PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDateString, IsEmail, IsEnum, IsNumber, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { CustomerStatus, EmploymentType } from '../../database/entities';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const emptyToUndefined = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

export class CreateCustomerDto {
  @Transform(trim)
  @IsString()
  @Length(2, 120)
  fullName: string;

  @Transform(trim)
  @IsString()
  @Matches(/^[0-9+\-\s()]{7,20}$/, { message: 'phone must be a valid phone number' })
  phone: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : undefined))
  @IsEmail()
  email?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @Matches(/^[A-Za-z]{5}[0-9]{4}[A-Za-z]$/, { message: 'pan must be a valid PAN (e.g. ABCDE1234F)' })
  pan?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @Length(1, 20)
  gender?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @Length(1, 255)
  addressLine?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @Length(1, 80)
  city?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @Length(1, 80)
  state?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @Matches(/^[0-9]{6}$/, { message: 'pincode must be 6 digits' })
  pincode?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @Length(1, 80)
  occupation?: string;

  @IsOptional()
  @IsEnum(EmploymentType)
  employmentType?: EmploymentType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000_000)
  monthlyIncome?: number;

  // Only honoured for SUPER_ADMIN, who is not bound to a single organization.
  @IsOptional()
  @IsString()
  organizationId?: string;
}

export class UpdateCustomerDto extends PartialType(CreateCustomerDto) {
  @IsOptional()
  @IsEnum(CustomerStatus)
  status?: CustomerStatus;
}

export class CustomersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(CustomerStatus)
  status?: CustomerStatus;
}
