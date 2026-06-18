import { IsNumber, IsOptional, Max, Min } from 'class-validator';

export class CalculateEmiDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(60)
  annualInterestRate?: number;
}
