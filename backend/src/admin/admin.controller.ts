import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { RequestUser } from '../common/types/request-user.interface';
import { Role } from '../database/entities';
import { AdminService } from './admin.service';
import { AdminLoanApplicationsQueryDto, AdminRepaymentsQueryDto, AdminUsersQueryDto } from './dto/admin-query.dto';
import { ApproveLoanDto } from './dto/approve-loan.dto';
import { RejectLoanDto } from './dto/reject-loan.dto';
import { UpdateRepaymentStatusDto } from './dto/update-repayment-status.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  dashboard() {
    return this.adminService.dashboard();
  }

  @Get('users')
  users(@Query() query: AdminUsersQueryDto) {
    return this.adminService.users(query);
  }

  @Get('users/:id')
  userDetails(@Param('id') id: string) {
    return this.adminService.userDetails(id);
  }

  @Get('loan-applications')
  loanApplications(@Query() query: AdminLoanApplicationsQueryDto) {
    return this.adminService.loanApplications(query);
  }

  @Get('loan-applications/:id')
  loanApplicationDetails(@Param('id') id: string) {
    return this.adminService.loanApplicationDetails(id);
  }

  @Patch('loan-applications/:id/approve')
  approve(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: ApproveLoanDto) {
    return this.adminService.approveLoanApplication(id, user.id, dto.comment);
  }

  @Patch('loan-applications/:id/reject')
  reject(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: RejectLoanDto) {
    return this.adminService.rejectLoanApplication(id, user.id, dto.comment);
  }

  @Get('repayments')
  repayments(@Query() query: AdminRepaymentsQueryDto) {
    return this.adminService.repayments(query);
  }

  @Patch('repayments/:id/status')
  updateRepaymentStatus(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateRepaymentStatusDto,
  ) {
    return this.adminService.updateRepaymentStatus(id, dto.status, user.id);
  }
}
