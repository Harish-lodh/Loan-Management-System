import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

export class RejectLoanDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(5, 500)
  comment: string;
}
