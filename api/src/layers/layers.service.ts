import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLayerDto } from './dto/create-layer.dto';
import { UpdateLayerDto } from './dto/update-layer.dto';
import { CreateFeatureDto, UpdateFeatureDto } from './dto/feature.dto';
import { AuditService } from '../audit/audit.service';


@Injectable()
export class LayersService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  // === Capas ===

  async create(dto: CreateLayerDto, userId: string) {
    const layer = await this.prisma.layer.create({
      data: { ...dto, createdBy: userId },
    });
    await this.audit.log(userId, 'CREATE', 'Layer', layer.id, { name: layer.name });
    return layer;
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

    const updated = await this.prisma.layer.update({ where: { id }, data: dto });
    await this.audit.log(id, 'UPDATE', 'Layer', id, { changes: Object.keys(dto) });
    return updated;
    
  }

  async remove(id: string, userId: string) {
    const layer = await this.prisma.layer.findUnique({ where: { id } });
    if (!layer) throw new NotFoundException('Capa no encontrada');
    await this.audit.log(userId, 'DELETE', 'Layer', id, { name: layer.name });
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
