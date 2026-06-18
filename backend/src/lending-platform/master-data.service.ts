import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuditLogService } from '../audit-log/audit-log.service';
import {
  LoanApplication,
  LoanApplicationStatus,
  MasterStatus,
  Organization,
  Partner,
  PartnerProduct,
  Product,
  ProductApplicationField,
  ProductEligibilityRule,
  ProductVersion,
  ProductWorkflowDefinition,
  ProductWorkflowStep,
  ServiceProvider,
} from '../database/entities';
import {
  AssignPartnerProductDto,
  CreateApplicationFieldDto,
  CreateEligibilityRuleDto,
  CreateOrganizationDto,
  CreatePartnerDto,
  CreateProductDto,
  CreateServiceProviderDto,
  CreateWorkflowStepDto,
  UpdatePartnerDto,
  UpdateProductDto,
} from './dto';
import { moneyToString, rateToString } from './money.util';
import { RuleEngineService } from './rule-engine.service';

@Injectable()
export class MasterDataService {
  constructor(
    @InjectRepository(Organization)
    private readonly organizationsRepository: Repository<Organization>,
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    @InjectRepository(ProductVersion)
    private readonly productVersionsRepository: Repository<ProductVersion>,
    @InjectRepository(ProductApplicationField)
    private readonly fieldsRepository: Repository<ProductApplicationField>,
    @InjectRepository(ProductEligibilityRule)
    private readonly rulesRepository: Repository<ProductEligibilityRule>,
    @InjectRepository(ProductWorkflowDefinition)
    private readonly workflowDefinitionsRepository: Repository<ProductWorkflowDefinition>,
    @InjectRepository(ProductWorkflowStep)
    private readonly workflowStepsRepository: Repository<ProductWorkflowStep>,
    @InjectRepository(Partner)
    private readonly partnersRepository: Repository<Partner>,
    @InjectRepository(PartnerProduct)
    private readonly partnerProductsRepository: Repository<PartnerProduct>,
    @InjectRepository(ServiceProvider)
    private readonly providersRepository: Repository<ServiceProvider>,
    @InjectRepository(LoanApplication)
    private readonly applicationsRepository: Repository<LoanApplication>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly auditLogService: AuditLogService,
    private readonly ruleEngine: RuleEngineService,
  ) {}

  createOrganization(dto: CreateOrganizationDto, actorUserId: string) {
    return this.auditSave(
      this.organizationsRepository,
      this.organizationsRepository.create({
        ...dto,
        organizationCode: dto.organizationCode.toUpperCase(),
        defaultCurrency: dto.defaultCurrency ?? 'INR',
        timeZone: dto.timeZone ?? 'Asia/Kolkata',
        status: dto.status ?? MasterStatus.ACTIVE,
        createdBy: actorUserId,
        updatedBy: actorUserId,
      }),
      'ORGANIZATION_CREATED',
      'Organization',
      actorUserId,
    );
  }

  listOrganizations() {
    return this.organizationsRepository.find({ order: { createdAt: 'DESC' } });
  }

