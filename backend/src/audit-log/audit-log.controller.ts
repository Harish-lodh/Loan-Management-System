import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Role } from '../database/entities/enums';
import { AuditLogService } from './audit-log.service';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';

@Controller('audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  findAll(@Query() query: AuditLogQueryDto) {
    return this.auditLogService.findAll(query);
  }

  @Get('verify')
  verify() {
    return this.auditLogService.verifyChain();
  }
}
