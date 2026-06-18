import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Loan, LoanApplication, Repayment, User } from '../database/entities';
import { LoansModule } from '../loans/loans.module';
import { RepaymentsModule } from '../repayments/repayments.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, LoanApplication, Loan, Repayment]),
    LoansModule,
    RepaymentsModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
