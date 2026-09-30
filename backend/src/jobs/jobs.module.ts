import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { RepaymentsModule } from '../repayments/repayments.module';
import { DailyJobsService } from './daily-jobs.service';

@Module({
  imports: [ScheduleModule.forRoot(), RepaymentsModule],
  providers: [DailyJobsService],
})
export class JobsModule {}
