import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { Loan, Repayment } from '../database/entities';
import { RepaymentsService } from './repayments.service';

@Module({
  imports: [TypeOrmModule.forFeature([Loan, Repayment]), AuditLogModule],
  providers: [RepaymentsService],
  exports: [RepaymentsService],
})
export class RepaymentsModule {}
