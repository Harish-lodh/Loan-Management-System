import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organization } from '../database/entities';
import { TenantController } from './tenant.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Organization])],
  controllers: [TenantController],
})
export class TenantModule {}
