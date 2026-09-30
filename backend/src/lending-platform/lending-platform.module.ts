import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { DATABASE_ENTITIES } from '../database/entities';
import { UsersModule } from '../users/users.module';
import { ConfigurableApplicationsService } from './configurable-applications.service';
import { ConfigurationResolverService } from './configuration-resolver.service';
import { DigioProvider } from './esign-providers/digio.provider';
import { DoqufyProvider } from './esign-providers/doqufy.provider';
import { ESignProviderRegistry } from './esign-providers/esign-provider.registry';
import { MockESignProvider } from './esign-providers/mock.provider';
import { DocumentsService } from './documents.service';
import { MasterDataService } from './master-data.service';
import {
  ConfigurableLoanApplicationsController,
  DisbursementsController,
  DocumentTemplatesController,
  ENachMandatesController,
  ESignRequestsController,
  OrganizationsController,
  PartnersController,
  ProductsController,
  ProviderWebhooksController,
  ServiceProvidersController,
} from './lending-platform.controllers';
import { ProviderOperationsService } from './provider-operations.service';
import { RuleEngineService } from './rule-engine.service';
import { WorkflowService } from './workflow.service';

@Module({
  imports: [TypeOrmModule.forFeature(DATABASE_ENTITIES), AuditLogModule, UsersModule, HttpModule],
  controllers: [
    OrganizationsController,
    ProductsController,
    PartnersController,
    ServiceProvidersController,
    ConfigurableLoanApplicationsController,
    DocumentTemplatesController,
    ESignRequestsController,
    ENachMandatesController,
    DisbursementsController,
    ProviderWebhooksController,
  ],
  providers: [
    MasterDataService,
    ConfigurableApplicationsService,
    ConfigurationResolverService,
    DocumentsService,
    ProviderOperationsService,
    RuleEngineService,
    WorkflowService,
    PermissionsGuard,
    DigioProvider,
    DoqufyProvider,
    MockESignProvider,
    ESignProviderRegistry,
  ],
  exports: [MasterDataService, ConfigurableApplicationsService, RuleEngineService, WorkflowService],
})
export class LendingPlatformModule {}
