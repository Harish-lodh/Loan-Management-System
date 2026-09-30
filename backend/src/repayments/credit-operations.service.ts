import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, IsNull, Repository } from 'typeorm';
import { AuditLogService } from '../audit-log/audit-log.service';
import { assertOrganizationAccess } from '../common/tenancy/organization-scope';
import { RequestUser } from '../common/types/request-user.interface';
import {
  Loan,
  LoanStatus,
  Product,
  Repayment,
  RepaymentLedgerEntry,
  RepaymentLedgerTransactionType,
  RepaymentStatus,
} from '../database/entities';
import { addMoney, moneyToString, subtractMoney } from '../lending-platform/money.util';
import { refreshLoanRisk } from './credit-risk';

type ChargeKind = 'LATE_FEE' | 'BOUNCE_CHARGE';

// Late fees, bounce charges, waivers and the nightly DPD / asset classification run.
// Charges are flat amounts configured on the product (lateFeeConfiguration.amount / .bounceCharge), in line with
// RBI's penal charges directions: they are not added to the interest rate and are never compounded.
@Injectable()
export class CreditOperationsService {
  private readonly logger = new Logger(CreditOperationsService.name);

  constructor(
    @InjectRepository(Repayment)
    private readonly repaymentsRepository: Repository<Repayment>,
    @InjectRepository(Loan)
    private readonly loansRepository: Repository<Loan>,
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly auditLogService: AuditLogService,
  ) {}

  // Charges the product's late fee once per EMI when it is overdue beyond the product's grace period.
  async applyLateFees(today = new Date()) {
    const candidates = await this.repaymentsRepository.find({
      where: { status: RepaymentStatus.OVERDUE, lateFeeAppliedAt: IsNull() },
      relations: { loan: true },
    });
    const products = await this.productsFor(candidates.map((repayment) => repayment.loan?.productId));
    let applied = 0;

    for (const repayment of candidates) {
      const product = repayment.loan?.productId ? products.get(repayment.loan.productId) : undefined;
      const fee = chargeFor(product, 'LATE_FEE');
      if (!product || fee <= 0 || repayment.daysOverdue <= (product.gracePeriodDays ?? 0)) {
        continue;
      }
      await this.dataSource.transaction(async (manager) => {
        const fresh = await manager.findOneByOrFail(Repayment, { id: repayment.id });
        if (fresh.lateFeeAppliedAt || fresh.status === RepaymentStatus.PAID) return;
        fresh.lateFeeAmount = Number(addMoney(fresh.lateFeeAmount, fee));
        fresh.lateFeeAppliedAt = today;
        await manager.save(Repayment, fresh);
        await this.postCharge(manager, fresh, 'LATE_FEE', fee, null, `Late fee after ${fresh.daysOverdue} days overdue`);
      });
      await this.auditLogService.create({
        action: 'LATE_FEE_APPLIED',
        entityType: 'Repayment',
        entityId: repayment.id,
        actorUserId: null,
        metadata: { loanId: repayment.loanId, amount: moneyToString(fee), daysOverdue: repayment.daysOverdue, organizationId: repayment.loan?.organizationId ?? null },
      });
      applied += 1;
    }
    if (applied) this.logger.log(`Applied late fee to ${applied} repayment(s)`);
    return applied;
  }

  // Recorded by collections staff when the bank reports an auto-debit (eNACH/cheque) as returned.
  async markBounced(repaymentId: string, user: RequestUser, reason: string) {
    const repayment = await this.findScopedRepayment(repaymentId, user);
    if (repayment.status === RepaymentStatus.PAID) {
      throw new BadRequestException('A paid EMI cannot be marked as bounced');
    }
    const product = repayment.loan?.productId ? await this.productsRepository.findOne({ where: { id: repayment.loan.productId } }) : null;
    const fee = chargeFor(product ?? undefined, 'BOUNCE_CHARGE');

    const saved = await this.dataSource.transaction(async (manager) => {
      const fresh = await manager.findOneByOrFail(Repayment, { id: repayment.id });
      fresh.bounceCount += 1;
      if (fee > 0) {
        fresh.bounceChargeAmount = Number(addMoney(fresh.bounceChargeAmount, fee));
      }
      const result = await manager.save(Repayment, fresh);
      if (fee > 0) {
        await this.postCharge(manager, result, 'BOUNCE_CHARGE', fee, user.id, reason);
      }
      return result;
    });
    await this.auditLogService.create({
      action: 'REPAYMENT_BOUNCED',
      entityType: 'Repayment',
      entityId: repayment.id,
      actorUserId: user.id,
      metadata: { loanId: repayment.loanId, charge: moneyToString(fee), reason, bounceCount: saved.bounceCount, organizationId: repayment.loan?.organizationId ?? null },
    });
    return saved;
  }

