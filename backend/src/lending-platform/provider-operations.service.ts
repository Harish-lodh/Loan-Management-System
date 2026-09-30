import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuditLogService } from '../audit-log/audit-log.service';
import { RequestUser } from '../common/types/request-user.interface';
import {
  Disbursement,
  DisbursementStatus,
  DisbursementStatusHistory,
  ENachMandate,
  ENachMandateStatus,
  ENachMandateStatusHistory,
  ESignRequest,
  ESignRequestStatus,
  ESignStatusHistory,
  GeneratedDocument,
  Loan,
  LoanApplication,
  LoanApplicationStatus,
  LoanStatus,
  ProviderType,
  ProviderWebhookEvent,
  Repayment,
  RepaymentLedgerEntry,
  RepaymentLedgerTransactionType,
  ServiceProvider,
  User,
} from '../database/entities';
import { generateRepaymentSchedule } from '../loans/loan-calculations';
import { ConfigurationResolverService } from './configuration-resolver.service';
import { DocumentsService } from './documents.service';
import { ESignProviderRegistry } from './esign-providers/esign-provider.registry';
import { moneyToString } from './money.util';
import { ProviderWebhookDto } from './dto';
import { assertOrganizationAccess } from './organization-scope';

@Injectable()
export class ProviderOperationsService {
  constructor(
    @InjectRepository(LoanApplication)
    private readonly applicationsRepository: Repository<LoanApplication>,
    @InjectRepository(GeneratedDocument)
    private readonly documentsRepository: Repository<GeneratedDocument>,
    @InjectRepository(ESignRequest)
    private readonly esignRepository: Repository<ESignRequest>,
    @InjectRepository(ESignStatusHistory)
    private readonly esignHistoryRepository: Repository<ESignStatusHistory>,
    @InjectRepository(ENachMandate)
    private readonly enachRepository: Repository<ENachMandate>,
    @InjectRepository(ENachMandateStatusHistory)
    private readonly enachHistoryRepository: Repository<ENachMandateStatusHistory>,
    @InjectRepository(Disbursement)
    private readonly disbursementsRepository: Repository<Disbursement>,
    @InjectRepository(DisbursementStatusHistory)
    private readonly disbursementHistoryRepository: Repository<DisbursementStatusHistory>,
    @InjectRepository(ProviderWebhookEvent)
    private readonly webhookEventsRepository: Repository<ProviderWebhookEvent>,
    @InjectRepository(ServiceProvider)
    private readonly providersRepository: Repository<ServiceProvider>,
    @InjectRepository(Loan)
    private readonly loansRepository: Repository<Loan>,
    @InjectRepository(Repayment)
    private readonly repaymentsRepository: Repository<Repayment>,
    @InjectRepository(RepaymentLedgerEntry)
    private readonly ledgerRepository: Repository<RepaymentLedgerEntry>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly resolver: ConfigurationResolverService,
    private readonly auditLogService: AuditLogService,
    private readonly documentsService: DocumentsService,
    private readonly esignProviders: ESignProviderRegistry,
  ) {}

