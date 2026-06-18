import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import {
  ApplicationConfigurationSnapshot,
  LoanApplication,
  MasterStatus,
  Partner,
  PartnerProduct,
  Product,
  ProductApplicationField,
  ProductEligibilityRule,
  ProductVersion,
  ProductWorkflowStep,
} from '../database/entities';
import { ResolvedCapabilityConfig, WorkflowService, WorkflowStepSnapshot } from './workflow.service';

export type ResolvedConfiguration = {
  product: Product;
  productVersion: ProductVersion;
  partner?: Partner | null;
  partnerProduct?: PartnerProduct | null;
  fields: ProductApplicationField[];
  rules: ProductEligibilityRule[];
  workflow: WorkflowStepSnapshot[];
  capabilities: ResolvedCapabilityConfig;
  source: 'snapshot' | 'live';
  snapshot?: ApplicationConfigurationSnapshot | null;
};

@Injectable()
export class ConfigurationResolverService {
  constructor(
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    @InjectRepository(ProductVersion)
    private readonly productVersionsRepository: Repository<ProductVersion>,
    @InjectRepository(Partner)
    private readonly partnersRepository: Repository<Partner>,
    @InjectRepository(PartnerProduct)
    private readonly partnerProductsRepository: Repository<PartnerProduct>,
    @InjectRepository(ProductApplicationField)
    private readonly fieldsRepository: Repository<ProductApplicationField>,
    @InjectRepository(ProductEligibilityRule)
    private readonly rulesRepository: Repository<ProductEligibilityRule>,
    @InjectRepository(ProductWorkflowStep)
    private readonly workflowStepsRepository: Repository<ProductWorkflowStep>,
    @InjectRepository(ApplicationConfigurationSnapshot)
    private readonly snapshotsRepository: Repository<ApplicationConfigurationSnapshot>,
    private readonly workflowService: WorkflowService,
  ) {}

  async resolveForApplication(application: LoanApplication): Promise<ResolvedConfiguration> {
    if (application.configurationSnapshotId) {
      const snapshot = await this.snapshotsRepository.findOne({ where: { id: application.configurationSnapshotId } });
      if (snapshot) {
        return this.fromSnapshot(snapshot);
      }
    }
    if (application.productId) {
      return this.resolveLive(application.productId, application.partnerId ?? undefined);
    }
    throw new NotFoundException('Application has no product configuration');
  }

  async resolveLive(productId: string, partnerId?: string | null): Promise<ResolvedConfiguration> {
    const product = await this.productsRepository.findOne({ where: { id: productId } });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const productVersion = await this.productVersionsRepository.findOne({
      where: [
        { productId, status: MasterStatus.PUBLISHED },
        { productId, status: MasterStatus.ACTIVE },
      ],
      order: { version: 'DESC' },
    });
    if (!productVersion) {
      throw new NotFoundException('Published product version not found');
    }

    const [partner, partnerProduct, fields, rules, workflowSteps] = await Promise.all([
      partnerId ? this.partnersRepository.findOne({ where: { id: partnerId } }) : Promise.resolve(null),
      partnerId ? this.partnerProductsRepository.findOne({ where: { partnerId, productId } }) : Promise.resolve(null),
      this.fieldsRepository.find({
        where: [
          { productId, productVersionId: productVersion.id },
          { productId, productVersionId: IsNull() },
        ],
        order: { displayOrder: 'ASC' },
      }),
      this.rulesRepository.find({
        where: [
          { productId, productVersionId: productVersion.id, status: In([MasterStatus.ACTIVE, MasterStatus.PUBLISHED]) },
          { productId, productVersionId: IsNull(), status: In([MasterStatus.ACTIVE, MasterStatus.PUBLISHED]) },
        ],
        order: { createdAt: 'ASC' },
      }),
      this.workflowStepsRepository.find({
        where: [
          { productId, productVersionId: productVersion.id },
          { productId, productVersionId: IsNull() },
        ],
        order: { displayOrder: 'ASC' },
      }),
    ]);

    const capabilities = this.resolveCapabilities(product, partnerProduct);
    const workflow = workflowSteps.length
      ? workflowSteps.map((step) => ({
          stepKey: step.stepKey,
          label: step.label,
          status: step.status,
          displayOrder: step.displayOrder,
          actorRole: step.actorRole,
        }))
      : this.workflowService.buildDefaultSteps(capabilities);

    return {
      product,
      productVersion,
      partner,
      partnerProduct,
      fields,
      rules,
      workflow,
      capabilities,
      source: 'live',
    };
  }

