import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

export class RepaymentActionDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(5, 300)
  reason: string;
}
