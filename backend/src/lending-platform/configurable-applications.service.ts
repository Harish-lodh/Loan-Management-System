import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuditLogService } from '../audit-log/audit-log.service';
import { assertPermission } from '../common/auth/role-permissions';
import { RequestUser } from '../common/types/request-user.interface';
import { CustomersService } from '../customers/customers.service';
import {
  ApplicationConfigurationSnapshot,
  ApplicationStatusTransition,
  EmploymentType,
  FeeType,
  LoanApplication,
  LoanApplicationStatus,
  MasterStatus,
} from '../database/entities';
import { assessLoanRisk, calculateEmi } from '../loans/loan-calculations';
import { ConfigurationResolverService, ResolvedConfiguration } from './configuration-resolver.service';
import { CreateConfigurableApplicationDto, DecisionDto, UpdateConfigurableApplicationDto } from './dto';
import { moneyToString, percentageOf, subtractMoney } from './money.util';
import { assertOrganizationAccess, organizationScope, organizationScopedWhere } from './organization-scope';
import { RuleEngineService } from './rule-engine.service';
import { WorkflowService, WorkflowStepSnapshot } from './workflow.service';

@Injectable()
export class ConfigurableApplicationsService {
  constructor(
    @InjectRepository(LoanApplication)
    private readonly applicationsRepository: Repository<LoanApplication>,
    @InjectRepository(ApplicationConfigurationSnapshot)
    private readonly snapshotsRepository: Repository<ApplicationConfigurationSnapshot>,
    @InjectRepository(ApplicationStatusTransition)
    private readonly transitionsRepository: Repository<ApplicationStatusTransition>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly resolver: ConfigurationResolverService,
    private readonly ruleEngine: RuleEngineService,
    private readonly workflowService: WorkflowService,
    private readonly auditLogService: AuditLogService,
    private readonly customersService: CustomersService,
  ) {}

  async createDraft(user: RequestUser, dto: CreateConfigurableApplicationDto) {
    const resolved = await this.resolver.resolveLive(dto.productId, dto.partnerId, organizationScope(user));
    this.ensureActiveProduct(resolved);
    this.validateApplicationInput(dto, resolved);
    const customer = await this.resolveCustomer(user, dto, resolved.product.organizationId);
    const applicant = this.normalizeApplicant(dto.applicant);
    const pricing = this.pricing(dto.requestedAmount, resolved);
    const emi = calculateEmi({
      principal: dto.requestedAmount,
      annualInterestRate: Number(resolved.partnerProduct?.interestRateOverride ?? resolved.product.defaultInterestRate),
      tenureMonths: dto.tenure,
    });
    const risk = assessLoanRisk({
      amount: dto.requestedAmount,
      tenureMonths: dto.tenure,
      monthlyIncome: applicant.monthlyIncome,
      employmentType: applicant.employmentType,
      existingMonthlyDebt: applicant.existingMonthlyDebt,
      creditScore: applicant.creditScore,
    });

    const application = await this.applicationsRepository.save(
      this.applicationsRepository.create({
        customerId: customer.id,
        createdById: user.id,
        applicationNumber: this.applicationNumber(),
        organizationId: resolved.product.organizationId,
        partnerId: resolved.partner?.id ?? null,
        productId: resolved.product.id,
        productVersionId: resolved.productVersion.id,
        amount: dto.requestedAmount,
        requestedAmount: moneyToString(dto.requestedAmount),
        tenureMonths: dto.tenure,
        monthlyIncome: applicant.monthlyIncome,
        employmentType: applicant.employmentType,
        existingMonthlyDebt: applicant.existingMonthlyDebt,
        creditScore: applicant.creditScore,
        purpose: applicant.purpose,
        status: LoanApplicationStatus.DRAFT,
        riskScore: risk.riskScore,
        approvalLikelihood: risk.approvalLikelihood,
        riskExplanation: risk.riskExplanation,
        scoreBreakdown: risk.scoreBreakdown,
        annualInterestRate: Number(resolved.partnerProduct?.interestRateOverride ?? resolved.product.defaultInterestRate),
        emi: emi.monthlyEmi,
        totalPayable: emi.totalPayable,
        totalInterest: emi.totalInterest,
        totalRepayableAmount: moneyToString(emi.totalPayable),
        dynamicFields: dto.dynamicFields ?? {},
        pricingBreakdown: pricing,
        currentWorkflowStep: 'draft',
        statusHistory: [this.legacyStatusEntry(LoanApplicationStatus.DRAFT, user.id, 'Configurable draft created')],
      }),
    );

    await this.auditLogService.create({
      action: 'CONFIGURABLE_APPLICATION_DRAFTED',
      entityType: 'LoanApplication',
      entityId: application.id,
      actorUserId: user.id,
      metadata: { productId: resolved.product.id, partnerId: resolved.partner?.id ?? null, requestedAmount: application.requestedAmount },
    });

    return { application, pricing, workflow: resolved.workflow };
  }

