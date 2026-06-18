import { BadRequestException, Injectable } from '@nestjs/common';
import { LoanApplicationStatus } from '../database/entities';

export type ResolvedCapabilityConfig = {
  requiresKyc: boolean;
  requiresBankVerification: boolean;
  requiresDocumentVerification: boolean;
  requiresManualApproval: boolean;
  allowsAutomatedApproval: boolean;
  requiresAgreement: boolean;
  requiresESign: boolean;
  requiresENach: boolean;
  requiresDisbursementConfirmation: boolean;
};

export type WorkflowStepSnapshot = {
  stepKey: string;
  label: string;
  status: LoanApplicationStatus;
  displayOrder: number;
  actorRole?: string | null;
};

@Injectable()
export class WorkflowService {
  buildDefaultSteps(config: ResolvedCapabilityConfig): WorkflowStepSnapshot[] {
    const steps: WorkflowStepSnapshot[] = [
      this.step('submitted', 'Submitted', LoanApplicationStatus.SUBMITTED, 10, 'CUSTOMER'),
    ];

    if (config.requiresKyc) {
      steps.push(this.step('kyc', 'KYC', LoanApplicationStatus.KYC_PENDING, 20, 'CUSTOMER'));
    }
    if (config.requiresDocumentVerification) {
      steps.push(this.step('documents', 'Document verification', LoanApplicationStatus.DOCUMENT_PENDING, 30, 'OPERATIONS_USER'));
    }
    if (config.requiresBankVerification) {
      steps.push(this.step('bank-verification', 'Bank verification', LoanApplicationStatus.BANK_VERIFICATION_PENDING, 40, 'OPERATIONS_USER'));
    }
    if (config.requiresManualApproval) {
      steps.push(this.step('manual-review', 'Credit review', LoanApplicationStatus.UNDER_REVIEW, 50, 'CREDIT_MANAGER'));
      steps.push(this.step('credit-approved', 'Credit approved', LoanApplicationStatus.CREDIT_APPROVED, 55, 'CREDIT_MANAGER'));
    } else {
      steps.push(this.step('auto-approval', 'Automated approval', LoanApplicationStatus.CREDIT_APPROVED, 50, 'SYSTEM'));
    }
    if (config.requiresAgreement) {
      steps.push(this.step('agreement', 'Agreement', LoanApplicationStatus.AGREEMENT_PENDING, 60, 'OPERATIONS_USER'));
    }
    if (config.requiresESign) {
      steps.push(this.step('esign', 'eSign', LoanApplicationStatus.ESIGN_PENDING, 70, 'CUSTOMER'));
    }
    if (config.requiresENach) {
      steps.push(this.step('enach', 'eNACH', LoanApplicationStatus.ENACH_PENDING, 80, 'CUSTOMER'));
    }

    steps.push(this.step('ready-for-disbursement', 'Ready for disbursement', LoanApplicationStatus.READY_FOR_DISBURSEMENT, 90, 'OPERATIONS_MANAGER'));
    steps.push(this.step('disbursement', 'Disbursement', LoanApplicationStatus.DISBURSEMENT_PENDING, 100, 'OPERATIONS_MANAGER'));
    steps.push(this.step('active', 'Active loan', LoanApplicationStatus.ACTIVE, 110, 'SYSTEM'));
    return steps.sort((a, b) => a.displayOrder - b.displayOrder);
  }

  allowedNextStatuses(current: LoanApplicationStatus, workflow: WorkflowStepSnapshot[]) {
    if (current === LoanApplicationStatus.DRAFT) {
      return [LoanApplicationStatus.SUBMITTED];
    }
    if (current === LoanApplicationStatus.CREDIT_REJECTED || current === LoanApplicationStatus.REJECTED) {
      return [];
    }

    const orderedStatuses = workflow.map((step) => step.status);
    const index = orderedStatuses.indexOf(current);
    if (index === -1) {
      return orderedStatuses.length ? [orderedStatuses[0]] : [];
    }

    const next = orderedStatuses[index + 1];
    return next ? [next] : [];
  }

  assertTransition(current: LoanApplicationStatus, next: LoanApplicationStatus, workflow: WorkflowStepSnapshot[]) {
    const allowed = this.allowedNextStatuses(current, workflow);
    if (!allowed.includes(next)) {
      throw new BadRequestException(`Application cannot move from ${current} to ${next}`);
    }
  }

  statusAfterCreditApproval(workflow: WorkflowStepSnapshot[]) {
    const statuses = workflow.map((step) => step.status);
    const creditIndex = statuses.indexOf(LoanApplicationStatus.CREDIT_APPROVED);
    return statuses[creditIndex + 1] ?? LoanApplicationStatus.READY_FOR_DISBURSEMENT;
  }

  nextCustomerActions(status: LoanApplicationStatus, workflow: WorkflowStepSnapshot[]) {
    const step = workflow.find((item) => item.status === status);
    const actions: Record<string, string[]> = {
      [LoanApplicationStatus.KYC_PENDING]: ['complete_kyc'],
      [LoanApplicationStatus.AGREEMENT_PENDING]: ['wait_for_agreement_generation'],
      [LoanApplicationStatus.ESIGN_PENDING]: ['complete_esign'],
      [LoanApplicationStatus.ENACH_PENDING]: ['complete_enach'],
      [LoanApplicationStatus.READY_FOR_DISBURSEMENT]: ['wait_for_disbursement'],
    };
    return {
      currentStep: step ?? null,
      actions: actions[status] ?? [],
      allowedNextStatuses: this.allowedNextStatuses(status, workflow),
    };
  }

  private step(
    stepKey: string,
    label: string,
    status: LoanApplicationStatus,
    displayOrder: number,
    actorRole: string,
  ): WorkflowStepSnapshot {
    return { stepKey, label, status, displayOrder, actorRole };
  }
}
