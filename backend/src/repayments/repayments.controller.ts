import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RequestUser } from '../common/types/request-user.interface';
import { RepaymentsService } from './repayments.service';

@Controller('repayments')
@UseGuards(JwtAuthGuard)
export class RepaymentsController {
  constructor(private readonly repaymentsService: RepaymentsService) {}

  @Get('my')
  findMine(@CurrentUser() user: RequestUser) {
    return this.repaymentsService.findMine(user.id);
  }

  @Post(':id/mark-paid')
  markPaid(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.repaymentsService.markPaid(id, user.id);
  }
}