  async updateDraft(id: string, user: RequestUser, dto: UpdateConfigurableApplicationDto) {
    const application = await this.getApplication(id);
    this.ensureAccess(application, user);
    if (application.status !== LoanApplicationStatus.DRAFT) {
      throw new BadRequestException('Only draft configurable applications can be updated');
    }
    const resolved = await this.resolver.resolveForApplication(application);
    const nextDto = {
      productId: application.productId ?? resolved.product.id,
      partnerId: application.partnerId ?? undefined,
      requestedAmount: dto.requestedAmount ?? Number(application.requestedAmount ?? application.amount),
      tenure: dto.tenure ?? application.tenureMonths,
      applicant: dto.applicant ?? {
        monthlyIncome: application.monthlyIncome,
        employmentType: application.employmentType,
        existingMonthlyDebt: application.existingMonthlyDebt,
        creditScore: application.creditScore,
        purpose: application.purpose,
      },
      dynamicFields: dto.dynamicFields ?? application.dynamicFields ?? {},
    };
    this.validateApplicationInput(nextDto, resolved);
    const applicant = this.normalizeApplicant(nextDto.applicant);
    Object.assign(application, {
      amount: nextDto.requestedAmount,
      requestedAmount: moneyToString(nextDto.requestedAmount),
      tenureMonths: nextDto.tenure,
      monthlyIncome: applicant.monthlyIncome,
      employmentType: applicant.employmentType,
      existingMonthlyDebt: applicant.existingMonthlyDebt,
      creditScore: applicant.creditScore,
      purpose: applicant.purpose,
      dynamicFields: nextDto.dynamicFields,
      pricingBreakdown: this.pricing(nextDto.requestedAmount, resolved),
    });
    const saved = await this.applicationsRepository.save(application);
    await this.auditLogService.create({
      action: 'CONFIGURABLE_APPLICATION_DRAFT_UPDATED',
      entityType: 'LoanApplication',
      entityId: saved.id,
      actorUserId: user.id,
      metadata: { fields: Object.keys(dto) },
    });
    return saved;
  }

  async submit(id: string, user: RequestUser) {
    const application = await this.getApplication(id);
    this.ensureAccess(application, user);
    if (application.status !== LoanApplicationStatus.DRAFT) {
      throw new BadRequestException('Only draft applications can be submitted');
    }

    const resolved = await this.resolver.resolveForApplication(application);
    this.validateApplicationInput(
      {
        productId: application.productId ?? resolved.product.id,
        partnerId: application.partnerId ?? undefined,
        requestedAmount: Number(application.requestedAmount ?? application.amount),
        tenure: application.tenureMonths,
        applicant: {
          monthlyIncome: application.monthlyIncome,
          employmentType: application.employmentType,
          existingMonthlyDebt: application.existingMonthlyDebt,
          creditScore: application.creditScore,
          purpose: application.purpose,
        },
        dynamicFields: application.dynamicFields ?? {},
      },
      resolved,
    );

    const applicantSnapshot = this.applicantSnapshot(application);
    const ruleContext = this.ruleContext(application, resolved);
    const ruleEvaluation = this.ruleEngine.evaluateRules(resolved.rules, ruleContext);
    const pricing = application.pricingBreakdown ?? this.pricing(Number(application.requestedAmount ?? application.amount), resolved);
    const snapshotPayload = this.resolver.createSnapshotPayload(resolved, applicantSnapshot, pricing);

    return this.dataSource.transaction(async (manager) => {
      const snapshot = await manager.save(
        ApplicationConfigurationSnapshot,
        manager.create(ApplicationConfigurationSnapshot, {
          loanApplicationId: application.id,
          ...snapshotPayload,
        }),
      );

      application.configurationSnapshotId = snapshot.id;
      application.productSnapshot = snapshot.productSnapshot;
      application.partnerSnapshot = snapshot.partnerSnapshot;
      application.eligibilitySnapshot = { evaluations: ruleEvaluation.evaluations };
      application.workflowSnapshot = snapshot.workflowSnapshot;
      application.applicantSnapshot = applicantSnapshot;
      application.ruleEvaluationResult = ruleEvaluation;
      application.status = LoanApplicationStatus.SUBMITTED;
      application.submittedAt = new Date();
      application.currentWorkflowStep = 'submitted';
      application.statusHistory = this.appendLegacy(
        application.statusHistory,
        this.legacyStatusEntry(LoanApplicationStatus.SUBMITTED, user.id, 'Submitted configurable application'),
      );
      await manager.save(LoanApplication, application);
      await this.transition(manager, application.id, LoanApplicationStatus.DRAFT, LoanApplicationStatus.SUBMITTED, 'submit', user, 'Submitted');

      const nextStatus = this.statusAfterSubmission(ruleEvaluation.passed, resolved.workflow);
      application.status = nextStatus;
      application.currentWorkflowStep = resolved.workflow.find((step) => step.status === nextStatus)?.stepKey ?? nextStatus;
      application.statusHistory = this.appendLegacy(
        application.statusHistory,
        this.legacyStatusEntry(nextStatus, null, ruleEvaluation.reason),
      );
      const saved = await manager.save(LoanApplication, application);
      await this.transition(manager, application.id, LoanApplicationStatus.SUBMITTED, nextStatus, 'evaluate', null, ruleEvaluation.reason);

      await this.auditLogService.create({
        action: 'CONFIGURABLE_APPLICATION_SUBMITTED',
        entityType: 'LoanApplication',
        entityId: application.id,
        actorUserId: user.id,
        metadata: {
          productId: resolved.product.id,
          productVersionId: resolved.productVersion.id,
          snapshotId: snapshot.id,
          ruleEvaluation,
        },
      });

      return { application: saved, snapshot, ruleEvaluation, nextActions: this.workflowService.nextCustomerActions(saved.status, resolved.workflow) };
    });
  }

