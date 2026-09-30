import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { RepaymentsService } from '../repayments/repayments.service';

// End-of-day batch. Each NBFC instance runs its own copy against its own database.
@Injectable()
export class DailyJobsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DailyJobsService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly repaymentsService: RepaymentsService,
  ) {}

  async onApplicationBootstrap() {
    // Catch up if the server was down when the nightly job should have run.
    if (this.enabled) {
      await this.markOverdueRepayments();
    }
  }

  @Cron('30 0 * * *', { name: 'mark-overdue-repayments', timeZone: 'Asia/Kolkata' })
  async nightly() {
    if (this.enabled) {
      await this.markOverdueRepayments();
    }
  }

  private async markOverdueRepayments() {
    try {
      await this.repaymentsService.refreshOverdueRepayments();
    } catch (error) {
      this.logger.error('Overdue repayment job failed', error instanceof Error ? error.stack : String(error));
    }
  }

  private get enabled() {
    return this.config.get<string>('ENABLE_SCHEDULER') !== 'false';
  }
}
