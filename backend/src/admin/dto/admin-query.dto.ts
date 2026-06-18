import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { LoanApplicationStatus, RepaymentStatus } from '../../database/entities';

export class AdminUsersQueryDto extends PaginationQueryDto {}

export class AdminLoanApplicationsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(LoanApplicationStatus)
  status?: LoanApplicationStatus;
}

export class AdminRepaymentsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(RepaymentStatus)
  status?: RepaymentStatus;
}