  async evaluate(id: string, user: RequestUser) {
    const application = await this.getApplication(id);
    this.ensureAccess(application, user);
    const resolved = await this.resolver.resolveForApplication(application);
    return this.ruleEngine.evaluateRules(resolved.rules, this.ruleContext(application, resolved));
  }

  async advanceOperationalStep(id: string, user: RequestUser, comments?: string) {
    const application = await this.getApplication(id);
    assertOrganizationAccess(user, application.organizationId, 'application');
    assertPermission(user, 'application.review');
    const allowedManualStatuses = [
      LoanApplicationStatus.KYC_PENDING,
      LoanApplicationStatus.DOCUMENT_PENDING,
      LoanApplicationStatus.DOCUMENT_VERIFICATION,
      LoanApplicationStatus.BANK_VERIFICATION_PENDING,
      LoanApplicationStatus.KYC_IN_PROGRESS,
    ];
    if (!allowedManualStatuses.includes(application.status)) {
      throw new BadRequestException('Current workflow step cannot be completed manually');
    }
    const resolved = await this.resolver.resolveForApplication(application);
    const next = this.workflowService.allowedNextStatuses(application.status, resolved.workflow)[0];
    if (!next) {
      throw new BadRequestException('No next workflow step is available');
    }
    return this.move(application, next, 'complete_step', user, comments ?? 'Operational step completed', resolved.workflow);
  }

  async approve(id: string, user: RequestUser, dto: DecisionDto) {
    const application = await this.getApplication(id);
    assertOrganizationAccess(user, application.organizationId, 'application');
    assertPermission(user, 'application.approve');
    this.assertMakerChecker(application, user);
    if (![LoanApplicationStatus.UNDER_REVIEW, LoanApplicationStatus.IN_REVIEW, LoanApplicationStatus.SUBMITTED].includes(application.status)) {
      throw new BadRequestException('Application is not waiting for approval');
    }
    const resolved = await this.resolver.resolveForApplication(application);
    application.approvedAmount = moneyToString(dto.approvedAmount ?? Number(application.requestedAmount ?? application.amount));
    application.sanctionedAmount = application.approvedAmount;
    application.grossDisbursementAmount = application.approvedAmount;
    application.netDisbursementAmount = subtractMoney(application.approvedAmount, application.upfrontDeductions ?? 0);
    application.reviewedAt = new Date();
    application.reviewerId = user.id;
    application.adminComment = dto.comments ?? null;
    const savedApproval = await this.move(application, LoanApplicationStatus.CREDIT_APPROVED, 'approve', user, dto.comments ?? 'Approved', resolved.workflow, false);
    const nextStatus = this.workflowService.statusAfterCreditApproval(resolved.workflow);
    return this.move(savedApproval, nextStatus, 'advance_after_approval', user, 'Advanced to next configured step', resolved.workflow);
  }

