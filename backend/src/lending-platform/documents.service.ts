import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { IsNull, Repository } from 'typeorm';
import { AuditLogService } from '../audit-log/audit-log.service';
import { RequestUser } from '../common/types/request-user.interface';
import {
  DocumentTemplate,
  DocumentTemplateStatus,
  DocumentTemplateVersion,
  DocumentType,
  GeneratedDocument,
  LoanApplication,
  LoanApplicationStatus,
  Role,
} from '../database/entities';
import { ConfigurationResolverService } from './configuration-resolver.service';
import { CreateDocumentTemplateDto, PreviewTemplateDto } from './dto';
import { assertOrganizationAccess, organizationScopedWhere, resolveOrganizationForCreate } from './organization-scope';
import { htmlToPdfBase64 } from './pdf.util';
import { WorkflowService } from './workflow.service';

const allowedPlaceholders = [
  'customer.fullName',
  'customer.address',
  'loan.applicationNumber',
  'loan.sanctionedAmount',
  'loan.interestRate',
  'loan.tenure',
  'loan.emiAmount',
  'loan.processingFee',
  'loan.disbursementDate',
  'organization.legalName',
  'partner.name',
  'repayment.firstDueDate',
];

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(DocumentTemplate)
    private readonly templatesRepository: Repository<DocumentTemplate>,
    @InjectRepository(DocumentTemplateVersion)
    private readonly templateVersionsRepository: Repository<DocumentTemplateVersion>,
    @InjectRepository(GeneratedDocument)
    private readonly generatedDocumentsRepository: Repository<GeneratedDocument>,
    @InjectRepository(LoanApplication)
    private readonly applicationsRepository: Repository<LoanApplication>,
    private readonly auditLogService: AuditLogService,
    private readonly resolver: ConfigurationResolverService,
    private readonly workflowService: WorkflowService,
  ) {}

  async createTemplate(dto: CreateDocumentTemplateDto, user: RequestUser) {
    this.ensureAdmin(user);
    const organizationId = resolveOrganizationForCreate(user, dto.organizationId, 'document template');
    const sanitized = this.sanitizeHtml(dto.templateHtml);
    const placeholders = this.extractPlaceholders(sanitized);
    this.validatePlaceholders(placeholders, dto.allowedPlaceholders ?? allowedPlaceholders);

    const template = await this.templatesRepository.save(
      this.templatesRepository.create({
        ...dto,
        organizationId,
        language: dto.language ?? 'en-IN',
        version: 1,
        status: DocumentTemplateStatus.DRAFT,
        templateHtml: sanitized,
        allowedPlaceholders: dto.allowedPlaceholders ?? allowedPlaceholders,
        createdBy: user.id,
        updatedBy: user.id,
      }),
    );
    const version = await this.templateVersionsRepository.save(
      this.templateVersionsRepository.create({
        templateId: template.id,
        version: 1,
        status: DocumentTemplateStatus.DRAFT,
        templateHtml: sanitized,
        placeholders,
        checksum: this.checksum(sanitized),
        createdBy: user.id,
      }),
    );
    await this.auditLogService.create({
      action: 'DOCUMENT_TEMPLATE_CREATED',
      entityType: 'DocumentTemplate',
      entityId: template.id,
      actorUserId: user.id,
      metadata: { documentType: template.documentType, version: version.version },
    });
    return { template, version };
  }

  listTemplates(user: RequestUser) {
    return this.templatesRepository.find({
      where: organizationScopedWhere(user),
      order: { createdAt: 'DESC' },
    });
  }

  async getTemplate(id: string, user: RequestUser) {
    const template = await this.templatesRepository.findOne({
      where: organizationScopedWhere(user, { id }),
      relations: { versions: true },
    });
    if (!template) {
      throw new NotFoundException('Document template not found');
    }
    return template;
  }

  async previewTemplate(id: string, dto: PreviewTemplateDto, user: RequestUser) {
    const template = await this.getTemplate(id, user);
    return { html: this.render(template.templateHtml, dto.sampleData) };
  }

  async publishTemplate(id: string, user: RequestUser) {
    this.ensureAdmin(user);
    const template = await this.getTemplate(id, user);
    template.status = DocumentTemplateStatus.PUBLISHED;
    template.updatedBy = user.id;
    const saved = await this.templatesRepository.save(template);
    const version = await this.templateVersionsRepository.findOne({ where: { templateId: id, version: template.version } });
    if (version) {
      version.status = DocumentTemplateStatus.PUBLISHED;
      version.publishedAt = new Date();
      await this.templateVersionsRepository.save(version);
    }
    await this.auditLogService.create({
      action: 'DOCUMENT_TEMPLATE_PUBLISHED',
      entityType: 'DocumentTemplate',
      entityId: id,
      actorUserId: user.id,
      metadata: { version: template.version },
    });
    return saved;
  }

  async cloneTemplate(id: string, user: RequestUser) {
    this.ensureAdmin(user);
    const template = await this.getTemplate(id, user);
    const clone = await this.templatesRepository.save(
      this.templatesRepository.create({
        ...template,
        id: undefined,
        version: 1,
        status: DocumentTemplateStatus.DRAFT,
        title: `${template.title} Copy`,
        createdBy: user.id,
        updatedBy: user.id,
      }),
    );
    return this.createTemplateVersion(clone, user.id);
  }

  async generateAgreement(applicationId: string, user: RequestUser) {
    this.ensureAdmin(user);
    const application = await this.applicationsRepository.findOne({ where: { id: applicationId }, relations: { user: true } });
    if (!application) {
      throw new NotFoundException('Loan application not found');
    }
    assertOrganizationAccess(user, application.organizationId, 'application');
    if (application.status !== LoanApplicationStatus.AGREEMENT_PENDING) {
      throw new BadRequestException('Application is not waiting for agreement generation');
    }
    const resolved = await this.resolver.resolveForApplication(application);
    const template = await this.findPublishedTemplate(
      resolved.product.organizationId,
      DocumentType.LOAN_AGREEMENT,
      resolved.product.id,
      resolved.partner?.id ?? null,
    );
    const version = await this.templateVersionsRepository.findOne({
      where: { templateId: template.id, status: DocumentTemplateStatus.PUBLISHED },
      order: { version: 'DESC' },
    });
    const html = this.render(template.templateHtml, {
      customer: {
        fullName: application.user?.name ?? 'Customer',
        address: application.user?.address ?? '',
      },
      loan: {
        applicationNumber: application.applicationNumber ?? application.id,
        sanctionedAmount: application.sanctionedAmount ?? application.requestedAmount,
        interestRate: application.annualInterestRate,
        tenure: application.tenureMonths,
        emiAmount: application.emi,
        processingFee: (application.pricingBreakdown as Record<string, unknown> | null)?.processingFee ?? '0.00',
        disbursementDate: '',
      },
      organization: {
        legalName: 'Lender',
      },
      partner: {
        name: resolved.partner?.name ?? '',
      },
      repayment: {
        firstDueDate: '',
      },
    });

    const document = await this.generatedDocumentsRepository.save(
      this.generatedDocumentsRepository.create({
        organizationId: resolved.product.organizationId,
        loanApplicationId: application.id,
        templateVersionId: version?.id ?? null,
        documentType: DocumentType.LOAN_AGREEMENT,
        fileName: `${application.applicationNumber ?? application.id}-loan-agreement.html`,
        contentHtml: html,
        checksum: this.checksum(html),
        generatedBy: user.id,
        immutable: true,
      }),
    );

    const previousStatus = application.status;
    application.status = resolved.capabilities.requiresESign ? LoanApplicationStatus.ESIGN_PENDING : LoanApplicationStatus.ENACH_PENDING;
    if (!resolved.capabilities.requiresESign && !resolved.capabilities.requiresENach) {
      application.status = LoanApplicationStatus.READY_FOR_DISBURSEMENT;
    }
    application.statusHistory = [...(application.statusHistory ?? []), {
      status: LoanApplicationStatus.AGREEMENT_GENERATED,
      changedAt: new Date().toISOString(),
      actorUserId: user.id,
      comment: 'Agreement generated',
    }, {
      status: application.status,
      changedAt: new Date().toISOString(),
      actorUserId: null,
      comment: 'Advanced after agreement generation',
    }];
    await this.applicationsRepository.save(application);

    await this.auditLogService.create({
      action: 'AGREEMENT_GENERATED',
      entityType: 'GeneratedDocument',
      entityId: document.id,
      actorUserId: user.id,
      metadata: { loanApplicationId: application.id, previousStatus, newStatus: application.status, checksum: document.checksum },
    });

    return { document, application };
  }

  async renderToPdfBase64(documentId: string, user: RequestUser) {
    const document = await this.generatedDocumentsRepository.findOne({ where: { id: documentId } });
    if (!document) {
      throw new NotFoundException('Generated document not found');
    }
    assertOrganizationAccess(user, document.organizationId, 'document');
    return htmlToPdfBase64(document.contentHtml ?? '');
  }

  async listGeneratedDocuments(applicationId: string, user: RequestUser) {
    const application = await this.applicationsRepository.findOne({ where: { id: applicationId } });
    if (!application) {
      throw new NotFoundException('Loan application not found');
    }
    assertOrganizationAccess(user, application.organizationId, 'application');
    return this.generatedDocumentsRepository.find({
      where: { loanApplicationId: applicationId },
      order: { createdAt: 'DESC' },
    });
  }

  private async createTemplateVersion(template: DocumentTemplate, actorUserId: string) {
    const version = await this.templateVersionsRepository.save(
      this.templateVersionsRepository.create({
        templateId: template.id,
        version: 1,
        status: DocumentTemplateStatus.DRAFT,
        templateHtml: template.templateHtml,
        placeholders: this.extractPlaceholders(template.templateHtml),
        checksum: this.checksum(template.templateHtml),
        createdBy: actorUserId,
      }),
    );
    return { template, version };
  }

  private async findPublishedTemplate(organizationId: string, documentType: DocumentType, productId: string, partnerId: string | null) {
    const exactPartnerMatch = partnerId
      ? [{ organizationId, documentType, productId, partnerId, status: DocumentTemplateStatus.PUBLISHED }]
      : [];
    const matches = await this.templatesRepository.find({
      where: [
        ...exactPartnerMatch,
        { organizationId, documentType, productId, partnerId: IsNull(), status: DocumentTemplateStatus.PUBLISHED },
        { organizationId, documentType, productId: IsNull(), partnerId: IsNull(), status: DocumentTemplateStatus.PUBLISHED },
      ],
      order: { version: 'DESC' },
    });
    if (!matches.length) {
      throw new NotFoundException('Published agreement template not found');
    }
    return matches[0];
  }

  private render(template: string, data: Record<string, unknown>) {
    return template.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_match, path: string) => {
      const value = path.split('.').reduce<unknown>((current, key) => {
        if (current && typeof current === 'object' && key in current) {
          return (current as Record<string, unknown>)[key];
        }
        return '';
      }, data);
      return this.escapeHtml(String(value ?? ''));
    });
  }

  private extractPlaceholders(template: string) {
    return [...template.matchAll(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g)].map((match) => match[1]);
  }

  private validatePlaceholders(placeholders: string[], allowed: string[]) {
    const invalid = placeholders.filter((placeholder) => !allowed.includes(placeholder));
    if (invalid.length) {
      throw new BadRequestException(`Unsupported placeholders: ${invalid.join(', ')}`);
    }
  }

  private sanitizeHtml(html: string) {
    return html
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
      .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  }

  private checksum(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }

  private escapeHtml(value: string) {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  private ensureAdmin(user: RequestUser) {
    if (user.role !== Role.ADMIN) {
      throw new BadRequestException('Admin access is required');
    }
  }
}
