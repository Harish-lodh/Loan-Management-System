import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RequestUser } from '../common/types/request-user.interface';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  profile(@CurrentUser() user: RequestUser) {
    return this.usersService.findSafeById(user.id);
  }

  @Patch('profile')
  updateProfile(@CurrentUser() user: RequestUser, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.id, dto);
  }

  @Patch('profile/password')
  changePassword(@CurrentUser() user: RequestUser, @Body() dto: ChangePasswordDto) {
    return this.usersService.changePassword(user.id, dto);
  }
}
