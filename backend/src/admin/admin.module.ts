import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Customer, Loan, LoanApplication, Repayment, RolePermission, User, UserRole } from '../database/entities';
import { LoansModule } from '../loans/loans.module';
import { RepaymentsModule } from '../repayments/repayments.module';
import { UsersModule } from '../users/users.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserRole, RolePermission, Customer, LoanApplication, Loan, Repayment]),
    AuditLogModule,
    LoansModule,
    RepaymentsModule,
    UsersModule,
  ],
  controllers: [AdminController],
  providers: [AdminService, PermissionsGuard],
})
export class AdminModule {}
