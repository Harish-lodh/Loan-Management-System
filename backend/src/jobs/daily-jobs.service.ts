import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { CreditOperationsService } from '../repayments/credit-operations.service';
import { RepaymentsService } from '../repayments/repayments.service';

// End-of-day batch. Each NBFC instance runs its own copy against its own database.
@Injectable()
export class DailyJobsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DailyJobsService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly repaymentsService: RepaymentsService,
    private readonly creditOperations: CreditOperationsService,
  ) {}

  async onApplicationBootstrap() {
    // Catch up if the server was down when the nightly job should have run.
    if (this.enabled) {
      await this.runEndOfDay();
    }
  }

  @Cron('30 0 * * *', { name: 'end-of-day', timeZone: 'Asia/Kolkata' })
  async nightly() {
    if (this.enabled) {
      await this.runEndOfDay();
    }
  }

  // Order matters: overdue status and days first, then charges that depend on them, then DPD classification.
  async runEndOfDay() {
    await this.step('mark overdue repayments', () => this.repaymentsService.refreshOverdueRepayments());
    await this.step('apply late fees', () => this.creditOperations.applyLateFees());
    await this.step('refresh DPD and asset classification', () => this.creditOperations.refreshPortfolioRisk());
  }

  private async step(name: string, run: () => Promise<unknown>) {
    try {
      await run();
    } catch (error) {
      this.logger.error(`End-of-day step failed: ${name}`, error instanceof Error ? error.stack : String(error));
    }
  }

  private get enabled() {
    return this.config.get<string>('ENABLE_SCHEDULER') !== 'false';
  }
}
