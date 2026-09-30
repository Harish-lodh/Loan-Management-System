import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import {
  Customer,
  Loan,
  PaymentCollectionRequest,
  PaymentCollectionStatusHistory,
  Repayment,
  RolePermission,
  ServiceProvider,
  UserRole,
} from '../database/entities';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentCollectionController, PaymentCollectionStatusController, PaymentWebhookController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { EasebuzzProvider } from './providers/easebuzz.provider';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PaymentCollectionRequest,
      PaymentCollectionStatusHistory,
      Repayment,
      Loan,
      Customer,
      ServiceProvider,
      UserRole,
      RolePermission,
    ]),
    HttpModule,
    AuditLogModule,
    NotificationsModule,
  ],
  controllers: [PaymentCollectionController, PaymentCollectionStatusController, PaymentWebhookController],
  providers: [PaymentsService, EasebuzzProvider, PermissionsGuard],
})
export class PaymentsModule {}
