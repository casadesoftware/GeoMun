import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLayerDto } from './dto/create-layer.dto';
import { UpdateLayerDto } from './dto/update-layer.dto';
import { CreateFeatureDto, UpdateFeatureDto } from './dto/feature.dto';

@Injectable()
export class LayersService {
  constructor(private prisma: PrismaService) {}

  // === Capas ===

  async create(dto: CreateLayerDto, userId: string) {
    return this.prisma.layer.create({
      data: { ...dto, createdBy: userId },
    });
  }

  async findByMap(mapId: string) {
    return this.prisma.layer.findMany({
      where: { mapId },
      include: { _count: { select: { features: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const layer = await this.prisma.layer.findUnique({
      where: { id },
      include: { features: true },
    });
    if (!layer) throw new NotFoundException('Capa no encontrada');
    return layer;
  }

  async update(id: string, dto: UpdateLayerDto, userRole: string) {
    const layer = await this.prisma.layer.findUnique({ where: { id } });
    if (!layer) throw new NotFoundException('Capa no encontrada');

    if (dto.isPublic !== undefined && userRole !== 'ADMIN') {
      throw new ForbiddenException('Solo ADMIN puede cambiar la visibilidad');
    }

    return this.prisma.layer.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    const layer = await this.prisma.layer.findUnique({ where: { id } });
    if (!layer) throw new NotFoundException('Capa no encontrada');
    await this.prisma.layer.delete({ where: { id } });
    return { message: 'Capa eliminada' };
  }

  // === Features (Geometrías) ===

  async createFeature(layerId: string, dto: CreateFeatureDto) {
    const layer = await this.prisma.layer.findUnique({ where: { id: layerId } });
    if (!layer) throw new NotFoundException('Capa no encontrada');

    return this.prisma.feature.create({
      data: { ...dto, layerId },
    });
  }

  async findFeaturesByLayer(layerId: string) {
    return this.prisma.feature.findMany({
      where: { layerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateFeature(featureId: string, dto: UpdateFeatureDto) {
    const feature = await this.prisma.feature.findUnique({ where: { id: featureId } });
    if (!feature) throw new NotFoundException('Feature no encontrado');

    return this.prisma.feature.update({ where: { id: featureId }, data: dto });
  }

  async removeFeature(featureId: string) {
    const feature = await this.prisma.feature.findUnique({ where: { id: featureId } });
    if (!feature) throw new NotFoundException('Feature no encontrado');
    await this.prisma.feature.delete({ where: { id: featureId } });
    return { message: 'Feature eliminado' };
  }
}
