import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { Loan, Product, Repayment } from '../database/entities';
import { CreditOperationsService } from './credit-operations.service';
import { RepaymentsService } from './repayments.service';

@Module({
  imports: [TypeOrmModule.forFeature([Loan, Repayment, Product]), AuditLogModule],
  providers: [RepaymentsService, CreditOperationsService],
  exports: [RepaymentsService, CreditOperationsService],
})
export class RepaymentsModule {}
