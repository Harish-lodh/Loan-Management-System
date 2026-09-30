import { EntityManager } from 'typeorm';
import { Loan, LoanStatus, Repayment, RepaymentLedgerEntry, RepaymentLedgerTransactionType, RepaymentStatus } from '../database/entities';
import { addMoney, moneyToString, subtractMoney } from '../lending-platform/money.util';
import { roundMoney } from '../loans/loan-calculations';
import { refreshLoanRisk } from './credit-risk';

export interface RepaymentPostingInput {
  actorUserId: string | null;
  // Where the money came from, e.g. 'MANUAL' or 'EASEBUZZ'.
  source: string;
  amount?: number | string;
  providerReference?: string | null;
  externalReference?: string | null;
}

// EMI plus any late fee / bounce charge, less what has already been paid.
export function amountDue(repayment: Pick<Repayment, 'emiAmount' | 'lateFeeAmount' | 'bounceChargeAmount' | 'paidAmount'>) {
  const total = Number(addMoney(repayment.emiAmount, repayment.lateFeeAmount ?? 0, repayment.bounceChargeAmount ?? 0));
  return Math.max(0, roundMoney(total - Number(repayment.paidAmount ?? 0)));
}

// Single place that records an EMI as paid: repayment row, loan balances, loan closure, DPD/classification and
// the ledger entry. Every payment path (staff marking paid, payment gateway webhook) must go through this,
// inside a transaction.
export async function postRepaymentPayment(manager: EntityManager, repayment: Repayment, input: RepaymentPostingInput) {
  const amount = input.amount !== undefined ? Number(input.amount) : amountDue(repayment);
  const lateFee = Number(repayment.lateFeeAmount ?? 0);
  const bounceCharge = Number(repayment.bounceChargeAmount ?? 0);

  repayment.status = RepaymentStatus.PAID;
  repayment.paidAmount = Number(addMoney(repayment.emiAmount, lateFee, bounceCharge));
  repayment.paidAt = new Date();
  repayment.daysOverdue = 0;
  const savedRepayment = await manager.save(Repayment, repayment);

  const loan = await manager.findOneByOrFail(Loan, { id: repayment.loanId });
  loan.outstandingBalance = roundMoney(Math.max(0, Number(loan.outstandingBalance) - repayment.principalComponent));
  // Detailed balances exist only on loans booked through the product workflow.
  if (loan.principalOutstanding != null) {
    loan.principalOutstanding = clampMoney(subtractMoney(loan.principalOutstanding, repayment.principalComponent));
  }
  if (loan.interestOutstanding != null) {
    loan.interestOutstanding = clampMoney(subtractMoney(loan.interestOutstanding, repayment.interestComponent));
  }
  if (loan.penaltyOutstanding != null && lateFee) {
    loan.penaltyOutstanding = clampMoney(subtractMoney(loan.penaltyOutstanding, lateFee));
  }
  if (loan.feeOutstanding != null && bounceCharge) {
    loan.feeOutstanding = clampMoney(subtractMoney(loan.feeOutstanding, bounceCharge));
  }
  if (loan.totalOutstanding != null) {
    loan.totalOutstanding = clampMoney(subtractMoney(loan.totalOutstanding, repayment.emiAmount, lateFee, bounceCharge));
  }

  const totalRepayments = await manager.count(Repayment, { where: { loanId: repayment.loanId } });
  const paidRepayments = await manager.count(Repayment, { where: { loanId: repayment.loanId, status: RepaymentStatus.PAID } });
  if (totalRepayments > 0 && paidRepayments === totalRepayments) {
    loan.status = LoanStatus.CLOSED;
    loan.closedAt = new Date();
    loan.outstandingBalance = 0;
    for (const field of ['principalOutstanding', 'interestOutstanding', 'penaltyOutstanding', 'feeOutstanding', 'totalOutstanding'] as const) {
      if (loan[field] != null) loan[field] = '0.00';
    }
    loan.statusHistory = [
      ...(loan.statusHistory ?? []),
      { status: LoanStatus.CLOSED, changedAt: new Date().toISOString(), actorUserId: input.actorUserId, comment: 'All repayments completed' },
    ];
  }
  const risk = await refreshLoanRisk(manager, loan);
  const savedLoan = await manager.save(Loan, loan);

  await manager.save(
    RepaymentLedgerEntry,
    manager.create(RepaymentLedgerEntry, {
      organizationId: loan.organizationId ?? '',
      loanId: loan.id,
      repaymentId: repayment.id,
      transactionType: RepaymentLedgerTransactionType.PAYMENT_RECEIVED,
      principalAmount: moneyToString(repayment.principalComponent),
      interestAmount: moneyToString(repayment.interestComponent),
      feeAmount: moneyToString(bounceCharge),
      penaltyAmount: moneyToString(lateFee),
      totalAmount: moneyToString(amount),
      providerReference: input.providerReference ?? null,
      externalReference: input.externalReference ?? null,
      metadata: { source: input.source, actorUserId: input.actorUserId },
    }),
  );

  return { repayment: savedRepayment, loan: savedLoan, risk };
}

function clampMoney(value: string) {
  return Number(value) < 0 ? '0.00' : value;
}
