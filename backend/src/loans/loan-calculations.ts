import { EmploymentType } from '../database/entities/enums';

export type EmiInput = {
  principal: number;
  annualInterestRate: number;
  tenureMonths: number;
};

export type RiskInput = {
  amount: number;
  tenureMonths: number;
  monthlyIncome: number;
  employmentType: EmploymentType;
  existingMonthlyDebt: number;
  creditScore: number;
};

export type ScoreBreakdownItem = {
  category: string;
  points: number;
  maxPoints: number;
  impact: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
  message: string;
};

export type RepaymentScheduleInput = EmiInput & {
  startDate: Date;
};

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateEmi(input: EmiInput) {
  const principal = Number(input.principal);
  const tenureMonths = Number(input.tenureMonths);
  const monthlyRate = Number(input.annualInterestRate) / 12 / 100;

  if (principal <= 0 || tenureMonths <= 0) {
    throw new Error('Principal and tenure must be positive numbers.');
  }

  const monthlyEmi =
    monthlyRate === 0
      ? principal / tenureMonths
      : (principal * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths)) /
        (Math.pow(1 + monthlyRate, tenureMonths) - 1);
  const emi = roundMoney(monthlyEmi);
  const totalPayable = roundMoney(emi * tenureMonths);
  const totalInterest = roundMoney(totalPayable - principal);

  return {
    monthlyEmi: emi,
    totalPayable,
    totalInterest,
  };
}