  // Removes all charges on an EMI (e.g. customer grievance, bank error). Admin-only and always audited.
  async waiveCharges(repaymentId: string, user: RequestUser, reason: string) {
    const repayment = await this.findScopedRepayment(repaymentId, user);
    if (repayment.status === RepaymentStatus.PAID) {
      throw new BadRequestException('Charges on a paid EMI cannot be waived');
    }
    const lateFee = Number(repayment.lateFeeAmount ?? 0);
    const bounceCharge = Number(repayment.bounceChargeAmount ?? 0);
    if (!lateFee && !bounceCharge) {
      throw new BadRequestException('This EMI has no charges to waive');
    }

    const saved = await this.dataSource.transaction(async (manager) => {
      const fresh = await manager.findOneByOrFail(Repayment, { id: repayment.id });
      fresh.lateFeeAmount = 0;
      fresh.bounceChargeAmount = 0;
      const result = await manager.save(Repayment, fresh);
      const loan = await manager.findOneByOrFail(Loan, { id: fresh.loanId });
      if (loan.penaltyOutstanding != null) loan.penaltyOutstanding = clamp(subtractMoney(loan.penaltyOutstanding, lateFee));
      if (loan.feeOutstanding != null) loan.feeOutstanding = clamp(subtractMoney(loan.feeOutstanding, bounceCharge));
      if (loan.totalOutstanding != null) loan.totalOutstanding = clamp(subtractMoney(loan.totalOutstanding, lateFee, bounceCharge));
      await manager.save(Loan, loan);
      const entries = [
        lateFee ? this.ledgerEntry(manager, loan, fresh, RepaymentLedgerTransactionType.PENALTY_WAIVED, { penaltyAmount: lateFee }, user.id, reason) : null,
        bounceCharge ? this.ledgerEntry(manager, loan, fresh, RepaymentLedgerTransactionType.FEE_WAIVED, { feeAmount: bounceCharge }, user.id, reason) : null,
      ].filter((entry): entry is RepaymentLedgerEntry => entry !== null);
      await manager.save(RepaymentLedgerEntry, entries);
      return result;
    });
    await this.auditLogService.create({
      action: 'CHARGES_WAIVED',
      entityType: 'Repayment',
      entityId: repayment.id,
      actorUserId: user.id,
      metadata: { loanId: repayment.loanId, lateFee: moneyToString(lateFee), bounceCharge: moneyToString(bounceCharge), reason, organizationId: repayment.loan?.organizationId ?? null },
    });
    return saved;
  }

  // Nightly: recompute DPD and IRACP classification for every running loan and audit each movement.
  async refreshPortfolioRisk(today = new Date()) {
    const loans = await this.loansRepository.find({ where: { status: In([LoanStatus.ACTIVE, LoanStatus.DISBURSED, LoanStatus.DEFAULTED]) } });
    let moved = 0;
    for (const loan of loans) {
      const result = await this.dataSource.transaction(async (manager) => {
        const fresh = await manager.findOneByOrFail(Loan, { id: loan.id });
        const risk = await refreshLoanRisk(manager, fresh, today);
        await manager.save(Loan, fresh);
        return risk;
      });
      if (result.changed) {
        moved += 1;
        await this.auditLogService.create({
          action: 'ASSET_CLASSIFICATION_CHANGED',
          entityType: 'Loan',
          entityId: loan.id,
          actorUserId: null,
          metadata: { from: result.previous, to: result.classification, dpd: result.dpd, organizationId: loan.organizationId ?? null },
        });
      }
    }
    if (moved) this.logger.log(`Asset classification changed for ${moved} loan(s)`);
    return moved;
  }

  private async postCharge(manager: EntityManager, repayment: Repayment, kind: ChargeKind, amount: number, actorUserId: string | null, reason: string) {
    const loan = await manager.findOneByOrFail(Loan, { id: repayment.loanId });
    if (kind === 'LATE_FEE') {
      loan.penaltyOutstanding = addMoney(loan.penaltyOutstanding ?? 0, amount);
    } else {
      loan.feeOutstanding = addMoney(loan.feeOutstanding ?? 0, amount);
    }
    if (loan.totalOutstanding != null) {
      loan.totalOutstanding = addMoney(loan.totalOutstanding, amount);
    }
    await manager.save(Loan, loan);
    await manager.save(
      RepaymentLedgerEntry,
      this.ledgerEntry(
        manager,
        loan,
        repayment,
        kind === 'LATE_FEE' ? RepaymentLedgerTransactionType.PENALTY_DUE : RepaymentLedgerTransactionType.FEE_DUE,
        kind === 'LATE_FEE' ? { penaltyAmount: amount } : { feeAmount: amount },
        actorUserId,
        reason,
        kind,
      ),
    );
  }

  private ledgerEntry(
    manager: EntityManager,
    loan: Loan,
    repayment: Repayment,
    transactionType: RepaymentLedgerTransactionType,
    amounts: { penaltyAmount?: number; feeAmount?: number },
    actorUserId: string | null,
    reason: string,
    chargeType?: ChargeKind,
  ) {
    const penalty = amounts.penaltyAmount ?? 0;
    const fee = amounts.feeAmount ?? 0;
    return manager.create(RepaymentLedgerEntry, {
      organizationId: loan.organizationId ?? '',
      loanId: loan.id,
      repaymentId: repayment.id,
      transactionType,
      principalAmount: '0.00',
      interestAmount: '0.00',
      feeAmount: moneyToString(fee),
      penaltyAmount: moneyToString(penalty),
      totalAmount: addMoney(fee, penalty),
      metadata: { reason, actorUserId, ...(chargeType ? { chargeType } : {}) },
    });
  }

  private async findScopedRepayment(id: string, user: RequestUser) {
    const repayment = await this.repaymentsRepository.findOne({ where: { id }, relations: { loan: true } });
    if (!repayment) {
      throw new NotFoundException('Repayment not found');
    }
    assertOrganizationAccess(user, repayment.loan?.organizationId, 'repayment');
    return repayment;
  }

  private async productsFor(ids: Array<string | null | undefined>) {
    const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
    const products = unique.length ? await this.productsRepository.find({ where: { id: In(unique) } }) : [];
    return new Map(products.map((product) => [product.id, product]));
  }
}

export function chargeFor(product: Pick<Product, 'lateFeeConfiguration'> | undefined, kind: ChargeKind) {
  const config = (product?.lateFeeConfiguration ?? {}) as Record<string, unknown>;
  const value = Number(kind === 'LATE_FEE' ? config.amount : config.bounceCharge);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function clamp(value: string) {
  return Number(value) < 0 ? '0.00' : value;
}