  async initiateESign(applicationId: string, user: RequestUser, idempotencyKey?: string) {
    const application = await this.application(applicationId, user);
    if (application.status !== LoanApplicationStatus.ESIGN_PENDING) {
      throw new BadRequestException('Application is not waiting for eSign');
    }
    const existing = await this.esignRepository.findOne({ where: { loanApplicationId: applicationId } });
    if (existing) {
      return existing;
    }
    const agreement = await this.documentsRepository.findOne({
      where: { loanApplicationId: applicationId },
      order: { createdAt: 'DESC' },
    });
    if (!agreement) {
      throw new BadRequestException('Agreement must be generated before eSign');
    }

    const resolved = await this.resolver.resolveForApplication(application);
    const provider = await this.provider(resolved.product.organizationId, ProviderType.ESIGN, resolved.partnerProduct?.esignProviderId ?? null);
    const referenceId = `ESIGN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const adapter = this.esignProviders.resolve(provider?.providerCode);
    const customer = await this.usersRepository.findOneOrFail({ where: { id: application.userId } });
    const documentPdfBase64 = adapter.isMock ? '' : await this.documentsService.renderToPdfBase64(agreement.id, user);
    const signingRequest = await adapter.createSigningRequest(
      {
        referenceId,
        documentPdfBase64,
        fileName: agreement.fileName,
        signerName: customer.name,
        signerEmail: customer.email,
        signerPhone: customer.phone,
      },
      provider,
    );

    const request = await this.esignRepository.save(
      this.esignRepository.create({
        organizationId: resolved.product.organizationId,
        loanApplicationId: application.id,
        customerId: application.userId,
        partnerId: application.partnerId,
        productId: application.productId,
        providerId: provider?.id ?? null,
        agreementDocumentId: agreement.id,
        providerRequestId: signingRequest.providerReference,
        signingUrl: signingRequest.signingUrl,
        status: ESignRequestStatus.SIGNING_LINK_CREATED,
        providerStatus: signingRequest.mock ? 'MOCK_LINK_CREATED' : 'LINK_CREATED',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        providerRequest: { ...signingRequest.request, idempotencyKey: idempotencyKey ?? null },
        providerResponse: signingRequest.response,
      }),
    );
    await this.esignHistory(request.id, null, ESignRequestStatus.SIGNING_LINK_CREATED, user.id, 'Mock eSign link created');
    await this.auditLogService.create({
      action: 'ESIGN_INITIATED',
      entityType: 'ESignRequest',
      entityId: request.id,
      actorUserId: user.id,
      metadata: { loanApplicationId: application.id, providerCode: provider?.providerCode ?? 'MOCK_ESIGN' },
    });
    return request;
  }

  async getESignStatus(id: string, user: RequestUser) {
    const request = await this.esignRepository.findOne({ where: { id }, relations: { statusHistory: true } });
    if (!request) {
      throw new NotFoundException('eSign request not found');
    }
    assertOrganizationAccess(user, request.organizationId, 'eSign request');
    return request;
  }

  async initiateENach(applicationId: string, user: RequestUser, idempotencyKey?: string) {
    const application = await this.application(applicationId, user);
    if (application.status !== LoanApplicationStatus.ENACH_PENDING) {
      throw new BadRequestException('Application is not waiting for eNACH');
    }
    const existing = await this.enachRepository.findOne({ where: { loanApplicationId: applicationId } });
    if (existing) {
      return existing;
    }
    const resolved = await this.resolver.resolveForApplication(application);
    const provider = await this.provider(resolved.product.organizationId, ProviderType.ENACH, resolved.partnerProduct?.enachProviderId ?? null);
    const mandateReference = `ENACH-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const mandate = await this.enachRepository.save(
      this.enachRepository.create({
        organizationId: resolved.product.organizationId,
        loanApplicationId: application.id,
        customerId: application.userId,
        partnerId: application.partnerId,
        productId: application.productId,
        providerId: provider?.id ?? null,
        mandateReference,
        frequency: resolved.product.repaymentFrequency,
        maximumAmount: moneyToString(Number(application.emi) * 2),
        status: ENachMandateStatus.CUSTOMER_ACTION_PENDING,
        providerStatus: 'AUTHORIZATION_PENDING',
        providerRequest: { idempotencyKey: idempotencyKey ?? null, mock: true },
        providerResponse: { mandateReference, authorizationUrl: `https://mock-provider.local/enach/${mandateReference}` },
      }),
    );
    await this.enachHistory(mandate.id, null, ENachMandateStatus.CUSTOMER_ACTION_PENDING, user.id, 'Mock eNACH authorization created');
    await this.auditLogService.create({
      action: 'ENACH_INITIATED',
      entityType: 'ENachMandate',
      entityId: mandate.id,
      actorUserId: user.id,
      metadata: { loanApplicationId: application.id, providerCode: provider?.providerCode ?? 'MOCK_ENACH' },
    });
    return mandate;
  }

  async getENachStatus(id: string, user: RequestUser) {
    const mandate = await this.enachRepository.findOne({ where: { id }, relations: { statusHistory: true } });
    if (!mandate) {
      throw new NotFoundException('eNACH mandate not found');
    }
    assertOrganizationAccess(user, mandate.organizationId, 'eNACH mandate');
    return mandate;
  }

  async cancelENach(id: string, user: RequestUser) {
    const mandate = await this.enachRepository.findOne({ where: { id } });
    if (!mandate) {
      throw new NotFoundException('eNACH mandate not found');
    }
    assertOrganizationAccess(user, mandate.organizationId, 'eNACH mandate');
    const previous = mandate.status;
    mandate.status = ENachMandateStatus.CANCELLED;
    mandate.cancelledAt = new Date();
    const saved = await this.enachRepository.save(mandate);
    await this.enachHistory(mandate.id, previous, ENachMandateStatus.CANCELLED, user.id, 'Mandate cancelled');
    return saved;
  }

