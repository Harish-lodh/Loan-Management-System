import { EntityManager, In, LessThan } from 'typeorm';
import { AssetClassification, Loan, Repayment, RepaymentStatus } from '../database/entities';
import { calculateDaysOverdue } from './repayment-utils';

const DAY_MS = 24 * 60 * 60 * 1000;
const NPA_DPD_THRESHOLD = 90;
const DOUBTFUL_AFTER_DAYS = 365;

export interface ClassificationResult {
  classification: AssetClassification;
  npaDate: string | null;
}

// RBI IRACP norms for NBFCs.
// - 1-30 / 31-60 / 61-90 DPD are SMA-0 / SMA-1 / SMA-2.
// - More than 90 DPD is NPA (substandard), becoming doubtful once it has been NPA for over 12 months.
// - An NPA is upgraded to standard only when the entire overdue amount is cleared (DPD back to 0);
//   partial payments that merely reduce DPD below 90 do not upgrade it (RBI circular, Nov 2021).
// - LOSS is a manual classification and is never changed automatically.
export function classifyAsset(
  dpd: number,
  current: { classification: AssetClassification; npaDate?: string | null },
  today = new Date(),
): ClassificationResult {
  if (current.classification === AssetClassification.NPA_LOSS) {
    return { classification: AssetClassification.NPA_LOSS, npaDate: current.npaDate ?? toDateString(today) };
  }

  const alreadyNpa = isNpa(current.classification);
  if (dpd > NPA_DPD_THRESHOLD || (alreadyNpa && dpd > 0)) {
    const npaDate = current.npaDate ?? toDateString(today);
    const daysAsNpa = Math.floor((startOfDay(today).getTime() - new Date(`${npaDate}T00:00:00`).getTime()) / DAY_MS);
    return {
      classification: daysAsNpa > DOUBTFUL_AFTER_DAYS ? AssetClassification.NPA_DOUBTFUL : AssetClassification.NPA_SUBSTANDARD,
      npaDate,
    };
  }
  if (dpd > 60) return { classification: AssetClassification.SMA_2, npaDate: null };
  if (dpd > 30) return { classification: AssetClassification.SMA_1, npaDate: null };
  if (dpd > 0) return { classification: AssetClassification.SMA_0, npaDate: null };
  return { classification: AssetClassification.STANDARD, npaDate: null };
}

export function isNpa(classification: AssetClassification) {
  return [AssetClassification.NPA_SUBSTANDARD, AssetClassification.NPA_DOUBTFUL, AssetClassification.NPA_LOSS].includes(classification);
}

// Recomputes DPD and classification for one loan from its unpaid EMIs. Mutates the loan (caller saves it) and
// returns the previous classification when it changed, so callers can audit the movement.
export async function refreshLoanRisk(manager: EntityManager, loan: Loan, today = new Date()) {
  const oldestUnpaid = await manager.findOne(Repayment, {
    where: {
      loanId: loan.id,
      status: In([RepaymentStatus.PENDING, RepaymentStatus.OVERDUE]),
      dueDate: LessThan(startOfDay(today)),
    },
    order: { dueDate: 'ASC' },
  });
  const dpd = oldestUnpaid ? calculateDaysOverdue(oldestUnpaid.dueDate, today) : 0;
  const previous = loan.assetClassification ?? AssetClassification.STANDARD;
  const next = classifyAsset(dpd, { classification: previous, npaDate: loan.npaDate }, today);

  loan.dpd = dpd;
  const changed = next.classification !== previous;
  if (changed || loan.npaDate !== next.npaDate) {
    loan.assetClassification = next.classification;
    loan.npaDate = next.npaDate;
    loan.classificationUpdatedAt = new Date();
  }
  if (changed) {
    loan.statusHistory = [
      ...(loan.statusHistory ?? []),
      {
        status: `CLASSIFICATION_${next.classification}`,
        changedAt: new Date().toISOString(),
        actorUserId: null,
        comment: `Asset classification ${previous} -> ${next.classification} at ${dpd} DPD`,
      },
    ];
  }
  return { dpd, changed, previous, classification: next.classification };
}

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function toDateString(date: Date) {
  const day = startOfDay(date);
  const month = String(day.getMonth() + 1).padStart(2, '0');
  return `${day.getFullYear()}-${month}-${String(day.getDate()).padStart(2, '0')}`;
}
