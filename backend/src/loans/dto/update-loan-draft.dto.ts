import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { EmploymentType } from '../../database/entities/enums';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class UpdateLoanDraftDto {
  @IsOptional()
  @IsNumber()
  @Min(1000)
  @Max(10000000)
  amount?: number;

  @IsOptional()
  @IsInt()
  @Min(3)
  @Max(84)
  tenureMonths?: number;

  @IsOptional()
  @IsNumber()
  @Min(1000)
  monthlyIncome?: number;

  @IsOptional()
  @IsEnum(EmploymentType)
  employmentType?: EmploymentType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  existingMonthlyDebt?: number;

  @IsOptional()
  @IsInt()
  @Min(300)
  @Max(900)
  creditScore?: number;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(5, 240)
  purpose?: string;
}
