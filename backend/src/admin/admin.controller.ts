import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequestUser } from '../common/types/request-user.interface';
import { CreditOperationsService } from '../repayments/credit-operations.service';
import { AdminService } from './admin.service';
import { AdminLoanApplicationsQueryDto, AdminRepaymentsQueryDto, AdminUsersQueryDto } from './dto/admin-query.dto';
import { ApproveLoanDto } from './dto/approve-loan.dto';
import { RejectLoanDto } from './dto/reject-loan.dto';
import { RepaymentActionDto } from './dto/repayment-action.dto';
import { AssignStaffRoleDto, CreateStaffUserDto, UpdateStaffUserDto } from './dto/staff-user.dto';
import { UpdateRepaymentStatusDto } from './dto/update-repayment-status.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly creditOperations: CreditOperationsService,
  ) {}

  @Get('dashboard')
  @Permissions('dashboard.view')
  dashboard(@CurrentUser() user: RequestUser) {
    return this.adminService.dashboard(user);
  }

  @Get('loan-applications')
  @Permissions('application.view')
  loanApplications(@CurrentUser() user: RequestUser, @Query() query: AdminLoanApplicationsQueryDto) {
    return this.adminService.loanApplications(user, query);
  }

  @Get('loan-applications/:id')
  @Permissions('application.view')
  loanApplicationDetails(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.adminService.loanApplicationDetails(user, id);
  }

  @Patch('loan-applications/:id/approve')
  @Permissions('application.approve')
  approve(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: ApproveLoanDto) {
    return this.adminService.approveLoanApplication(id, user, dto.comment);
  }

  @Patch('loan-applications/:id/reject')
  @Permissions('application.reject')
  reject(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: RejectLoanDto) {
    return this.adminService.rejectLoanApplication(id, user, dto.comment);
  }

  @Get('repayments')
  @Permissions('repayment.view')
  repayments(@CurrentUser() user: RequestUser, @Query() query: AdminRepaymentsQueryDto) {
    return this.adminService.repayments(user, query);
  }

  @Patch('repayments/:id/status')
  @Permissions('repayment.update')
  updateRepaymentStatus(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateRepaymentStatusDto,
  ) {
    return this.adminService.updateRepaymentStatus(id, dto.status, user);
  }

  @Post('repayments/:id/bounce')
  @Permissions('repayment.update')
  markBounced(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: RepaymentActionDto) {
    return this.creditOperations.markBounced(id, user, dto.reason);
  }

  @Post('repayments/:id/waive-charges')
  @Permissions('penalty.waive')
  waiveCharges(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: RepaymentActionDto) {
    return this.creditOperations.waiveCharges(id, user, dto.reason);
  }

  @Get('staff-users')
  @Permissions('staff.manage')
  staffUsers(@CurrentUser() user: RequestUser, @Query() query: AdminUsersQueryDto) {
    return this.adminService.staffUsers(user, query);
  }

  @Post('staff-users')
  @Permissions('staff.manage')
  createStaffUser(@CurrentUser() user: RequestUser, @Body() dto: CreateStaffUserDto) {
    return this.adminService.createStaffUser(user, dto);
  }

  @Patch('staff-users/:id')
  @Permissions('staff.manage')
  updateStaffUser(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: UpdateStaffUserDto) {
    return this.adminService.updateStaffUser(user, id, dto);
  }

  @Post('staff-users/:id/roles')
  @Permissions('staff.manage')
  assignStaffRole(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: AssignStaffRoleDto) {
    return this.adminService.assignStaffRole(user, id, dto);
  }

  @Delete('staff-users/:id/roles/:organizationId/:roleName')
  @Permissions('staff.manage')
  removeStaffRole(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Param('organizationId') organizationId: string,
    @Param('roleName') roleName: string,
  ) {
    return this.adminService.removeStaffRole(user, id, organizationId, roleName);
  }
}