  async reject(id: string, user: RequestUser, dto: DecisionDto) {
    const application = await this.getApplication(id);
    assertOrganizationAccess(user, application.organizationId, 'application');
    assertPermission(user, 'application.reject');
    application.reviewedAt = new Date();
    application.reviewerId = user.id;
    application.adminComment = dto.comments ?? null;
    return this.move(application, LoanApplicationStatus.CREDIT_REJECTED, 'reject', user, dto.comments ?? 'Rejected', [], true);
  }

  async timeline(id: string, user: RequestUser) {
    const application = await this.getApplication(id);
    this.ensureAccess(application, user);
    return this.transitionsRepository.find({ where: { loanApplicationId: id }, order: { createdAt: 'ASC' } });
  }

  async nextActions(id: string, user: RequestUser) {
    const application = await this.getApplication(id);
    this.ensureAccess(application, user);
    const resolved = await this.resolver.resolveForApplication(application);
    return this.workflowService.nextCustomerActions(application.status, resolved.workflow);
  }

  async findAllForAdmin(user: RequestUser) {
    return this.applicationsRepository.find({
      where: organizationScopedWhere(user),
      order: { createdAt: 'DESC' },
      relations: { customer: true },
    });
  }

  async findOne(id: string, user: RequestUser) {
    const application = await this.getApplication(id);
    this.ensureAccess(application, user);
    return application;
  }

  private async move(
    application: LoanApplication,
    nextStatus: LoanApplicationStatus,
    action: string,
    user: RequestUser | null,
    reason: string,
    workflow: WorkflowStepSnapshot[],
    skipValidation = false,
  ) {
    if (!skipValidation) {
      this.workflowService.assertTransition(application.status, nextStatus, workflow);
    }
    const previous = application.status;
    application.status = nextStatus;
    application.currentWorkflowStep = workflow.find((step) => step.status === nextStatus)?.stepKey ?? nextStatus;
    application.statusHistory = this.appendLegacy(application.statusHistory, this.legacyStatusEntry(nextStatus, user?.id ?? null, reason));
    const saved = await this.applicationsRepository.save(application);
    await this.transition(null, application.id, previous, nextStatus, action, user, reason);
    await this.auditLogService.create({
      action: 'APPLICATION_STATUS_CHANGED',
      entityType: 'LoanApplication',
      entityId: application.id,
      actorUserId: user?.id ?? null,
      metadata: { previousStatus: previous, newStatus: nextStatus, reason },
    });
    return saved;
  }

  private async transition(
    manager: DataSource['manager'] | null,
    loanApplicationId: string,
    previousStatus: LoanApplicationStatus | null,
    newStatus: LoanApplicationStatus,
    action: string,
    user: RequestUser | null,
    reason: string,
  ) {
    const repository = manager ? manager.getRepository(ApplicationStatusTransition) : this.transitionsRepository;
    return repository.save(
      repository.create({
        loanApplicationId,
        previousStatus,
        newStatus,
        action,
        actorUserId: user?.id ?? null,
        actorRole: user?.role ?? null,
        reason,
      }),
    );
  }

  private statusAfterSubmission(passedRules: boolean, workflow: WorkflowStepSnapshot[]) {
    if (!passedRules) {
      return LoanApplicationStatus.CREDIT_REJECTED;
    }
    const next = this.workflowService.allowedNextStatuses(LoanApplicationStatus.SUBMITTED, workflow)[0];
    return next ?? LoanApplicationStatus.READY_FOR_DISBURSEMENT;
  }

  private validateApplicationInput(dto: CreateConfigurableApplicationDto, resolved: ResolvedConfiguration) {
    const partnerProduct = resolved.partnerProduct;
    const minimum = Number(partnerProduct?.minimumLoanAmount ?? resolved.product.minimumLoanAmount);
    const maximum = Number(partnerProduct?.maximumLoanAmount ?? resolved.product.maximumLoanAmount);
    if (dto.requestedAmount < minimum || dto.requestedAmount > maximum) {
      throw new BadRequestException(`Requested amount must be between ${minimum} and ${maximum}`);
    }
    if (dto.tenure < resolved.product.minimumTenure || dto.tenure > resolved.product.maximumTenure) {
      throw new BadRequestException(`Tenure must be between ${resolved.product.minimumTenure} and ${resolved.product.maximumTenure}`);
    }

    const dynamicFields = dto.dynamicFields ?? {};
    const missing = resolved.fields
      .filter((field) => field.required)
      .filter((field) => dynamicFields[field.fieldKey] === undefined || dynamicFields[field.fieldKey] === null || dynamicFields[field.fieldKey] === '')
      .map((field) => field.label);
    if (missing.length) {
      throw new BadRequestException(`Missing required fields: ${missing.join(', ')}`);
    }
  }

