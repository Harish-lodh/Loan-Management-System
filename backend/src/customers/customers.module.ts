import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Customer, Organization, RolePermission, UserRole } from '../database/entities';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';

@Module({
  imports: [TypeOrmModule.forFeature([Customer, Organization, UserRole, RolePermission]), AuditLogModule],
  controllers: [CustomersController],
  providers: [CustomersService, PermissionsGuard],
  exports: [CustomersService],
})
export class CustomersModule {}
