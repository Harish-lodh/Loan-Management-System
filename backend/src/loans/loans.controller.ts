import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApplyLoanDto } from './dto/apply-loan.dto';
import { CalculateEmiDto } from './dto/calculate-emi.dto';
import { UpdateLoanDraftDto } from './dto/update-loan-draft.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RequestUser } from '../common/types/request-user.interface';
import { LoansService } from './loans.service';

@Controller('loans')
@UseGuards(JwtAuthGuard)
export class LoansController {
  constructor(private readonly loansService: LoansService) {}

  @Post('apply')
  apply(@CurrentUser() user: RequestUser, @Body() dto: ApplyLoanDto) {
    return this.loansService.apply(user.id, dto);
  }

  @Post('drafts')
  saveDraft(@CurrentUser() user: RequestUser, @Body() dto: ApplyLoanDto) {
    return this.loansService.saveDraft(user.id, dto);
  }

  @Patch('applications/:id')
  updateDraft(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: UpdateLoanDraftDto) {
    return this.loansService.updateDraft(id, user, dto);
  }

  @Post('applications/:id/submit')
  submitApplication(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.loansService.submitApplication(id, user);
  }

  @Get('my')
  findMine(@CurrentUser() user: RequestUser) {
    return this.loansService.findMine(user.id);
  }

  @Get(':id')
  findOne(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.loansService.findOneForUser(id, user);
  }

  @Post(':id/calculate-emi')
  calculateEmi(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: CalculateEmiDto) {
    return this.loansService.calculateEmiForLoanOrApplication(id, user, dto.annualInterestRate);
  }

  @Get(':id/repayment-schedule')
  repaymentSchedule(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.loansService.getRepaymentSchedule(id, user);
  }
}
