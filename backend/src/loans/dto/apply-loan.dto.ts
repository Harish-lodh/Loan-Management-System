import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsNumber, IsString, Length, Max, Min } from 'class-validator';
import { EmploymentType } from '../../database/entities/enums';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class ApplyLoanDto {
  @IsNumber()
  @Min(1000)
  @Max(10000000)
  amount: number;

  @IsInt()
  @Min(3)
  @Max(84)
  tenureMonths: number;

  @IsNumber()
  @Min(1000)
  monthlyIncome: number;

  @IsEnum(EmploymentType)
  employmentType: EmploymentType;

  @IsNumber()
  @Min(0)
  existingMonthlyDebt: number;

  @IsInt()
  @Min(300)
  @Max(900)
  creditScore: number;

  @Transform(trim)
  @IsString()
  @Length(5, 240)
  purpose: string;
}
