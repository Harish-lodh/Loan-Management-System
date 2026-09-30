import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, Length, Matches, MinLength } from 'class-validator';
import { ASSIGNABLE_STAFF_ROLES, AssignableStaffRole } from '../../common/auth/role-permissions';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateStaffUserDto {
  @Transform(trim)
  @IsString()
  @Length(2, 80)
  name: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  email: string;

  @Transform(trim)
  @IsString()
  @Matches(/^[0-9+\-\s()]{7,20}$/, { message: 'phone must be a valid phone number' })
  phone: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: 'password must contain at least one letter and one number',
  })
  password: string;

  @IsIn(ASSIGNABLE_STAFF_ROLES)
  role: AssignableStaffRole;

  @IsOptional()
  @IsString()
  organizationId?: string;
}

export class UpdateStaffUserDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(2, 80)
  name?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Matches(/^[0-9+\-\s()]{7,20}$/, { message: 'phone must be a valid phone number' })
  phone?: string;

  @IsOptional()
  @IsIn(ASSIGNABLE_STAFF_ROLES)
  role?: AssignableStaffRole;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AssignStaffRoleDto {
  @IsString()
  organizationId: string;

  @Transform(trim)
  @IsString()
  @Length(2, 80)
  roleName: string;
}
