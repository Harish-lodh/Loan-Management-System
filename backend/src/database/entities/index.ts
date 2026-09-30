import { ApplicationConfigurationSnapshot } from './application-configuration-snapshot.entity';
import { ApplicationStatusTransition } from './application-status-transition.entity';
import { AuditLog } from './audit-log.entity';
import { CustomerConsent } from './customer-consent.entity';
import { DisbursementStatusHistory } from './disbursement-status-history.entity';
import { Disbursement } from './disbursement.entity';
import { DocumentTemplateVersion } from './document-template-version.entity';
import { DocumentTemplate } from './document-template.entity';
import { ENachMandateStatusHistory } from './enach-mandate-status-history.entity';
import { ENachMandate } from './enach-mandate.entity';
import { ESignRequest } from './esign-request.entity';
import { ESignStatusHistory } from './esign-status-history.entity';
import { GeneratedDocument } from './generated-document.entity';
import { IdempotencyRecord } from './idempotency-record.entity';
import { LoanApplication } from './loan-application.entity';
import { Customer } from './customer.entity';
import { Loan } from './loan.entity';
import { Notification } from './notification.entity';
import { Organization } from './organization.entity';
import { PartnerProduct } from './partner-product.entity';
import { PartnerProviderConfiguration } from './partner-provider-configuration.entity';
import { Partner } from './partner.entity';
import { PaymentCollectionRequest } from './payment-collection-request.entity';
import { PaymentCollectionStatusHistory } from './payment-collection-status-history.entity';
import { Permission } from './permission.entity';
import { ProductApplicationField } from './product-application-field.entity';
import { ProductEligibilityRule } from './product-eligibility-rule.entity';
import { ProductProviderConfiguration } from './product-provider-configuration.entity';
import { ProductVersion } from './product-version.entity';
import { ProductWorkflowDefinition } from './product-workflow-definition.entity';
import { ProductWorkflowStep } from './product-workflow-step.entity';
import { Product } from './product.entity';
import { ProviderWebhookEvent } from './provider-webhook-event.entity';
import { RepaymentLedgerEntry } from './repayment-ledger-entry.entity';
import { Repayment } from './repayment.entity';
import { RolePermission } from './role-permission.entity';
import { ServiceProvider } from './service-provider.entity';
import { UserRole } from './user-role.entity';
import { User } from './user.entity';

export * from './application-configuration-snapshot.entity';
export * from './application-status-transition.entity';
export * from './audit-log.entity';
export * from './customer-consent.entity';
export * from './customer.entity';
export * from './disbursement-status-history.entity';
export * from './disbursement.entity';
export * from './document-template-version.entity';
export * from './document-template.entity';
export * from './enach-mandate-status-history.entity';
export * from './enach-mandate.entity';
export * from './enums';
export * from './esign-request.entity';
export * from './esign-status-history.entity';
export * from './generated-document.entity';
export * from './idempotency-record.entity';
export * from './loan-application.entity';
export * from './loan.entity';
export * from './notification.entity';
export * from './organization.entity';
export * from './partner-product.entity';
export * from './partner-provider-configuration.entity';
export * from './partner.entity';
export * from './payment-collection-request.entity';
export * from './payment-collection-status-history.entity';
export * from './permission.entity';
export * from './product-application-field.entity';
export * from './product-eligibility-rule.entity';
export * from './product-provider-configuration.entity';
export * from './product-version.entity';
export * from './product-workflow-definition.entity';
export * from './product-workflow-step.entity';
export * from './product.entity';
export * from './provider-webhook-event.entity';
export * from './repayment.entity';
export * from './repayment-ledger-entry.entity';
export * from './role-permission.entity';
export * from './service-provider.entity';
export * from './user-role.entity';
export * from './user.entity';

export const DATABASE_ENTITIES = [
  ApplicationConfigurationSnapshot,
  ApplicationStatusTransition,
  AuditLog,
  Customer,
  CustomerConsent,
  DisbursementStatusHistory,
  Disbursement,
  DocumentTemplateVersion,
  DocumentTemplate,
  ENachMandateStatusHistory,
  ENachMandate,
  ESignRequest,
  ESignStatusHistory,
  GeneratedDocument,
  IdempotencyRecord,
  LoanApplication,
  Loan,
  Notification,
  Organization,
  PartnerProduct,
  PartnerProviderConfiguration,
  Partner,
  PaymentCollectionRequest,
  PaymentCollectionStatusHistory,
  Permission,
  ProductApplicationField,
  ProductEligibilityRule,
  ProductProviderConfiguration,
  ProductVersion,
  ProductWorkflowDefinition,
  ProductWorkflowStep,
  Product,
  ProviderWebhookEvent,
  RepaymentLedgerEntry,
  Repayment,
  RolePermission,
  ServiceProvider,
  UserRole,
  User,
];
