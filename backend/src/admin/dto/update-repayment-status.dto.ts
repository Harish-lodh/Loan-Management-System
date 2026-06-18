import { IsEnum } from 'class-validator';
import { RepaymentStatus } from '../../database/entities';

export class UpdateRepaymentStatusDto {
  @IsEnum(RepaymentStatus)
  status: RepaymentStatus;
}