  createSnapshotPayload(resolved: ResolvedConfiguration, applicantSnapshot: Record<string, unknown>, pricingSnapshot: Record<string, unknown>) {
    return {
      organizationId: resolved.product.organizationId,
      productId: resolved.product.id,
      productVersionId: resolved.productVersion.id,
      partnerId: resolved.partner?.id ?? null,
      resolvedConfiguration: {
        capabilities: resolved.capabilities,
        precedence: ['applicationSnapshot', 'partnerProductOverride', 'productVersionConfiguration', 'organizationDefault'],
      },
      productSnapshot: this.safePlain(resolved.product),
      partnerSnapshot: resolved.partner ? this.safePlain(resolved.partner) : null,
      partnerProductSnapshot: resolved.partnerProduct ? this.safePlain(resolved.partnerProduct) : null,
      fieldsSnapshot: resolved.fields.map((field) => this.safePlain(field)),
      eligibilityRulesSnapshot: resolved.rules.map((rule) => this.safePlain(rule)),
      workflowSnapshot: resolved.workflow,
      applicantSnapshot,
      pricingSnapshot,
    };
  }

  private fromSnapshot(snapshot: ApplicationConfigurationSnapshot): ResolvedConfiguration {
    const product = snapshot.productSnapshot as unknown as Product;
    const productVersion = { id: snapshot.productVersionId, productId: snapshot.productId } as ProductVersion;
    return {
      product,
      productVersion,
      partner: snapshot.partnerSnapshot as Partner | null,
      partnerProduct: snapshot.partnerProductSnapshot as PartnerProduct | null,
      fields: snapshot.fieldsSnapshot as unknown as ProductApplicationField[],
      rules: snapshot.eligibilityRulesSnapshot as unknown as ProductEligibilityRule[],
      workflow: snapshot.workflowSnapshot as WorkflowStepSnapshot[],
      capabilities: (snapshot.resolvedConfiguration.capabilities ?? {}) as ResolvedCapabilityConfig,
      source: 'snapshot',
      snapshot,
    };
  }

  private resolveCapabilities(product: Product, partnerProduct?: PartnerProduct | null): ResolvedCapabilityConfig {
    return {
      requiresKyc: partnerProduct?.requiresKyc ?? product.requiresKyc,
      requiresBankVerification: partnerProduct?.requiresBankVerification ?? product.requiresBankVerification,
      requiresDocumentVerification: partnerProduct?.requiresDocumentVerification ?? false,
      requiresManualApproval: partnerProduct?.requiresManualApproval ?? product.requiresManualApproval,
      allowsAutomatedApproval: partnerProduct?.allowsAutomatedApproval ?? !product.requiresManualApproval,
      requiresAgreement: partnerProduct?.requiresAgreement ?? product.requiresAgreement,
      requiresESign: partnerProduct?.requiresESign ?? product.requiresESign,
      requiresENach: partnerProduct?.requiresENach ?? product.requiresENach,
      requiresDisbursementConfirmation: partnerProduct?.requiresDisbursementConfirmation ?? false,
    };
  }

  private safePlain(entity: object) {
    const {
      apiCredentialReference: _apiCredentialReference,
      credentialReference: _credentialReference,
      webhookSecretReference: _webhookSecretReference,
      ...safe
    } = entity as Record<string, unknown>;
    return safe;
  }
}
