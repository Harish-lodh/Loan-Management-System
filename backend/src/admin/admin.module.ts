import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Loan, LoanApplication, Repayment, User, UserRole } from '../database/entities';
import { LoansModule } from '../loans/loans.module';
import { RepaymentsModule } from '../repayments/repayments.module';
import { UsersModule } from '../users/users.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserRole, LoanApplication, Loan, Repayment]),
    LoansModule,
    RepaymentsModule,
    UsersModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