  async getOrganization(id: string) {
    const organization = await this.organizationsRepository.findOne({ where: { id } });
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }
    return organization;
  }

  async createProduct(dto: CreateProductDto, actorUserId: string) {
    this.validateProductAmounts(dto.minimumLoanAmount, dto.maximumLoanAmount);
    this.validateRateRange(dto.minimumInterestRate, dto.maximumInterestRate, dto.defaultInterestRate);

    return this.dataSource.transaction(async (manager) => {
      const product = await manager.save(
        Product,
        manager.create(Product, {
          ...dto,
          productCode: dto.productCode.toUpperCase(),
          status: dto.status ?? MasterStatus.DRAFT,
          currency: dto.currency ?? 'INR',
          effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : null,
          effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
          minimumLoanAmount: moneyToString(dto.minimumLoanAmount),
          maximumLoanAmount: moneyToString(dto.maximumLoanAmount),
          minimumInterestRate: rateToString(dto.minimumInterestRate),
          maximumInterestRate: rateToString(dto.maximumInterestRate),
          defaultInterestRate: rateToString(dto.defaultInterestRate),
          processingFeeValue: rateToString(dto.processingFeeValue ?? 0),
          minimumIncome: dto.minimumIncome === undefined ? null : moneyToString(dto.minimumIncome),
          createdBy: actorUserId,
          updatedBy: actorUserId,
        }),
      );

      const productVersion = await manager.save(
        ProductVersion,
        manager.create(ProductVersion, {
          productId: product.id,
          version: product.version,
          status: MasterStatus.DRAFT,
          effectiveFrom: product.effectiveFrom,
          effectiveTo: product.effectiveTo,
          configurationSnapshot: this.productSnapshot(product),
          createdBy: actorUserId,
        }),
      );

      await this.auditLogService.create({
        action: 'PRODUCT_CREATED',
        entityType: 'Product',
        entityId: product.id,
        actorUserId,
        metadata: { productCode: product.productCode, productVersionId: productVersion.id },
      });

      return { product, productVersion };
    });
  }

  async updateProduct(id: string, dto: UpdateProductDto, actorUserId: string) {
    const product = await this.getProductEntity(id);
    const submittedCount = await this.applicationsRepository.count({ where: { productId: id } });
    const financialKeys = ['minimumLoanAmount', 'maximumLoanAmount', 'defaultInterestRate', 'processingFeeValue'];
    if (submittedCount > 0 && financialKeys.some((key) => dto[key as keyof UpdateProductDto] !== undefined)) {
      throw new BadRequestException('Create a cloned product version before changing financial configuration already used by applications');
    }

    Object.assign(product, {
      ...dto,
      updatedBy: actorUserId,
      effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : product.effectiveFrom,
      effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : product.effectiveTo,
      minimumLoanAmount: dto.minimumLoanAmount === undefined ? product.minimumLoanAmount : moneyToString(dto.minimumLoanAmount),
      maximumLoanAmount: dto.maximumLoanAmount === undefined ? product.maximumLoanAmount : moneyToString(dto.maximumLoanAmount),
      minimumInterestRate: dto.minimumInterestRate === undefined ? product.minimumInterestRate : rateToString(dto.minimumInterestRate),
      maximumInterestRate: dto.maximumInterestRate === undefined ? product.maximumInterestRate : rateToString(dto.maximumInterestRate),
      defaultInterestRate: dto.defaultInterestRate === undefined ? product.defaultInterestRate : rateToString(dto.defaultInterestRate),
      processingFeeValue: dto.processingFeeValue === undefined ? product.processingFeeValue : rateToString(dto.processingFeeValue),
    });

    const saved = await this.productsRepository.save(product);
    await this.auditLogService.create({
      action: 'PRODUCT_UPDATED',
      entityType: 'Product',
      entityId: saved.id,
      actorUserId,
      metadata: { fields: Object.keys(dto) },
    });
    return saved;
  }

  listProducts() {
    return this.productsRepository.find({ order: { createdAt: 'DESC' } });
  }

  async getProduct(id: string) {
    const product = await this.productsRepository.findOne({
      where: { id },
      relations: { versions: true, applicationFields: true, eligibilityRules: true, workflowSteps: true },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }

  async cloneProduct(id: string, actorUserId: string) {
    const product = await this.getProduct(id);
    const cloned = this.productsRepository.create({
      ...product,
      id: undefined,
      productCode: `${product.productCode}_V${Date.now().toString().slice(-5)}`,
      name: `${product.name} Clone`,
      status: MasterStatus.DRAFT,
      version: 1,
      createdBy: actorUserId,
      updatedBy: actorUserId,
    });
    delete (cloned as Partial<Product>).versions;
    delete (cloned as Partial<Product>).applicationFields;
    delete (cloned as Partial<Product>).eligibilityRules;
    delete (cloned as Partial<Product>).workflowSteps;

    const saved = await this.productsRepository.save(cloned);
    const version = await this.productVersionsRepository.save(
      this.productVersionsRepository.create({
        productId: saved.id,
        version: 1,
        status: MasterStatus.DRAFT,
        configurationSnapshot: this.productSnapshot(saved),
        createdBy: actorUserId,
      }),
    );
    await this.auditLogService.create({
      action: 'PRODUCT_CLONED',
      entityType: 'Product',
      entityId: saved.id,
      actorUserId,
      metadata: { sourceProductId: id, productVersionId: version.id },
    });
    return { product: saved, productVersion: version };
  }

  async publishProduct(id: string, actorUserId: string) {
    const product = await this.getProductEntity(id);
    product.status = MasterStatus.PUBLISHED;
    product.updatedBy = actorUserId;
    const saved = await this.productsRepository.save(product);
    const version = await this.latestVersion(id);
    version.status = MasterStatus.PUBLISHED;
    version.publishedAt = new Date();
    version.configurationSnapshot = this.productSnapshot(saved);
    await this.productVersionsRepository.save(version);
    await this.auditLogService.create({
      action: 'PRODUCT_PUBLISHED',
      entityType: 'Product',
      entityId: id,
      actorUserId,
      metadata: { version: version.version },
    });
    return { product: saved, productVersion: version };
  }

  async setProductStatus(id: string, status: MasterStatus, actorUserId: string) {
    const product = await this.getProductEntity(id);
    product.status = status;
    product.updatedBy = actorUserId;
    const saved = await this.productsRepository.save(product);
    await this.auditLogService.create({
      action: status === MasterStatus.ACTIVE ? 'PRODUCT_ACTIVATED' : 'PRODUCT_DEACTIVATED',
      entityType: 'Product',
      entityId: id,
      actorUserId,
      metadata: { status },
    });
    return saved;
  }

  async listProductVersions(productId: string) {
    return this.productVersionsRepository.find({ where: { productId }, order: { version: 'DESC' } });
  }

  async addApplicationField(productId: string, dto: CreateApplicationFieldDto) {
    const version = await this.latestVersion(productId);
    return this.fieldsRepository.save(
      this.fieldsRepository.create({
        ...dto,
        productId,
        productVersionId: version.id,
        required: dto.required ?? false,
        displayOrder: dto.displayOrder ?? 0,
        sensitive: dto.sensitive ?? false,
      }),
    );
  }

  async addEligibilityRule(productId: string, dto: CreateEligibilityRuleDto, actorUserId: string) {
    this.ruleEngine.validateRuleDefinition(dto.ruleDefinition);
    const version = await this.latestVersion(productId);
    const existing = await this.rulesRepository.count({ where: { productId, ruleCode: dto.ruleCode } });
    return this.rulesRepository.save(
      this.rulesRepository.create({
        ...dto,
        productId,
        productVersionId: version.id,
        ruleCode: dto.ruleCode.toUpperCase(),
        version: existing + 1,
        status: MasterStatus.ACTIVE,
        score: dto.score ?? 0,
        createdBy: actorUserId,
        updatedBy: actorUserId,
      }),
    );
  }

  async addWorkflowStep(productId: string, dto: CreateWorkflowStepDto) {
    const version = await this.latestVersion(productId);
    const definition = await this.getOrCreateWorkflowDefinition(productId, version.id);
    if (!Object.values(LoanApplicationStatus).includes(dto.status as LoanApplicationStatus)) {
      throw new BadRequestException('Unsupported workflow status');
    }
    return this.workflowStepsRepository.save(
      this.workflowStepsRepository.create({
        ...dto,
        productId,
        productVersionId: version.id,
        workflowDefinitionId: definition.id,
        status: dto.status as LoanApplicationStatus,
        displayOrder: dto.displayOrder ?? 0,
      }),
    );
  }

  async applicationSchema(productId: string) {
    const product = await this.getProduct(productId);
    const version = await this.latestPublishedVersion(productId);
    const fields = await this.fieldsRepository.find({
      where: { productId, productVersionId: version.id },
      order: { displayOrder: 'ASC' },
    });
    const workflow = await this.workflowStepsRepository.find({
      where: { productId, productVersionId: version.id },
      order: { displayOrder: 'ASC' },
    });
    return { product, productVersion: version, fields, workflow };
  }

  createPartner(dto: CreatePartnerDto, actorUserId: string) {
    return this.auditSave(
      this.partnersRepository,
      this.partnersRepository.create({
        ...dto,
        partnerCode: dto.partnerCode.toUpperCase(),
        status: dto.status ?? MasterStatus.ACTIVE,
        createdBy: actorUserId,
        updatedBy: actorUserId,
      }),
      'PARTNER_CREATED',
      'Partner',
      actorUserId,
    );
  }

  listPartners() {
    return this.partnersRepository.find({ order: { createdAt: 'DESC' } });
  }

  async getPartner(id: string) {
    const partner = await this.partnersRepository.findOne({ where: { id }, relations: { productMappings: true } });
    if (!partner) {
      throw new NotFoundException('Partner not found');
    }
    return partner;
  }

  async updatePartner(id: string, dto: UpdatePartnerDto, actorUserId: string) {
    const partner = await this.getPartner(id);
    Object.assign(partner, { ...dto, updatedBy: actorUserId });
    const saved = await this.partnersRepository.save(partner);
    await this.auditLogService.create({
      action: 'PARTNER_UPDATED',
      entityType: 'Partner',
      entityId: id,
      actorUserId,
      metadata: { fields: Object.keys(dto) },
    });
    return saved;
  }

  async assignProductToPartner(partnerId: string, dto: AssignPartnerProductDto) {
    const partner = await this.getPartner(partnerId);
    const product = await this.getProductEntity(dto.productId);
    const version = dto.productVersionId
      ? await this.productVersionsRepository.findOne({ where: { id: dto.productVersionId } })
      : await this.latestPublishedVersion(product.id);
    if (!version) {
      throw new NotFoundException('Product version not found');
    }

    const existing = await this.partnerProductsRepository.findOne({ where: { partnerId, productId: product.id } });
    const mapping = existing ?? this.partnerProductsRepository.create({ partnerId, productId: product.id });
    Object.assign(mapping, {
      productVersionId: version.id,
      status: MasterStatus.ACTIVE,
      requiresKyc: dto.requiresKyc ?? product.requiresKyc,
      requiresBankVerification: dto.requiresBankVerification ?? product.requiresBankVerification,
      requiresDocumentVerification: dto.requiresDocumentVerification ?? false,
      requiresManualApproval: dto.requiresManualApproval ?? product.requiresManualApproval,
      allowsAutomatedApproval: dto.allowsAutomatedApproval ?? !product.requiresManualApproval,
      requiresAgreement: dto.requiresAgreement ?? product.requiresAgreement,
      requiresESign: dto.requiresESign ?? product.requiresESign,
      requiresENach: dto.requiresENach ?? product.requiresENach,
      requiresDisbursementConfirmation: dto.requiresDisbursementConfirmation ?? false,
      esignProviderId: dto.esignProviderId ?? null,
      enachProviderId: dto.enachProviderId ?? null,
      disbursementProviderId: dto.disbursementProviderId ?? null,
      workflowDefinitionId: dto.workflowDefinitionId ?? null,
      minimumLoanAmount: dto.minimumLoanAmount === undefined ? null : moneyToString(dto.minimumLoanAmount),
      maximumLoanAmount: dto.maximumLoanAmount === undefined ? null : moneyToString(dto.maximumLoanAmount),
      interestRateOverride: dto.interestRateOverride === undefined ? null : rateToString(dto.interestRateOverride),
      feeOverrides: dto.feeOverrides ?? null,
    });

    const saved = await this.partnerProductsRepository.save(mapping);
    await this.auditLogService.create({
      action: 'PARTNER_PRODUCT_ASSIGNED',
      entityType: 'PartnerProduct',
      entityId: saved.id,
      actorUserId: partner.createdBy ?? null,
      metadata: { partnerId: partner.id, productId: product.id, productVersionId: version.id },
    });
    return saved;
  }

  async removePartnerProduct(partnerId: string, productId: string) {
    await this.partnerProductsRepository.delete({ partnerId, productId });
    return { message: 'Product removed from partner' };
  }

  createServiceProvider(dto: CreateServiceProviderDto) {
    return this.providersRepository.save(
      this.providersRepository.create({
        ...dto,
        providerCode: dto.providerCode.toUpperCase(),
        status: dto.status ?? MasterStatus.ACTIVE,
        isSandbox: dto.isSandbox ?? true,
      }),
    );
  }

  listServiceProviders() {
    return this.providersRepository.find({ order: { createdAt: 'DESC' } });
  }

  private async latestVersion(productId: string) {
    const version = await this.productVersionsRepository.findOne({ where: { productId }, order: { version: 'DESC' } });
    if (!version) {
      throw new NotFoundException('Product version not found');
    }
    return version;
  }

  private async latestPublishedVersion(productId: string) {
    const version = await this.productVersionsRepository.findOne({
      where: [
        { productId, status: MasterStatus.PUBLISHED },
        { productId, status: MasterStatus.ACTIVE },
        { productId, status: MasterStatus.DRAFT },
      ],
      order: { version: 'DESC' },
    });
    if (!version) {
      throw new NotFoundException('Product version not found');
    }
    return version;
  }

  private async getOrCreateWorkflowDefinition(productId: string, productVersionId: string) {
    const existing = await this.workflowDefinitionsRepository.findOne({ where: { productId, productVersionId, workflowCode: 'DEFAULT' } });
    if (existing) {
      return existing;
    }
    return this.workflowDefinitionsRepository.save(
      this.workflowDefinitionsRepository.create({
        productId,
        productVersionId,
        workflowCode: 'DEFAULT',
        name: 'Default workflow',
        version: 1,
        status: MasterStatus.ACTIVE,
      }),
    );
  }

  private async getProductEntity(id: string) {
    const product = await this.productsRepository.findOne({ where: { id } });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }

  private validateProductAmounts(minimum: number, maximum: number) {
    if (minimum > maximum) {
      throw new BadRequestException('Minimum loan amount cannot exceed maximum loan amount');
    }
  }

  private validateRateRange(minimum: number, maximum: number, value: number) {
    if (minimum > maximum || value < minimum || value > maximum) {
      throw new BadRequestException('Default interest rate must be inside the configured range');
    }
  }

  private productSnapshot(product: Product) {
    return {
      id: product.id,
      organizationId: product.organizationId,
      productCode: product.productCode,
      name: product.name,
      productType: product.productType,
      version: product.version,
      currency: product.currency,
      minimumLoanAmount: product.minimumLoanAmount,
      maximumLoanAmount: product.maximumLoanAmount,
      minimumTenure: product.minimumTenure,
      maximumTenure: product.maximumTenure,
      defaultInterestRate: product.defaultInterestRate,
      processingFeeType: product.processingFeeType,
      processingFeeValue: product.processingFeeValue,
      requiresKyc: product.requiresKyc,
      requiresBankVerification: product.requiresBankVerification,
      requiresENach: product.requiresENach,
      requiresESign: product.requiresESign,
      requiresAgreement: product.requiresAgreement,
      requiresManualApproval: product.requiresManualApproval,
    };
  }

  private async auditSave<T extends { id: string }>(
    repository: Repository<T>,
    entity: T,
    action: string,
    entityType: string,
    actorUserId: string,
  ) {
    const saved = await repository.save(entity);
    await this.auditLogService.create({
      action,
      entityType,
      entityId: saved.id,
      actorUserId,
      metadata: { created: true },
    });
    return saved;
  }
}
