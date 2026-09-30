import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { Loan, LoanApplication, Repayment } from '../database/entities';
import { LoansService } from './loans.service';

@Module({
  imports: [TypeOrmModule.forFeature([LoanApplication, Loan, Repayment]), AuditLogModule],
  providers: [LoansService],
  exports: [LoansService],
})
export class LoansModule {}