export function assessLoanRisk(input: RiskInput) {
  let score = 0;
  const strengths: string[] = [];
  const concerns: string[] = [];
  const scoreBreakdown: ScoreBreakdownItem[] = [];
  const debtToIncomeRatio = input.monthlyIncome > 0 ? input.existingMonthlyDebt / input.monthlyIncome : 1;
  const loanToAnnualIncomeRatio = input.monthlyIncome > 0 ? input.amount / (input.monthlyIncome * 12) : 10;

  const addBreakdown = (
    category: string,
    points: number,
    maxPoints: number,
    impact: ScoreBreakdownItem['impact'],
    message: string,
  ) => {
    score += points;
    scoreBreakdown.push({ category, points, maxPoints, impact, message });
  };

  if (input.creditScore >= 750) {
    strengths.push('your credit score is strong');
    addBreakdown('Credit score', 30, 30, 'POSITIVE', 'Excellent credit history supports approval.');
  } else if (input.creditScore >= 700) {
    strengths.push('your credit score is healthy');
    addBreakdown('Credit score', 24, 30, 'POSITIVE', 'Healthy credit score lowers lending risk.');
  } else if (input.creditScore >= 650) {
    concerns.push('your credit score is moderate');
    addBreakdown('Credit score', 16, 30, 'NEUTRAL', 'Moderate credit score may need manual review.');
  } else if (input.creditScore >= 600) {
    concerns.push('your credit score is below the preferred range');
    addBreakdown('Credit score', 8, 30, 'NEGATIVE', 'Below-target credit score increases lending risk.');
  } else {
    concerns.push('your credit score is low');
    addBreakdown('Credit score', 2, 30, 'NEGATIVE', 'Low credit score is a major approval concern.');
  }

  if (debtToIncomeRatio <= 0.2) {
    strengths.push('your debt-to-income ratio is low');
    addBreakdown('Debt-to-income', 25, 25, 'POSITIVE', 'Low existing debt leaves strong repayment capacity.');
  } else if (debtToIncomeRatio <= 0.35) {
    strengths.push('your debt-to-income ratio is manageable');
    addBreakdown('Debt-to-income', 18, 25, 'POSITIVE', 'Debt load is manageable against monthly income.');
  } else if (debtToIncomeRatio <= 0.5) {
    concerns.push('your existing debt is high compared to your income');
    addBreakdown('Debt-to-income', 8, 25, 'NEGATIVE', 'Existing debt is high against monthly income.');
  } else {
    concerns.push('your existing debt is very high compared to your income');
    addBreakdown('Debt-to-income', 0, 25, 'NEGATIVE', 'Very high debt load leaves little repayment buffer.');
  }

  if (input.monthlyIncome >= 100000) {
    strengths.push('your monthly income comfortably supports the request');
    addBreakdown('Income', 15, 15, 'POSITIVE', 'Monthly income comfortably supports the request.');
  } else if (input.monthlyIncome >= 50000) {
    strengths.push('your income is steady for this loan size');
    addBreakdown('Income', 10, 15, 'POSITIVE', 'Income appears steady for this loan size.');
  } else if (input.monthlyIncome >= 30000) {
    concerns.push('your income leaves a smaller repayment buffer');
    addBreakdown('Income', 6, 15, 'NEUTRAL', 'Income leaves a smaller repayment buffer.');
  } else {
    concerns.push('your income may not provide enough repayment buffer');
    addBreakdown('Income', 2, 15, 'NEGATIVE', 'Income may not provide enough repayment buffer.');
  }

  const employmentScore: Record<EmploymentType, number> = {
    SALARIED: 12,
    SELF_EMPLOYED: 8,
    BUSINESS_OWNER: 10,
    CONTRACT: 5,
    UNEMPLOYED: 0,
  };
  const employmentPoints = employmentScore[input.employmentType];
  if (input.employmentType === EmploymentType.SALARIED || input.employmentType === EmploymentType.BUSINESS_OWNER) {
    strengths.push('your employment profile is considered stable');
    addBreakdown('Employment', employmentPoints, 12, 'POSITIVE', 'Employment profile is considered stable.');
  } else if (input.employmentType === EmploymentType.UNEMPLOYED) {
    concerns.push('no stable employment type was provided');
    addBreakdown('Employment', employmentPoints, 12, 'NEGATIVE', 'No stable employment type was provided.');
  } else {
    concerns.push('your employment profile may need manual review');
    addBreakdown('Employment', employmentPoints, 12, 'NEUTRAL', 'Employment profile may need manual review.');
  }

  if (loanToAnnualIncomeRatio <= 0.5) {
    strengths.push('the requested amount is modest relative to annual income');
    addBreakdown('Loan size', 10, 10, 'POSITIVE', 'Requested amount is modest relative to annual income.');
  } else if (loanToAnnualIncomeRatio <= 1) {
    addBreakdown('Loan size', 7, 10, 'NEUTRAL', 'Requested amount is reasonable relative to annual income.');
  } else if (loanToAnnualIncomeRatio <= 2) {
    concerns.push('the requested amount is large relative to annual income');
    addBreakdown('Loan size', 3, 10, 'NEGATIVE', 'Requested amount is large relative to annual income.');
  } else {
    concerns.push('the requested amount is very large relative to annual income');
    addBreakdown('Loan size', 0, 10, 'NEGATIVE', 'Requested amount is very large relative to annual income.');
  }

  if (input.tenureMonths >= 12 && input.tenureMonths <= 60) {
    strengths.push('the repayment tenure is within a standard range');
    addBreakdown('Tenure', 8, 8, 'POSITIVE', 'Repayment tenure is within the standard range.');
  } else {
    concerns.push('the repayment tenure is outside the preferred range');
    addBreakdown('Tenure', 4, 8, 'NEUTRAL', 'Repayment tenure is outside the preferred range.');
  }

  const riskScore = Math.max(0, Math.min(100, score));
  const approvalLikelihood =
    riskScore >= 70 ? 'LIKELY_APPROVED' : riskScore >= 55 ? 'NEEDS_MANUAL_REVIEW' : 'UNLIKELY_APPROVED';

  const reasonParts = riskScore >= 70 ? strengths.slice(0, 3) : concerns.slice(0, 3);
  const riskExplanation =
    riskScore >= 70
      ? `You are likely to be approved because ${reasonParts.join(', ')}.`
      : riskScore >= 55
        ? `Your application needs manual review because ${reasonParts.join(', ')}.`
        : `You may not be approved because ${reasonParts.join(', ')}.`;

  return {
    riskScore,
    approvalLikelihood,
    riskExplanation,
    debtToIncomeRatio: roundMoney(debtToIncomeRatio * 100),
    loanToAnnualIncomeRatio: roundMoney(loanToAnnualIncomeRatio * 100),
    scoreBreakdown,
    strengths,
    concerns,
  };
}

export function generateRepaymentSchedule(input: RepaymentScheduleInput) {
  const emi = calculateEmi(input).monthlyEmi;
  const monthlyRate = input.annualInterestRate / 12 / 100;
  let balance = input.principal;

  return Array.from({ length: input.tenureMonths }, (_, index) => {
    const installmentNumber = index + 1;
    const dueDate = new Date(input.startDate);
    dueDate.setMonth(dueDate.getMonth() + installmentNumber);

    const interestComponent = roundMoney(balance * monthlyRate);
    const principalComponent =
      installmentNumber === input.tenureMonths ? roundMoney(balance) : roundMoney(emi - interestComponent);
    const emiAmount = roundMoney(principalComponent + interestComponent);
    balance = roundMoney(Math.max(0, balance - principalComponent));

    return {
      installmentNumber,
      dueDate,
      emiAmount,
      principalComponent,
      interestComponent,
      remainingBalance: balance,
    };
  });
}
