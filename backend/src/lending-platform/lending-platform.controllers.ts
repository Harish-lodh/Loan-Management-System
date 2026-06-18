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
    return this.masterData.createOrganization(dto, user);
  }

  @Get()
  @Permissions('organization.view')
  list(@CurrentUser() user: RequestUser) {
    return this.masterData.listOrganizations(user);
  }

  @Get(':id')
  @Permissions('organization.view')
  get(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.masterData.getOrganization(id, user);
  }
}

@Controller('api/v1/products')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ProductsController {
  constructor(private readonly masterData: MasterDataService) {}

  @Post()
  @Permissions('product.create')
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateProductDto) {
    return this.masterData.createProduct(dto, user);
  }

  @Get()
  @Permissions('product.view')
  list(@CurrentUser() user: RequestUser) {
    return this.masterData.listProducts(user);
  }

  @Get(':id')
  @Permissions('product.view')
  get(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.masterData.getProduct(id, user);
  }

  @Patch(':id')
  @Permissions('product.update')
  update(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.masterData.updateProduct(id, dto, user);
  }

  @Post(':id/clone')
  @Permissions('product.create')
  clone(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.masterData.cloneProduct(id, user);
  }

  @Post(':id/publish')
  @Permissions('product.publish')
  publish(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.masterData.publishProduct(id, user);
  }

  @Post(':id/activate')
  @Permissions('product.update')
  activate(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.masterData.setProductStatus(id, MasterStatus.ACTIVE, user);
  }

  @Post(':id/deactivate')
  @Permissions('product.update')
  deactivate(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.masterData.setProductStatus(id, MasterStatus.INACTIVE, user);
  }

  @Get(':id/versions')
  @Permissions('product.view')
  versions(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.masterData.listProductVersions(id, user);
  }

  @Get(':id/application-schema')
  @Permissions('product.view')
  applicationSchema(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.masterData.applicationSchema(id, user);
  }

  @Post(':id/application-fields')
  @Permissions('product.update')
  addField(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: CreateApplicationFieldDto) {
    return this.masterData.addApplicationField(id, dto, user);
  }

  @Post(':id/eligibility-rules')
  @Permissions('product.update')
  addRule(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: CreateEligibilityRuleDto) {
    return this.masterData.addEligibilityRule(id, dto, user);
  }

  @Post(':id/workflow-steps')
  @Permissions('product.update')
  addWorkflowStep(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: CreateWorkflowStepDto) {
    return this.masterData.addWorkflowStep(id, dto, user);
  }
}

@Controller('api/v1/partners')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PartnersController {
  constructor(private readonly masterData: MasterDataService) {}

  @Post()
  @Permissions('partner.create')
  create(@CurrentUser() user: RequestUser, @Body() dto: CreatePartnerDto) {
    return this.masterData.createPartner(dto, user);
  }

  @Get()
  @Permissions('partner.view')
  list(@CurrentUser() user: RequestUser) {
    return this.masterData.listPartners(user);
  }

  @Get(':id')
  @Permissions('partner.view')
  get(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.masterData.getPartner(id, user);
  }

  @Patch(':id')
  @Permissions('partner.update')
  update(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: UpdatePartnerDto) {
    return this.masterData.updatePartner(id, dto, user);
  }

  @Post(':id/products')
  @Permissions('partner.update')
  assignProduct(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: AssignPartnerProductDto) {
    return this.masterData.assignProductToPartner(id, dto, user);
  }

  @Delete(':id/products/:productId')
  @Permissions('partner.update')
  removeProduct(@CurrentUser() user: RequestUser, @Param('id') id: string, @Param('productId') productId: string) {
    return this.masterData.removePartnerProduct(id, productId, user);
  }
}

@Controller('api/v1/service-providers')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ServiceProvidersController {
  constructor(private readonly masterData: MasterDataService) {}

  @Post()
  @Permissions('provider.configure')
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateServiceProviderDto) {
    return this.masterData.createServiceProvider(dto, user);
  }

  @Get()
  @Permissions('provider.view')
  list(@CurrentUser() user: RequestUser) {
    return this.masterData.listServiceProviders(user);
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
  list(@CurrentUser() user: RequestUser) {
    return this.applications.findAllForAdmin(user);
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
  agreements(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.documents.listGeneratedDocuments(id, user);
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
  list(@CurrentUser() user: RequestUser) {
    return this.documents.listTemplates(user);
  }

  @Get(':id')
  @Permissions('agreement.template.view')
  get(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.documents.getTemplate(id, user);
  }

  @Post(':id/preview')
  @Permissions('agreement.template.view')
  preview(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: PreviewTemplateDto) {
    return this.documents.previewTemplate(id, dto, user);
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
  status(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.providers.getESignStatus(id, user);
  }
}

@Controller('api/v1/enach-mandates')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ENachMandatesController {
  constructor(private readonly providers: ProviderOperationsService) {}

  @Get(':id/status')
  @Permissions('application.view')
  status(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.providers.getENachStatus(id, user);
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
  get(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.providers.getDisbursement(id, user);
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
