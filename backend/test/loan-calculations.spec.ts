import { EmploymentType } from '../src/database/entities';
import { assessLoanRisk, calculateEmi, generateRepaymentSchedule } from '../src/loans/loan-calculations';

describe('loan calculations', () => {
  it('calculates EMI deterministically', () => {
    const result = calculateEmi({
      principal: 100000,
      annualInterestRate: 12,
      tenureMonths: 12,
    });

    expect(result.monthlyEmi).toBe(8884.88);
    expect(result.totalPayable).toBe(106618.56);
    expect(result.totalInterest).toBe(6618.56);
  });

  it('scores low-risk applicants higher than high-risk applicants', () => {
    const lowRisk = assessLoanRisk({
      amount: 200000,
      tenureMonths: 24,
      monthlyIncome: 120000,
      employmentType: EmploymentType.SALARIED,
      existingMonthlyDebt: 5000,
      creditScore: 780,
    });
    const highRisk = assessLoanRisk({
      amount: 800000,
      tenureMonths: 84,
      monthlyIncome: 25000,
      employmentType: EmploymentType.UNEMPLOYED,
      existingMonthlyDebt: 20000,
      creditScore: 560,
    });

    expect(lowRisk.riskScore).toBeGreaterThan(highRisk.riskScore);
    expect(lowRisk.approvalLikelihood).toBe('LIKELY_APPROVED');
    expect(highRisk.approvalLikelihood).toBe('UNLIKELY_APPROVED');
    expect(lowRisk.scoreBreakdown).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: 'Credit score', points: 30, maxPoints: 30 }),
        expect.objectContaining({ category: 'Debt-to-income', impact: 'POSITIVE' }),
      ]),
    );
  });

  it('generates one repayment item per tenure month', () => {
    const schedule = generateRepaymentSchedule({
      principal: 50000,
      annualInterestRate: 12,
      tenureMonths: 6,
      startDate: new Date('2026-01-01T00:00:00.000Z'),
    });

    expect(schedule).toHaveLength(6);
    expect(schedule[5].remainingBalance).toBe(0);
  });
});
