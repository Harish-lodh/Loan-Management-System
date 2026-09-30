import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { Loan, LoanApplication, Notification, Repayment } from '../database/entities';
import { NotificationsModule } from '../notifications/notifications.module';
import { LoansService } from './loans.service';

@Module({
  imports: [TypeOrmModule.forFeature([LoanApplication, Loan, Repayment, Notification]), AuditLogModule, NotificationsModule],
  providers: [LoansService],
  exports: [LoansService],
})
export class LoansModule {}
