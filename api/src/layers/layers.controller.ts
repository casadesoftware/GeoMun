import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { LayersService } from './layers.service';
import { CreateLayerDto } from './dto/create-layer.dto';
import { UpdateLayerDto } from './dto/update-layer.dto';
import { CreateFeatureDto, UpdateFeatureDto } from './dto/feature.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PlanGuard } from '../auth/guards/plan.guard';
import { PlanLimit } from '../auth/decorators/plan-limit.decorator';

@Controller('layers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LayersController {
  constructor(private layersService: LayersService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard, PlanGuard)
  @PlanLimit('layers')
  @Roles('ADMIN', 'EDITOR')
  create(@Body() dto: CreateLayerDto, @CurrentUser('id') userId: string) {
    return this.layersService.create(dto, userId);
  }

  @Get('map/:mapId')
  @Roles('ADMIN', 'EDITOR')
  findByMap(@Param('mapId') mapId: string) {
    return this.layersService.findByMap(mapId);
  }

  @Get(':id')
  @Roles('ADMIN', 'EDITOR')
  findOne(@Param('id') id: string) {
    return this.layersService.findOne(id);
  }

  @Put(':id')
  @Roles('ADMIN', 'EDITOR')
  update(@Param('id') id: string, @Body() dto: UpdateLayerDto, @CurrentUser() user: any) {
   return this.layersService.update(id, dto, user.role, user.id);
  }

  @Delete(':id')
  @Roles('ADMIN', 'EDITOR')
  remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.layersService.remove(id, userId);
  }

  // === Features ===

  @Post(':layerId/features')
  @Roles('ADMIN', 'EDITOR')
  createFeature(@Param('layerId') layerId: string, @Body() dto: CreateFeatureDto) {
    return this.layersService.createFeature(layerId, dto);
  }

  @Get(':layerId/features')
  @Roles('ADMIN', 'EDITOR')
  findFeatures(@Param('layerId') layerId: string) {
    return this.layersService.findFeaturesByLayer(layerId);
  }

  @Put('features/:featureId')
  @Roles('ADMIN', 'EDITOR')
  updateFeature(@Param('featureId') featureId: string, @Body() dto: UpdateFeatureDto) {
    return this.layersService.updateFeature(featureId, dto);
  }

  @Delete('features/:featureId')
  @Roles('ADMIN', 'EDITOR')
  removeFeature(@Param('featureId') featureId: string) {
    return this.layersService.removeFeature(featureId);
  }
}
