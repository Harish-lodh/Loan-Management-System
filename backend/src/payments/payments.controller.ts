import { Body, Controller, Get, Headers, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequestUser } from '../common/types/request-user.interface';
import { PaymentsService } from './payments.service';

@Controller('api/v1/repayments')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PaymentCollectionController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post(':id/collect')
  @Permissions('payment.collect')
  initiate(@CurrentUser() user: RequestUser, @Param('id') id: string, @Headers('idempotency-key') idempotencyKey?: string) {
    return this.paymentsService.initiateCollection(id, user, idempotencyKey);
  }
}

@Controller('api/v1/payment-collections')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PaymentCollectionStatusController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get(':id')
  @Permissions('payment.collect')
  status(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.paymentsService.getStatus(id, user);
  }
}

@Controller('api/v1/webhooks/payment')
export class PaymentWebhookController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post(':providerCode')
  webhook(@Param('providerCode') providerCode: string, @Body() payload: Record<string, unknown>) {
    return this.paymentsService.handleWebhook(providerCode, payload);
  }
}
