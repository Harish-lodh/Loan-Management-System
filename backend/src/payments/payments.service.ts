import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuditLogService } from '../audit-log/audit-log.service';
import { assertOrganizationAccess } from '../common/tenancy/organization-scope';
import { RequestUser } from '../common/types/request-user.interface';
import {
  Customer,
  Loan,
  LoanStatus,
  MasterStatus,
  NotificationType,
  PaymentCollectionRequest,
  PaymentCollectionStatus,
  PaymentCollectionStatusHistory,
  ProviderType,
  Repayment,
  RepaymentLedgerEntry,
  RepaymentLedgerTransactionType,
  RepaymentStatus,
  ServiceProvider,
} from '../database/entities';
import { roundMoney } from '../loans/loan-calculations';
import { NotificationsService } from '../notifications/notifications.service';
import { EasebuzzProvider } from './providers/easebuzz.provider';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(PaymentCollectionRequest)
    private readonly requestsRepository: Repository<PaymentCollectionRequest>,
    @InjectRepository(PaymentCollectionStatusHistory)
    private readonly historyRepository: Repository<PaymentCollectionStatusHistory>,
    @InjectRepository(Repayment)
    private readonly repaymentsRepository: Repository<Repayment>,
    @InjectRepository(Loan)
    private readonly loansRepository: Repository<Loan>,
    @InjectRepository(Customer)
    private readonly customersRepository: Repository<Customer>,
    @InjectRepository(ServiceProvider)
    private readonly providersRepository: Repository<ServiceProvider>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly easebuzzProvider: EasebuzzProvider,
    private readonly notificationsService: NotificationsService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async initiateCollection(repaymentId: string, user: RequestUser, idempotencyKey?: string) {
    const repayment = await this.repaymentsRepository.findOne({ where: { id: repaymentId }, relations: { loan: true } });
    if (!repayment || !repayment.loan) {
      throw new NotFoundException('Repayment not found');
    }
    assertOrganizationAccess(user, repayment.loan.organizationId, 'repayment');
    if (repayment.status === RepaymentStatus.PAID) {
      throw new BadRequestException('Repayment is already paid');
    }

    const existing = await this.requestsRepository.findOne({
      where: { repaymentId, status: PaymentCollectionStatus.LINK_CREATED },
      order: { createdAt: 'DESC' },
    });
    if (existing) {
      return existing;
    }

    const customer = await this.customersRepository.findOne({ where: { id: repayment.customerId } });
    if (!customer) {
      throw new NotFoundException('Customer not found for this repayment');
    }
    const provider = await this.resolveProvider(repayment.loan.organizationId ?? null);
    const referenceId = `PAY-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const amount = roundMoney(repayment.emiAmount - repayment.paidAmount);

    const link = await this.easebuzzProvider.createPaymentLink(
      {
        referenceId,
        amount,
        customerName: customer.fullName,
        customerEmail: customer.email ?? '',
        customerPhone: customer.phone,
        purpose: `EMI due ${repayment.dueDate.toDateString()}`,
      },
      provider,
    );

    const request = await this.requestsRepository.save(
      this.requestsRepository.create({
        organizationId: repayment.loan.organizationId ?? '',
        loanId: repayment.loanId,
        repaymentId: repayment.id,
        customerId: customer.id,
        partnerId: repayment.loan.partnerId ?? null,
        providerId: provider?.id ?? null,
        providerRequestId: link.providerReference,
        amount: amount.toFixed(2),
        paymentUrl: link.paymentUrl,
        status: PaymentCollectionStatus.LINK_CREATED,
        providerStatus: link.mock ? 'MOCK_LINK_CREATED' : 'LINK_CREATED',
        initiatedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        providerRequest: { ...link.request, idempotencyKey: idempotencyKey ?? null },
        providerResponse: link.response,
        createdBy: user.id,
      }),
    );
    await this.history(request.id, null, PaymentCollectionStatus.LINK_CREATED, user.id, 'Payment link created');
    await this.auditLogService.create({
      action: 'PAYMENT_COLLECTION_INITIATED',
      entityType: 'PaymentCollectionRequest',
      entityId: request.id,
      actorUserId: user.id,
      metadata: { repaymentId: repayment.id, amount: request.amount, mock: link.mock },
    });

    return request;
  }

  async getStatus(id: string, user: RequestUser) {
    const request = await this.requestsRepository.findOne({ where: { id }, relations: { statusHistory: true } });
    if (!request) {
      throw new NotFoundException('Payment collection request not found');
    }
    assertOrganizationAccess(user, request.organizationId, 'payment collection request');
    return request;
  }

  async handleWebhook(providerCode: string, payload: Record<string, unknown>) {
    const providerReference = String(payload.txnid ?? '');
    const request = await this.requestsRepository.findOne({ where: { providerRequestId: providerReference } });
    if (!request) {
      throw new NotFoundException('Payment collection request not found');
    }
    if (request.status === PaymentCollectionStatus.SUCCESS) {
      return { processed: false, duplicate: true, request };
    }

    const provider = request.providerId ? await this.providersRepository.findOne({ where: { id: request.providerId } }) : null;
    const result = this.easebuzzProvider.verifyWebhook(payload, provider);
    if (!result.verified) {
      throw new BadRequestException('INVALID_WEBHOOK_SIGNATURE');
    }

    if (!result.success) {
      const previous = request.status;
      request.status = PaymentCollectionStatus.FAILED;
      request.providerStatus = String(payload.status ?? 'FAILED');
      request.providerResponse = payload;
      const saved = await this.requestsRepository.save(request);
      await this.history(saved.id, previous, PaymentCollectionStatus.FAILED, null, `Verified ${providerCode} webhook`);
      return { processed: true, request: saved };
    }

    return this.completeCollection(request, providerCode, payload, result.bankReference ?? null);
  }

  private async completeCollection(
    request: PaymentCollectionRequest,
    providerCode: string,
    payload: Record<string, unknown>,
    bankReference: string | null,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const repayment = request.repaymentId
        ? await manager.findOne(Repayment, { where: { id: request.repaymentId } })
        : null;
      if (!repayment) {
        throw new NotFoundException('Repayment for this payment collection request no longer exists');
      }
      if (repayment.status === RepaymentStatus.PAID) {
        return { processed: false, duplicate: true, request };
      }

      const previousStatus = request.status;
      request.status = PaymentCollectionStatus.SUCCESS;
      request.providerStatus = String(payload.status ?? 'SUCCESS');
      request.completedAt = new Date();
      request.bankReference = bankReference;
      request.providerResponse = payload;
      const savedRequest = await manager.save(PaymentCollectionRequest, request);
      await manager.save(
        PaymentCollectionStatusHistory,
        manager.create(PaymentCollectionStatusHistory, {
          paymentCollectionRequestId: savedRequest.id,
          previousStatus,
          newStatus: PaymentCollectionStatus.SUCCESS,
          actorUserId: null,
          reason: `Verified ${providerCode} webhook`,
        }),
      );

      repayment.status = RepaymentStatus.PAID;
      repayment.paidAmount = repayment.emiAmount;
      repayment.paidAt = new Date();
      repayment.daysOverdue = 0;
      const savedRepayment = await manager.save(Repayment, repayment);

      const loan = await manager.findOneByOrFail(Loan, { id: repayment.loanId });
      loan.outstandingBalance = roundMoney(Math.max(0, Number(loan.outstandingBalance) - repayment.principalComponent));
      const totalRepayments = await manager.count(Repayment, { where: { loanId: repayment.loanId } });
      const paidRepayments = await manager.count(Repayment, { where: { loanId: repayment.loanId, status: RepaymentStatus.PAID } });
      if (totalRepayments > 0 && paidRepayments === totalRepayments) {
        loan.status = LoanStatus.CLOSED;
        loan.closedAt = new Date();
        loan.outstandingBalance = 0;
      }
      await manager.save(Loan, loan);

      await manager.save(
        RepaymentLedgerEntry,
        manager.create(RepaymentLedgerEntry, {
          organizationId: loan.organizationId ?? '',
          loanId: loan.id,
          repaymentId: repayment.id,
          transactionType: RepaymentLedgerTransactionType.PAYMENT_RECEIVED,
          principalAmount: repayment.principalComponent.toFixed(2),
          interestAmount: repayment.interestComponent.toFixed(2),
          feeAmount: '0.00',
          penaltyAmount: '0.00',
          totalAmount: savedRequest.amount,
          providerReference: savedRequest.providerRequestId,
          externalReference: bankReference,
        }),
      );

      // Tell the staff member who sent the payment link that the EMI has been collected.
      if (savedRequest.createdBy) {
        await this.notificationsService.create({
          userId: savedRequest.createdBy,
          title: 'EMI received',
          message: `EMI of ${repayment.emiAmount.toFixed(2)} for loan ${loan.loanAccountNumber ?? loan.id} was collected via ${providerCode}.`,
          type: NotificationType.REPAYMENT_RECEIVED,
          actionUrl: '/admin/repayments',
        });
      }
      await this.auditLogService.create({
        action: 'PAYMENT_COLLECTION_COMPLETED',
        entityType: 'PaymentCollectionRequest',
        entityId: savedRequest.id,
        actorUserId: null,
        metadata: { providerCode, repaymentId: repayment.id, loanId: loan.id, amount: savedRequest.amount },
      });

      return { processed: true, request: savedRequest, repayment: savedRepayment, loan };
    });
  }

  private async resolveProvider(organizationId: string | null) {
    if (!organizationId) {
      return null;
    }
    return this.providersRepository.findOne({
      where: { organizationId, providerType: ProviderType.PAYMENT_GATEWAY, status: MasterStatus.ACTIVE },
      order: { createdAt: 'ASC' },
    });
  }

  private history(
    paymentCollectionRequestId: string,
    previousStatus: PaymentCollectionStatus | null,
    newStatus: PaymentCollectionStatus,
    actorUserId: string | null,
    reason: string,
  ) {
    return this.historyRepository.save(
      this.historyRepository.create({ paymentCollectionRequestId, previousStatus, newStatus, actorUserId, reason }),
    );
  }
}
