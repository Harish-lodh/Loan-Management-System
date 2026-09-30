import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from '../database/entities';

// Public, unauthenticated: the shared frontend build calls this to show the NBFC's own name and logo
// on the login page and sidebar of each instance.
@Controller('tenant')
export class TenantController {
  constructor(
    private readonly config: ConfigService,
    @InjectRepository(Organization)
    private readonly organizationsRepository: Repository<Organization>,
  ) {}

  @Get('branding')
  async branding() {
    const code = this.config.get<string>('TENANT_ORG_CODE');
    const organization = code
      ? await this.organizationsRepository.findOne({ where: { organizationCode: code } })
      : await this.organizationsRepository.findOne({ where: {}, order: { createdAt: 'ASC' } });

    return {
      name: organization?.name ?? this.config.get<string>('TENANT_ORG_NAME') ?? 'Loan Management',
      legalName: organization?.legalName ?? null,
      logoUrl: organization?.logoUrl ?? null,
      supportEmail: (organization?.supportDetails?.email as string | undefined) ?? null,
      supportPhone: (organization?.supportDetails?.phone as string | undefined) ?? null,
    };
  }
}