  async initiateDisbursement(applicationId: string, user: RequestUser, idempotencyKey?: string) {
    const application = await this.application(applicationId, user);
    if (application.status !== LoanApplicationStatus.READY_FOR_DISBURSEMENT) {
      throw new BadRequestException('Application is not ready for disbursement');
    }
    const existing = await this.disbursementsRepository.findOne({ where: { loanApplicationId: applicationId } });
    if (existing && ![DisbursementStatus.FAILED, DisbursementStatus.CANCELLED].includes(existing.status)) {
      return existing;
    }
    const resolved = await this.resolver.resolveForApplication(application);
    const provider = await this.provider(resolved.product.organizationId, ProviderType.DISBURSEMENT, resolved.partnerProduct?.disbursementProviderId ?? null);
    const disbursementReference = `DISB-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    application.status = LoanApplicationStatus.DISBURSEMENT_PENDING;
    await this.applicationsRepository.save(application);
    const disbursement = await this.disbursementsRepository.save(
      this.disbursementsRepository.create({
        organizationId: resolved.product.organizationId,
        loanApplicationId: application.id,
        customerId: application.userId,
        partnerId: application.partnerId,
        productId: application.productId,
        providerId: provider?.id ?? null,
        disbursementReference,
        amount: application.grossDisbursementAmount ?? application.approvedAmount ?? application.requestedAmount ?? moneyToString(application.amount),
        netAmount: application.netDisbursementAmount ?? application.approvedAmount ?? application.requestedAmount ?? moneyToString(application.amount),
        status: DisbursementStatus.PROCESSING,
        providerReference: `MOCK-${disbursementReference}`,
        providerRequest: { idempotencyKey: idempotencyKey ?? null, mock: true },
        providerResponse: { disbursementReference, status: 'PROCESSING' },
        initiatedAt: new Date(),
      }),
    );
    await this.disbursementHistory(disbursement.id, null, DisbursementStatus.PROCESSING, user.id, 'Mock disbursement initiated');
    await this.auditLogService.create({
      action: 'DISBURSEMENT_INITIATED',
      entityType: 'Disbursement',
      entityId: disbursement.id,
      actorUserId: user.id,
      metadata: { loanApplicationId: application.id, providerCode: provider?.providerCode ?? 'MOCK_DISB' },
    });
    return disbursement;
  }

  async getDisbursement(id: string, user: RequestUser) {
    const disbursement = await this.disbursementsRepository.findOne({ where: { id }, relations: { statusHistory: true } });
    if (!disbursement) {
      throw new NotFoundException('Disbursement not found');
    }
    assertOrganizationAccess(user, disbursement.organizationId, 'disbursement');
    return disbursement;
  }

  async retryDisbursement(id: string, user: RequestUser) {
    const disbursement = await this.disbursementsRepository.findOne({ where: { id } });
    if (!disbursement) {
      throw new NotFoundException('Disbursement not found');
    }
    assertOrganizationAccess(user, disbursement.organizationId, 'disbursement');
    if (![DisbursementStatus.FAILED, DisbursementStatus.CANCELLED].includes(disbursement.status)) {
      throw new BadRequestException('Only failed or cancelled disbursements can be retried');
    }
    return this.initiateDisbursement(disbursement.loanApplicationId, user);
  }

  async handleESignWebhook(providerCode: string, payload: ProviderWebhookDto, headers: Record<string, string | string[] | undefined>) {
    await this.verifyWebhook(providerCode, payload, headers, ProviderType.ESIGN);
    const request = await this.esignRepository.findOne({ where: { providerRequestId: payload.referenceId } });
    if (!request) {
      throw new NotFoundException('eSign request not found');
    }
    if (request.status === ESignRequestStatus.SIGNED) {
      return { processed: false, duplicate: true, request };
    }

    const provider = request.providerId ? await this.providersRepository.findOne({ where: { id: request.providerId } }) : null;
    const adapter = this.esignProviders.resolve(provider?.providerCode);
    if (!adapter.isMock) {
      const confirmed = await adapter.confirmStatus(request.providerRequestId, provider);
      if (confirmed.status !== 'SIGNED') {
        throw new BadRequestException(`Provider has not confirmed this document as signed (status: ${confirmed.status})`);
      }
    }

    const previous = request.status;
    request.status = ESignRequestStatus.SIGNED;
    request.providerStatus = payload.status;
    request.signedAt = new Date();
    request.providerResponse = payload.metadata ?? { ...payload };
    const saved = await this.esignRepository.save(request);
    await this.esignHistory(saved.id, previous, ESignRequestStatus.SIGNED, null, 'Verified mock eSign webhook');
    await this.advanceAfterESign(saved.loanApplicationId);
    await this.auditLogService.create({
      action: 'ESIGN_COMPLETED',
      entityType: 'ESignRequest',
      entityId: saved.id,
      actorUserId: null,
      metadata: { providerCode, eventId: payload.eventId },
    });
    return { processed: true, request: saved };
  }

  async handleENachWebhook(providerCode: string, payload: ProviderWebhookDto, headers: Record<string, string | string[] | undefined>) {
    await this.verifyWebhook(providerCode, payload, headers, ProviderType.ENACH);
    const mandate = await this.enachRepository.findOne({ where: { mandateReference: payload.referenceId } });
    if (!mandate) {
      throw new NotFoundException('eNACH mandate not found');
    }
    if (mandate.status === ENachMandateStatus.REGISTERED) {
      return { processed: false, duplicate: true, mandate };
    }
    const previous = mandate.status;
    mandate.status = ENachMandateStatus.REGISTERED;
    mandate.providerStatus = payload.status;
    mandate.registeredAt = new Date();
    mandate.providerResponse = payload.metadata ?? { ...payload };
    const saved = await this.enachRepository.save(mandate);
    await this.enachHistory(saved.id, previous, ENachMandateStatus.REGISTERED, null, 'Verified mock eNACH webhook');
    await this.advanceAfterENach(saved.loanApplicationId);
    await this.auditLogService.create({
      action: 'ENACH_REGISTERED',
      entityType: 'ENachMandate',
      entityId: saved.id,
      actorUserId: null,
      metadata: { providerCode, eventId: payload.eventId },
    });
    return { processed: true, mandate: saved };
  }

  async handleDisbursementWebhook(providerCode: string, payload: ProviderWebhookDto, headers: Record<string, string | string[] | undefined>) {
    await this.verifyWebhook(providerCode, payload, headers, ProviderType.DISBURSEMENT);
    const disbursement = await this.disbursementsRepository.findOne({ where: { disbursementReference: payload.referenceId } });
    if (!disbursement) {
      throw new NotFoundException('Disbursement not found');
    }
    if (disbursement.status === DisbursementStatus.SUCCESS) {
      return { processed: false, duplicate: true, disbursement };
    }
    return this.completeDisbursement(disbursement, providerCode, payload);
  }

  private async completeDisbursement(disbursement: Disbursement, providerCode: string, payload: ProviderWebhookDto) {
    return this.dataSource.transaction(async (manager) => {
      const application = await manager.findOneOrFail(LoanApplication, { where: { id: disbursement.loanApplicationId } });
      const existingLoan = await manager.findOne(Loan, { where: { applicationId: application.id } });
      if (existingLoan) {
        return { processed: false, duplicate: true, loan: existingLoan, disbursement };
      }

      const previous = disbursement.status;
      disbursement.status = DisbursementStatus.SUCCESS;
      disbursement.bankReference = String(payload.metadata?.bankReference ?? `BANK-${Date.now()}`);
      disbursement.utr = String(payload.metadata?.utr ?? `UTR${Date.now()}`);
      disbursement.completedAt = new Date();
      disbursement.providerResponse = payload.metadata ?? { ...payload };
      const savedDisbursement = await manager.save(Disbursement, disbursement);
      await manager.save(DisbursementStatusHistory, manager.create(DisbursementStatusHistory, {
        disbursementId: savedDisbursement.id,
        previousStatus: previous,
        newStatus: DisbursementStatus.SUCCESS,
        reason: 'Verified mock disbursement webhook',
      }));

      const startDate = new Date();
      const schedule = generateRepaymentSchedule({
        principal: Number(application.sanctionedAmount ?? application.approvedAmount ?? application.requestedAmount ?? application.amount),
        annualInterestRate: application.annualInterestRate,
        tenureMonths: application.tenureMonths,
        startDate,
      });
      const loan = await manager.save(Loan, manager.create(Loan, {
        userId: application.userId,
        applicationId: application.id,
        loanAccountNumber: `LAN${Date.now()}`,
        organizationId: application.organizationId,
        partnerId: application.partnerId,
        productId: application.productId,
        principal: Number(application.sanctionedAmount ?? application.amount),
        sanctionedAmount: application.sanctionedAmount ?? moneyToString(application.amount),
        disbursedAmount: disbursement.netAmount,
        annualInterestRate: application.annualInterestRate,
        tenureMonths: application.tenureMonths,
        repaymentFrequency: 'MONTHLY',
        emi: application.emi,
        totalPayable: application.totalPayable,
        outstandingBalance: Number(application.sanctionedAmount ?? application.amount),
        principalOutstanding: application.sanctionedAmount ?? moneyToString(application.amount),
        interestOutstanding: moneyToString(application.totalInterest),
        feeOutstanding: '0.00',
        penaltyOutstanding: '0.00',
        totalOutstanding: application.totalRepayableAmount ?? moneyToString(application.totalPayable),
        status: LoanStatus.ACTIVE,
        disbursedAt: startDate,
        startDate,
        firstDueDate: schedule[0]?.dueDate ?? null,
        maturityDate: schedule[schedule.length - 1]?.dueDate ?? null,
        statusHistory: [
          { status: LoanStatus.DISBURSED, changedAt: startDate.toISOString(), actorUserId: null, comment: 'Mock disbursement completed' },
          { status: LoanStatus.ACTIVE, changedAt: startDate.toISOString(), actorUserId: null, comment: 'Loan account activated' },
        ],
      }));
      savedDisbursement.loanId = loan.id;
      await manager.save(Disbursement, savedDisbursement);

      const repayments = schedule.map((item) => manager.create(Repayment, {
        loanId: loan.id,
        userId: application.userId,
        dueDate: item.dueDate,
        emiAmount: item.emiAmount,
        principalComponent: item.principalComponent,
        interestComponent: item.interestComponent,
      }));
      await manager.save(Repayment, repayments);

      await manager.save(RepaymentLedgerEntry, manager.create(RepaymentLedgerEntry, {
        organizationId: application.organizationId ?? '',
        loanId: loan.id,
        transactionType: RepaymentLedgerTransactionType.DISBURSEMENT,
        principalAmount: loan.disbursedAmount ?? moneyToString(loan.principal),
        interestAmount: '0.00',
        feeAmount: '0.00',
        penaltyAmount: '0.00',
        totalAmount: loan.disbursedAmount ?? moneyToString(loan.principal),
        providerReference: savedDisbursement.providerReference,
        externalReference: savedDisbursement.utr,
      }));
      await manager.save(RepaymentLedgerEntry, repayments.flatMap((repayment) => [
        manager.create(RepaymentLedgerEntry, {
          organizationId: application.organizationId ?? '',
          loanId: loan.id,
          repaymentId: repayment.id,
          transactionType: RepaymentLedgerTransactionType.PRINCIPAL_DUE,
          principalAmount: moneyToString(repayment.principalComponent),
          interestAmount: '0.00',
          feeAmount: '0.00',
          penaltyAmount: '0.00',
          totalAmount: moneyToString(repayment.principalComponent),
        }),
        manager.create(RepaymentLedgerEntry, {
          organizationId: application.organizationId ?? '',
          loanId: loan.id,
          repaymentId: repayment.id,
          transactionType: RepaymentLedgerTransactionType.INTEREST_DUE,
          principalAmount: '0.00',
          interestAmount: moneyToString(repayment.interestComponent),
          feeAmount: '0.00',
          penaltyAmount: '0.00',
          totalAmount: moneyToString(repayment.interestComponent),
        }),
      ]));

      application.status = LoanApplicationStatus.ACTIVE;
      application.statusHistory = [...(application.statusHistory ?? []), {
        status: LoanApplicationStatus.DISBURSED,
        changedAt: new Date().toISOString(),
        actorUserId: null,
        comment: 'Mock disbursement completed',
      }, {
        status: LoanApplicationStatus.ACTIVE,
        changedAt: new Date().toISOString(),
        actorUserId: null,
        comment: 'Loan account activated',
      }];
      await manager.save(LoanApplication, application);

      await this.auditLogService.create({
        action: 'DISBURSEMENT_COMPLETED',
        entityType: 'Disbursement',
        entityId: savedDisbursement.id,
        actorUserId: null,
        metadata: { providerCode, eventId: payload.eventId, loanId: loan.id },
      });
      return { processed: true, loan, disbursement: savedDisbursement };
    });
  }

  private async verifyWebhook(providerCode: string, payload: ProviderWebhookDto, headers: Record<string, string | string[] | undefined>, providerType: ProviderType) {
    const existing = await this.webhookEventsRepository.findOne({ where: { providerCode, providerEventId: payload.eventId } });
    if (existing?.processed) {
      return existing;
    }
    const signature = headers['x-mock-signature'];
    const signatureValue = Array.isArray(signature) ? signature[0] : signature;
    const verified = signatureValue === `mock-${providerCode}`;
    const event = existing ?? this.webhookEventsRepository.create({
      organizationId: String(payload.metadata?.organizationId ?? ''),
      providerCode,
      providerType,
      providerEventId: payload.eventId,
      eventType: payload.status,
      headersSnapshot: { 'x-mock-signature': signatureValue ? '[PRESENT]' : '[MISSING]' },
      payload: { ...payload },
      signatureVerified: verified,
      processed: false,
    });
    event.signatureVerified = verified;
    await this.webhookEventsRepository.save(event);
    if (!verified) {
      throw new BadRequestException('INVALID_WEBHOOK_SIGNATURE');
    }
    event.processed = true;
    event.processedAt = new Date();
    return this.webhookEventsRepository.save(event);
  }

  private async advanceAfterESign(loanApplicationId: string) {
    const application = await this.application(loanApplicationId);
    const resolved = await this.resolver.resolveForApplication(application);
    application.status = resolved.capabilities.requiresENach ? LoanApplicationStatus.ENACH_PENDING : LoanApplicationStatus.READY_FOR_DISBURSEMENT;
    application.statusHistory = [...(application.statusHistory ?? []), {
      status: LoanApplicationStatus.ESIGN_COMPLETED,
      changedAt: new Date().toISOString(),
      actorUserId: null,
      comment: 'eSign completed by verified provider webhook',
    }, {
      status: application.status,
      changedAt: new Date().toISOString(),
      actorUserId: null,
      comment: 'Advanced after eSign',
    }];
    await this.applicationsRepository.save(application);
  }

  private async advanceAfterENach(loanApplicationId: string) {
    const application = await this.application(loanApplicationId);
    application.status = LoanApplicationStatus.READY_FOR_DISBURSEMENT;
    application.statusHistory = [...(application.statusHistory ?? []), {
      status: LoanApplicationStatus.ENACH_REGISTERED,
      changedAt: new Date().toISOString(),
      actorUserId: null,
      comment: 'eNACH registered by verified provider webhook',
    }, {
      status: LoanApplicationStatus.READY_FOR_DISBURSEMENT,
      changedAt: new Date().toISOString(),
      actorUserId: null,
      comment: 'Ready for disbursement',
    }];
    await this.applicationsRepository.save(application);
  }

  private async provider(organizationId: string, providerType: ProviderType, preferredProviderId?: string | null) {
    if (preferredProviderId) {
      return this.providersRepository.findOne({ where: { id: preferredProviderId, organizationId } });
    }
    return this.providersRepository.findOne({ where: { organizationId, providerType }, order: { createdAt: 'ASC' } });
  }

  private async application(id: string, user?: RequestUser) {
    const application = await this.applicationsRepository.findOne({ where: { id } });
    if (!application) {
      throw new NotFoundException('Loan application not found');
    }
    if (user) {
      assertOrganizationAccess(user, application.organizationId, 'application');
    }
    return application;
  }

  private esignHistory(esignRequestId: string, previousStatus: ESignRequestStatus | null, newStatus: ESignRequestStatus, actorUserId: string | null, reason: string) {
    return this.esignHistoryRepository.save(this.esignHistoryRepository.create({ esignRequestId, previousStatus, newStatus, actorUserId, reason }));
  }

  private enachHistory(mandateId: string, previousStatus: ENachMandateStatus | null, newStatus: ENachMandateStatus, actorUserId: string | null, reason: string) {
    return this.enachHistoryRepository.save(this.enachHistoryRepository.create({ mandateId, previousStatus, newStatus, actorUserId, reason }));
  }

  private disbursementHistory(disbursementId: string, previousStatus: DisbursementStatus | null, newStatus: DisbursementStatus, actorUserId: string | null, reason: string) {
    return this.disbursementHistoryRepository.save(this.disbursementHistoryRepository.create({ disbursementId, previousStatus, newStatus, actorUserId, reason }));
  }
}
