import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { Loan, Repayment } from '../database/entities';
import { NotificationsModule } from '../notifications/notifications.module';
import { RepaymentsController } from './repayments.controller';
import { RepaymentsService } from './repayments.service';

@Module({
  imports: [TypeOrmModule.forFeature([Loan, Repayment]), AuditLogModule, NotificationsModule],
  controllers: [RepaymentsController],
  providers: [RepaymentsService],
  exports: [RepaymentsService],
})
export class RepaymentsModule {}