  private pricing(requestedAmount: number, resolved: ResolvedConfiguration) {
    const processingFee =
      resolved.product.processingFeeType === FeeType.PERCENTAGE
        ? percentageOf(requestedAmount, resolved.product.processingFeeValue)
        : moneyToString(resolved.product.processingFeeValue);
    const netDisbursementAmount = subtractMoney(requestedAmount, processingFee);
    return {
      requestedAmount: moneyToString(requestedAmount),
      processingFee,
      totalUpfrontDeductions: processingFee,
      grossDisbursementAmount: moneyToString(requestedAmount),
      netDisbursementAmount,
    };
  }

  private ruleContext(application: LoanApplication, resolved: ResolvedConfiguration) {
    return {
      applicant: {
        monthlyIncome: application.monthlyIncome,
        employmentType: application.employmentType,
        existingMonthlyDebt: application.existingMonthlyDebt,
        creditScore: application.creditScore,
        age: Number((application.dynamicFields ?? {}).age ?? 0),
      },
      application: {
        requestedAmount: Number(application.requestedAmount ?? application.amount),
        tenure: application.tenureMonths,
        dynamicFields: application.dynamicFields ?? {},
      },
      product: {
        minimumLoanAmount: Number(resolved.product.minimumLoanAmount),
        maximumLoanAmount: Number(resolved.partnerProduct?.maximumLoanAmount ?? resolved.product.maximumLoanAmount),
        minimumIncome: Number(resolved.product.minimumIncome ?? 0),
        requiredCreditScore: resolved.product.requiredCreditScore ?? 0,
      },
      partner: {
        id: resolved.partner?.id ?? null,
        partnerType: resolved.partner?.partnerType ?? null,
      },
    };
  }

  private applicantSnapshot(application: LoanApplication) {
    return {
      monthlyIncome: application.monthlyIncome,
      employmentType: application.employmentType,
      existingMonthlyDebt: application.existingMonthlyDebt,
      creditScore: application.creditScore,
      purpose: application.purpose,
      dynamicFields: application.dynamicFields ?? {},
    };
  }

  private async resolveCustomer(user: RequestUser, dto: CreateConfigurableApplicationDto, organizationId: string) {
    if (dto.customerId) {
      return this.customersService.findActiveForOrganization(dto.customerId, organizationId);
    }
    return this.customersService.findOrCreateFromApplicant(user, dto.applicant, organizationId);
  }

  // RBI expects segregation of duties: the staff member who captured an application cannot approve it.
  private assertMakerChecker(application: LoanApplication, user: RequestUser) {
    if (process.env.MAKER_CHECKER_ENABLED === 'false') {
      return;
    }
    if (application.createdById && application.createdById === user.id) {
      throw new ForbiddenException('Maker-checker: the staff member who created this application cannot approve it');
    }
  }

  private normalizeApplicant(input: CreateConfigurableApplicationDto['applicant']) {
    if (!Object.values(EmploymentType).includes(input.employmentType as EmploymentType)) {
      throw new BadRequestException('Unsupported employment type');
    }
    return {
      monthlyIncome: input.monthlyIncome,
      employmentType: input.employmentType as EmploymentType,
      existingMonthlyDebt: input.existingMonthlyDebt,
      creditScore: input.creditScore,
      purpose: input.purpose,
    };
  }

  private ensureActiveProduct(resolved: ResolvedConfiguration) {
    if (![MasterStatus.ACTIVE, MasterStatus.PUBLISHED].includes(resolved.product.status)) {
      throw new BadRequestException('Product is not active');
    }
    if (resolved.partner && resolved.partnerProduct?.status !== MasterStatus.ACTIVE) {
      throw new BadRequestException('Partner is not authorized for this product');
    }
  }

  private async getApplication(id: string) {
    const application = await this.applicationsRepository.findOne({ where: { id }, relations: { customer: true } });
    if (!application) {
      throw new NotFoundException('Loan application not found');
    }
    return application;
  }

  private ensureAccess(application: LoanApplication, user: RequestUser) {
    assertOrganizationAccess(user, application.organizationId, 'application');
  }

  private applicationNumber() {
    return `APP${Date.now()}${Math.floor(Math.random() * 900 + 100)}`;
  }

  private legacyStatusEntry(status: LoanApplicationStatus, actorUserId: string | null, comment: string) {
    return { status, actorUserId, comment, changedAt: new Date().toISOString() };
  }

  private appendLegacy(existing: Record<string, unknown>[] | null | undefined, entry: Record<string, unknown>) {
    return [...(Array.isArray(existing) ? existing : []), entry];
  }
}
