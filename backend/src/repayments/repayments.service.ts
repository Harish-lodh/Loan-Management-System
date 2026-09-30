import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, LessThan, Repository } from 'typeorm';
import { AuditLogService } from '../audit-log/audit-log.service';
import { assertOrganizationAccess } from '../common/tenancy/organization-scope';
import { RequestUser } from '../common/types/request-user.interface';
import { Loan, Repayment, RepaymentStatus } from '../database/entities';
import { postRepaymentPayment } from './repayment-posting';
import { calculateDaysOverdue } from './repayment-utils';

@Injectable()
export class RepaymentsService {
  private readonly logger = new Logger(RepaymentsService.name);

  constructor(
    @InjectRepository(Repayment)
    private readonly repaymentsRepository: Repository<Repayment>,
    @InjectRepository(Loan)
    private readonly loansRepository: Repository<Loan>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly auditLogService: AuditLogService,
  ) {}

  async updateStatusForAdmin(repaymentId: string, status: RepaymentStatus, adminUser: RequestUser) {
    const repayment = await this.repaymentsRepository.findOne({
      where: { id: repaymentId },
      relations: { loan: true },
    });
    if (!repayment) {
      throw new NotFoundException('Repayment not found');
    }
    assertOrganizationAccess(adminUser, repayment.loan?.organizationId, 'repayment');

    if (status === RepaymentStatus.PAID) {
      const paid = await this.markRepaymentPaid(repayment, adminUser.id);
      await this.auditLogService.create({
        action: 'REPAYMENT_MARKED_PAID',
        entityType: 'Repayment',
        entityId: repayment.id,
        actorUserId: adminUser.id,
        metadata: { organizationId: repayment.loan?.organizationId ?? null, loanId: repayment.loanId, amount: repayment.emiAmount, status },
      });
      return paid;
    }

    if (repayment.status === RepaymentStatus.PAID) {
      throw new BadRequestException('Paid repayments cannot be moved back in this demo flow');
    }

    repayment.status = status;
    repayment.paidAmount = 0;
    repayment.paidAt = null;
    repayment.daysOverdue = status === RepaymentStatus.OVERDUE ? calculateDaysOverdue(repayment.dueDate) : 0;
    repayment.overdueMarkedAt = status === RepaymentStatus.OVERDUE ? (repayment.overdueMarkedAt ?? new Date()) : null;
    const saved = await this.repaymentsRepository.save(repayment);

    await this.auditLogService.create({
      action: 'STATUS_CHANGED',
      entityType: 'Repayment',
      entityId: repayment.id,
      actorUserId: adminUser.id,
      metadata: { organizationId: repayment.loan?.organizationId ?? null, status },
    });

    return saved;
  }

  async refreshOverdueRepayments() {
    const dueRepayments = await this.repaymentsRepository.find({
      where: {
        status: In([RepaymentStatus.PENDING, RepaymentStatus.OVERDUE]),
        dueDate: LessThan(new Date()),
      },
    });

    let newlyOverdue = 0;
    const now = new Date();

    for (const repayment of dueRepayments) {
      const wasPending = repayment.status === RepaymentStatus.PENDING;
      repayment.status = RepaymentStatus.OVERDUE;
      repayment.daysOverdue = calculateDaysOverdue(repayment.dueDate, now);
      repayment.overdueMarkedAt = repayment.overdueMarkedAt ?? now;

      await this.repaymentsRepository.save(repayment);

      if (wasPending) {
        newlyOverdue += 1;
        await this.auditLogService.create({
          action: 'STATUS_CHANGED',
          entityType: 'Repayment',
          entityId: repayment.id,
          actorUserId: null,
          metadata: { status: RepaymentStatus.OVERDUE, daysOverdue: repayment.daysOverdue },
        });
      }
    }

    if (newlyOverdue) {
      this.logger.log(`Marked ${newlyOverdue} repayment(s) as overdue`);
    }
    return newlyOverdue;
  }

  private async markRepaymentPaid(repayment: Repayment, actorUserId: string) {
    return this.dataSource.transaction(async (manager) => {
      // Detach the loaded relation so saving the repayment does not also save a stale loan copy.
      const { loan: _loan, ...plain } = repayment;
      const fresh = manager.create(Repayment, plain);
      const result = await postRepaymentPayment(manager, fresh, { actorUserId, source: 'MANUAL' });
      return result.repayment;
    });
  }
}
