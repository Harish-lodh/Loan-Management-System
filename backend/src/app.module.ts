import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AdminModule } from './admin/admin.module';
import { AuditLogModule } from './audit-log/audit-log.module';
import { AuthModule } from './auth/auth.module';
import { CustomersModule } from './customers/customers.module';
import { DatabaseModule } from './database/database.module';
import { JobsModule } from './jobs/jobs.module';
import { LendingPlatformModule } from './lending-platform/lending-platform.module';
import { LoansModule } from './loans/loans.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PaymentsModule } from './payments/payments.module';
import { RepaymentsModule } from './repayments/repayments.module';
import { StorageModule } from './storage/storage.module';
import { TenantModule } from './tenant/tenant.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // ENV_FILE lets each NBFC instance on a shared server load its own settings (see deploy/README.md).
      envFilePath: [process.env.ENV_FILE, 'backend/.env', '.env'].filter((file): file is string => Boolean(file)),
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 100,
      },
    ]),
    DatabaseModule,
    StorageModule,
    AuditLogModule,
    UsersModule,
    AuthModule,
    CustomersModule,
    LendingPlatformModule,
    LoansModule,
    RepaymentsModule,
    NotificationsModule,
    PaymentsModule,
    AdminModule,
    TenantModule,
    JobsModule,
  ],
})
export class AppModule {}
