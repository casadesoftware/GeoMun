import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { MapsService } from './maps.service';
import { CreateMapDto } from './dto/create-map.dto';
import { UpdateMapDto } from './dto/update-map.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('maps')
export class MapsController {
  constructor(private mapsService: MapsService) {}

  // === Endpoints públicos (sin auth) ===

  @Get('public')
  findAllPublic() {
    return this.mapsService.findAllPublic();
  }

  @Get('public/theme/:theme')
  findPublicByTheme(@Param('theme') theme: string) {
    return this.mapsService.findPublicByTheme(theme);
  }

  @Get('public/:slug')
  findPublicBySlug(@Param('slug') slug: string) {
    return this.mapsService.findPublicBySlug(slug);
  }

  // === Endpoints protegidos ===

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPERADMIN', 'ADMIN', 'EDITOR')
  create(@Body() dto: CreateMapDto, @CurrentUser() user: any) {
    return this.mapsService.create(dto, user.id, user.tenantId);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPERADMIN', 'ADMIN', 'EDITOR')
  findAll(@CurrentUser() user: any) {
    return this.mapsService.findAll(user.tenantId, user.role);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPERADMIN', 'ADMIN', 'EDITOR')
  findOne(@Param('id') id: string) {
    return this.mapsService.findOne(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPERADMIN', 'ADMIN', 'EDITOR')
  update(@Param('id') id: string, @Body() dto: UpdateMapDto, @CurrentUser() user: any) {
    return this.mapsService.update(id, dto, user.role, user.id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPERADMIN', 'ADMIN')
  remove(@Param('id') id: string) {
    return this.mapsService.remove(id);
  }
}