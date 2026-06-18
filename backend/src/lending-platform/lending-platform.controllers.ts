import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequestUser } from '../common/types/request-user.interface';
import { MasterStatus } from '../database/entities';
import { ConfigurableApplicationsService } from './configurable-applications.service';
import { DocumentsService } from './documents.service';
import {
  AssignPartnerProductDto,
  CreateApplicationFieldDto,
  CreateConfigurableApplicationDto,
  CreateDocumentTemplateDto,
  CreateEligibilityRuleDto,
  CreateOrganizationDto,
  CreatePartnerDto,
  CreateProductDto,
  CreateServiceProviderDto,
  CreateWorkflowStepDto,
  DecisionDto,
  PreviewTemplateDto,
  ProviderWebhookDto,
  UpdateConfigurableApplicationDto,
  UpdatePartnerDto,
  UpdateProductDto,
} from './dto';
import { MasterDataService } from './master-data.service';
import { ProviderOperationsService } from './provider-operations.service';

@Controller('api/v1/organizations')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class OrganizationsController {
  constructor(private readonly masterData: MasterDataService) {}

  @Post()
  @Permissions('organization.create')
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateOrganizationDto) {
    return this.masterData.createOrganization(dto, user.id);
  }

  @Get()
  @Permissions('organization.view')
  list() {
    return this.masterData.listOrganizations();
  }

  @Get(':id')
  @Permissions('organization.view')
  get(@Param('id') id: string) {
    return this.masterData.getOrganization(id);
  }
}

@Controller('api/v1/products')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ProductsController {
  constructor(private readonly masterData: MasterDataService) {}

  @Post()
  @Permissions('product.create')
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateProductDto) {
    return this.masterData.createProduct(dto, user.id);
  }

  @Get()
  @Permissions('product.view')
  list() {
    return this.masterData.listProducts();
  }

  @Get(':id')
  @Permissions('product.view')
  get(@Param('id') id: string) {
    return this.masterData.getProduct(id);
  }

  @Patch(':id')
  @Permissions('product.update')
  update(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.masterData.updateProduct(id, dto, user.id);
  }

  @Post(':id/clone')
  @Permissions('product.create')
  clone(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.masterData.cloneProduct(id, user.id);
  }

  @Post(':id/publish')
  @Permissions('product.publish')
  publish(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.masterData.publishProduct(id, user.id);
  }

  @Post(':id/activate')
  @Permissions('product.update')
  activate(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.masterData.setProductStatus(id, MasterStatus.ACTIVE, user.id);
  }

  @Post(':id/deactivate')
  @Permissions('product.update')
  deactivate(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.masterData.setProductStatus(id, MasterStatus.INACTIVE, user.id);
  }

  @Get(':id/versions')
  @Permissions('product.view')
  versions(@Param('id') id: string) {
    return this.masterData.listProductVersions(id);
  }

  @Get(':id/application-schema')
  @Permissions('product.view')
  applicationSchema(@Param('id') id: string) {
    return this.masterData.applicationSchema(id);
  }

  @Post(':id/application-fields')
  @Permissions('product.update')
  addField(@Param('id') id: string, @Body() dto: CreateApplicationFieldDto) {
    return this.masterData.addApplicationField(id, dto);
  }

  @Post(':id/eligibility-rules')
  @Permissions('product.update')
  addRule(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: CreateEligibilityRuleDto) {
    return this.masterData.addEligibilityRule(id, dto, user.id);
  }

  @Post(':id/workflow-steps')
  @Permissions('product.update')
  addWorkflowStep(@Param('id') id: string, @Body() dto: CreateWorkflowStepDto) {
    return this.masterData.addWorkflowStep(id, dto);
  }
}

@Controller('api/v1/partners')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PartnersController {
  constructor(private readonly masterData: MasterDataService) {}

  @Post()
  @Permissions('partner.create')
  create(@CurrentUser() user: RequestUser, @Body() dto: CreatePartnerDto) {
    return this.masterData.createPartner(dto, user.id);
  }

  @Get()
  @Permissions('partner.view')
  list() {
    return this.masterData.listPartners();
  }

  @Get(':id')
  @Permissions('partner.view')
  get(@Param('id') id: string) {
    return this.masterData.getPartner(id);
  }

  @Patch(':id')
  @Permissions('partner.update')
  update(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: UpdatePartnerDto) {
    return this.masterData.updatePartner(id, dto, user.id);
  }

  @Post(':id/products')
  @Permissions('partner.update')
  assignProduct(@Param('id') id: string, @Body() dto: AssignPartnerProductDto) {
    return this.masterData.assignProductToPartner(id, dto);
  }

  @Delete(':id/products/:productId')
  @Permissions('partner.update')
  removeProduct(@Param('id') id: string, @Param('productId') productId: string) {
    return this.masterData.removePartnerProduct(id, productId);
  }
}

@Controller('api/v1/service-providers')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ServiceProvidersController {
  constructor(private readonly masterData: MasterDataService) {}

  @Post()
  @Permissions('provider.configure')
  create(@Body() dto: CreateServiceProviderDto) {
    return this.masterData.createServiceProvider(dto);
  }

  @Get()
  @Permissions('provider.view')
  list() {
    return this.masterData.listServiceProviders();
  }
}

