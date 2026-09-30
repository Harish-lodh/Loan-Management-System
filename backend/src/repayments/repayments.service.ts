import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, LessThan, Repository } from 'typeorm';
import { AuditLogService } from '../audit-log/audit-log.service';
import { assertOrganizationAccess } from '../common/tenancy/organization-scope';
import { RequestUser } from '../common/types/request-user.interface';
import { Loan, LoanStatus, Repayment, RepaymentStatus } from '../database/entities';
import { roundMoney } from '../loans/loan-calculations';
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
      repayment.status = RepaymentStatus.PAID;
      repayment.paidAmount = repayment.emiAmount;
      repayment.paidAt = new Date();
      repayment.daysOverdue = 0;
      const savedRepayment = await manager.save(Repayment, repayment);

      const loan = repayment.loan ?? (await manager.findOneByOrFail(Loan, { id: repayment.loanId }));
      loan.outstandingBalance = roundMoney(Math.max(0, Number(loan.outstandingBalance) - repayment.principalComponent));

      const actualRemaining = await manager.count(Repayment, {
        where: { loanId: repayment.loanId },
      });
      const paidCount = await manager.count(Repayment, {
        where: { loanId: repayment.loanId, status: RepaymentStatus.PAID },
      });

      if (actualRemaining > 0 && paidCount === actualRemaining) {
        loan.status = LoanStatus.CLOSED;
        loan.closedAt = new Date();
        loan.outstandingBalance = 0;
        loan.statusHistory = [
          ...(loan.statusHistory ?? []),
          {
            status: LoanStatus.CLOSED,
            changedAt: new Date().toISOString(),
            actorUserId,
            comment: 'All repayments completed',
          },
        ];
      }

      await manager.save(Loan, loan);
      return savedRepayment;
    });
  }
}
