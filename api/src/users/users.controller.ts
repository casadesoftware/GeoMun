import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PlanGuard } from '../auth/guards/plan.guard';
import { PlanLimit } from '../auth/decorators/plan-limit.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPERADMIN', 'ADMIN')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard, PlanGuard)
  @PlanLimit('users')
  create(@Body() dto: CreateUserDto, @CurrentUser() user: any) {
    const tenantId = user.role === 'SUPERADMIN' && dto.tenantId ? dto.tenantId : user.tenantId;
    return this.usersService.create(dto, tenantId);
  }

  @Get()
  findAll(@CurrentUser() user: any) {
    return this.usersService.findAll(user.tenantId, user.role);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}