@Controller('api/v1/loan-applications')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ConfigurableLoanApplicationsController {
  constructor(
    private readonly applications: ConfigurableApplicationsService,
    private readonly documents: DocumentsService,
    private readonly providers: ProviderOperationsService,
  ) {}

  @Post()
  @Permissions('application.create')
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateConfigurableApplicationDto) {
    return this.applications.createDraft(user, dto);
  }

  @Get()
  @Permissions('application.view')
  list() {
    return this.applications.findAllForAdmin();
  }

  @Get(':id')
  @Permissions('application.view')
  get(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.applications.findOne(id, user);
  }

  @Patch(':id')
  @Permissions('application.create')
  updateDraft(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: UpdateConfigurableApplicationDto) {
    return this.applications.updateDraft(id, user, dto);
  }

  @Post(':id/submit')
  @Permissions('application.create')
  submit(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.applications.submit(id, user);
  }

  @Post(':id/evaluate')
  @Permissions('application.view')
  evaluate(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.applications.evaluate(id, user);
  }

  @Post(':id/advance')
  @Permissions('application.review')
  advance(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: DecisionDto) {
    return this.applications.advanceOperationalStep(id, user, dto.comments);
  }

  @Post(':id/approve')
  @Permissions('application.approve')
  approve(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: DecisionDto) {
    return this.applications.approve(id, user, dto);
  }

  @Post(':id/reject')
  @Permissions('application.reject')
  reject(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: DecisionDto) {
    return this.applications.reject(id, user, dto);
  }

  @Get(':id/timeline')
  @Permissions('application.view')
  timeline(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.applications.timeline(id, user);
  }

  @Get(':id/next-actions')
  @Permissions('application.view')
  nextActions(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.applications.nextActions(id, user);
  }

  @Post(':id/agreements/generate')
  @Permissions('agreement.generate')
  generateAgreement(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.documents.generateAgreement(id, user);
  }

  @Get(':id/agreements')
  @Permissions('application.view')
  agreements(@Param('id') id: string) {
    return this.documents.listGeneratedDocuments(id);
  }

  @Post(':id/esign/initiate')
  @Permissions('esign.initiate')
  initiateESign(@CurrentUser() user: RequestUser, @Param('id') id: string, @Headers('idempotency-key') idempotencyKey?: string) {
    return this.providers.initiateESign(id, user, idempotencyKey);
  }

  @Post(':id/enach/initiate')
  @Permissions('enach.initiate')
  initiateENach(@CurrentUser() user: RequestUser, @Param('id') id: string, @Headers('idempotency-key') idempotencyKey?: string) {
    return this.providers.initiateENach(id, user, idempotencyKey);
  }

  @Post(':id/disbursements')
  @Permissions('disbursement.initiate')
  initiateDisbursement(@CurrentUser() user: RequestUser, @Param('id') id: string, @Headers('idempotency-key') idempotencyKey?: string) {
    return this.providers.initiateDisbursement(id, user, idempotencyKey);
  }
}

@Controller('api/v1/document-templates')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DocumentTemplatesController {
  constructor(private readonly documents: DocumentsService) {}

  @Post()
  @Permissions('agreement.template.manage')
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateDocumentTemplateDto) {
    return this.documents.createTemplate(dto, user);
  }

  @Get()
  @Permissions('agreement.template.view')
  list() {
    return this.documents.listTemplates();
  }

  @Get(':id')
  @Permissions('agreement.template.view')
  get(@Param('id') id: string) {
    return this.documents.getTemplate(id);
  }

  @Post(':id/preview')
  @Permissions('agreement.template.view')
  preview(@Param('id') id: string, @Body() dto: PreviewTemplateDto) {
    return this.documents.previewTemplate(id, dto);
  }

  @Post(':id/publish')
  @Permissions('agreement.template.manage')
  publish(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.documents.publishTemplate(id, user);
  }

  @Post(':id/clone')
  @Permissions('agreement.template.manage')
  clone(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.documents.cloneTemplate(id, user);
  }
}

@Controller('api/v1/esign-requests')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ESignRequestsController {
  constructor(private readonly providers: ProviderOperationsService) {}

  @Get(':id/status')
  @Permissions('application.view')
  status(@Param('id') id: string) {
    return this.providers.getESignStatus(id);
  }
}

@Controller('api/v1/enach-mandates')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ENachMandatesController {
  constructor(private readonly providers: ProviderOperationsService) {}

  @Get(':id/status')
  @Permissions('application.view')
  status(@Param('id') id: string) {
    return this.providers.getENachStatus(id);
  }

  @Post(':id/cancel')
  @Permissions('enach.initiate')
  cancel(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.providers.cancelENach(id, user);
  }
}

@Controller('api/v1/disbursements')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DisbursementsController {
  constructor(private readonly providers: ProviderOperationsService) {}

  @Get(':id')
  @Permissions('application.view')
  get(@Param('id') id: string) {
    return this.providers.getDisbursement(id);
  }

  @Post(':id/retry')
  @Permissions('disbursement.initiate')
  retry(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.providers.retryDisbursement(id, user);
  }
}

@Controller('api/v1/webhooks')
export class ProviderWebhooksController {
  constructor(private readonly providers: ProviderOperationsService) {}

  @Post('esign/:providerCode')
  esign(@Param('providerCode') providerCode: string, @Body() dto: ProviderWebhookDto, @Headers() headers: Record<string, string | string[] | undefined>) {
    return this.providers.handleESignWebhook(providerCode, dto, headers);
  }

  @Post('enach/:providerCode')
  enach(@Param('providerCode') providerCode: string, @Body() dto: ProviderWebhookDto, @Headers() headers: Record<string, string | string[] | undefined>) {
    return this.providers.handleENachWebhook(providerCode, dto, headers);
  }

  @Post('disbursement/:providerCode')
  disbursement(@Param('providerCode') providerCode: string, @Body() dto: ProviderWebhookDto, @Headers() headers: Record<string, string | string[] | undefined>) {
    return this.providers.handleDisbursementWebhook(providerCode, dto, headers);
  }
}
