import { AssetClassification } from '../database/entities/enums';
import { chargeFor } from './credit-operations.service';
import { classifyAsset } from './credit-risk';
import { amountDue } from './repayment-posting';

const today = new Date('2026-09-30T10:00:00');
const standard = { classification: AssetClassification.STANDARD, npaDate: null };

describe('classifyAsset (RBI IRACP)', () => {
  it.each([
    [0, AssetClassification.STANDARD],
    [1, AssetClassification.SMA_0],
    [30, AssetClassification.SMA_0],
    [31, AssetClassification.SMA_1],
    [60, AssetClassification.SMA_1],
    [61, AssetClassification.SMA_2],
    [90, AssetClassification.SMA_2],
    [91, AssetClassification.NPA_SUBSTANDARD],
  ])('%i DPD -> %s', (dpd, expected) => {
    expect(classifyAsset(dpd, standard, today).classification).toBe(expected);
  });

  it('stamps the NPA date when an account first becomes NPA', () => {
    expect(classifyAsset(95, standard, today)).toEqual({ classification: AssetClassification.NPA_SUBSTANDARD, npaDate: '2026-09-30' });
  });

  it('keeps an NPA as NPA on partial payment even when DPD drops below 90', () => {
    const npa = { classification: AssetClassification.NPA_SUBSTANDARD, npaDate: '2026-08-01' };
    expect(classifyAsset(40, npa, today)).toEqual({ classification: AssetClassification.NPA_SUBSTANDARD, npaDate: '2026-08-01' });
  });

  it('upgrades an NPA to standard only once all arrears are cleared', () => {
    const npa = { classification: AssetClassification.NPA_SUBSTANDARD, npaDate: '2026-08-01' };
    expect(classifyAsset(0, npa, today)).toEqual({ classification: AssetClassification.STANDARD, npaDate: null });
  });

  it('moves substandard to doubtful after 12 months as NPA', () => {
    const npa = { classification: AssetClassification.NPA_SUBSTANDARD, npaDate: '2025-09-01' };
    expect(classifyAsset(400, npa, today).classification).toBe(AssetClassification.NPA_DOUBTFUL);
  });

  it('never changes a manual LOSS classification', () => {
    const loss = { classification: AssetClassification.NPA_LOSS, npaDate: '2025-01-01' };
    expect(classifyAsset(0, loss, today).classification).toBe(AssetClassification.NPA_LOSS);
  });
});

describe('charges', () => {
  it('reads flat late fee and bounce charge from the product', () => {
    const product = { lateFeeConfiguration: { type: 'FIXED', amount: 500, bounceCharge: 590 } };
    expect(chargeFor(product, 'LATE_FEE')).toBe(500);
    expect(chargeFor(product, 'BOUNCE_CHARGE')).toBe(590);
    expect(chargeFor({ lateFeeConfiguration: null }, 'LATE_FEE')).toBe(0);
    expect(chargeFor(undefined, 'BOUNCE_CHARGE')).toBe(0);
  });

  it('includes charges in the amount due', () => {
    expect(amountDue({ emiAmount: 8642.32, lateFeeAmount: 500, bounceChargeAmount: 590, paidAmount: 0 })).toBe(9732.32);
    expect(amountDue({ emiAmount: 1000, lateFeeAmount: 0, bounceChargeAmount: 0, paidAmount: 1000 })).toBe(0);
  });
});
