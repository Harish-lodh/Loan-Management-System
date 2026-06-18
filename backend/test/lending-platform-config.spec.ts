import { BadRequestException } from '@nestjs/common';
import { LoanApplicationStatus, ProductEligibilityRule } from '../src/database/entities';
import { RuleEngineService } from '../src/lending-platform/rule-engine.service';
import { WorkflowService } from '../src/lending-platform/workflow.service';

describe('lending platform configurable foundation', () => {
  it('evaluates safe eligibility rules without executable code', () => {
    const engine = new RuleEngineService();
    const rules = [
      {
        ruleCode: 'AGE_AMOUNT',
        version: 1,
        name: 'Age and amount',
        score: 20,
        failureReason: 'Age or amount policy failed',
        ruleDefinition: {
          all: [
            { field: 'applicant.age', operator: 'greaterThanOrEqual', value: 21 },
            { field: 'application.requestedAmount', operator: 'lessThanOrEqual', valueFrom: 'product.maximumLoanAmount' },
          ],
        },
      },
    ] as unknown as ProductEligibilityRule[];

    const result = engine.evaluateRules(rules, {
      applicant: { age: 26 },
      application: { requestedAmount: 50000 },
      product: { maximumLoanAmount: 100000 },
    });

    expect(result.passed).toBe(true);
    expect(result.score).toBe(20);
    expect(result.evaluations[0]).toEqual(expect.objectContaining({ ruleCode: 'AGE_AMOUNT', passed: true }));
  });

  it('rejects unsupported rule operators', () => {
    const engine = new RuleEngineService();

    expect(() =>
      engine.validateRuleDefinition({
        field: 'applicant.age',
        operator: 'executeJavascript',
        value: 21,
      }),
    ).toThrow(BadRequestException);
  });

  it('builds workflow from product capabilities and blocks invalid jumps', () => {
    const workflow = new WorkflowService();
    const steps = workflow.buildDefaultSteps({
      requiresKyc: true,
      requiresBankVerification: true,
      requiresDocumentVerification: false,
      requiresManualApproval: true,
      allowsAutomatedApproval: false,
      requiresAgreement: true,
      requiresESign: true,
      requiresENach: true,
      requiresDisbursementConfirmation: false,
    });

    expect(steps.map((step) => step.status)).toEqual(
      expect.arrayContaining([
        LoanApplicationStatus.KYC_PENDING,
        LoanApplicationStatus.UNDER_REVIEW,
        LoanApplicationStatus.CREDIT_APPROVED,
        LoanApplicationStatus.ESIGN_PENDING,
        LoanApplicationStatus.ENACH_PENDING,
      ]),
    );
    expect(() =>
      workflow.assertTransition(LoanApplicationStatus.DRAFT, LoanApplicationStatus.DISBURSED, steps),
    ).toThrow(BadRequestException);
  });
});
