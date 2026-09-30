import { Transform } from 'class-transformer';
import { IsOptional, IsString, Length, Matches } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class UpdateProfileDto {
  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(2, 80)
  name?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @Matches(/^[0-9+\-\s()]{7,20}$/, { message: 'phone must be a valid phone number' })
  phone?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(0, 180)
  address?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(0, 80)
  occupation?: string;
}
