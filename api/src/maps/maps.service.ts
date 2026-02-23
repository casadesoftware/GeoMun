import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMapDto } from './dto/create-map.dto';
import { UpdateMapDto } from './dto/update-map.dto';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class MapsService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  private slugify(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  async create(dto: CreateMapDto, userId: string, tenantId: string) {
    const slug = this.slugify(dto.name) + '-' + Date.now().toString(36);
    const map = await this.prisma.map.create({
      data: { ...dto, slug, createdBy: userId, tenantId },
    });
    await this.audit.log(userId, 'CREATE', 'Map', map.id, { name: map.name }, tenantId);
    return map;
  }

  async findAll(tenantId: string | null, role: string) {
    const where: any = {};
    if (role !== 'SUPERADMIN') {
      where.tenantId = tenantId;
    }
    return this.prisma.map.findMany({
      where,
      include: { layers: true, _count: { select: { layers: true } }, creator: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const map = await this.prisma.map.findUnique({
      where: { id },
      include: { layers: true, creator: { select: { name: true } } },
    });
    if (!map) throw new NotFoundException('Mapa no encontrado');
    return map;
  }

  async findPublicBySlug(slug: string) {
    const map = await this.prisma.map.findUnique({
      where: { slug },
      include: {
        layers: { where: { isPublic: true }, include: { features: true } },
        tenant: { select: { name: true, slug: true } },
      },
    });
    if (!map || !map.isPublic) throw new NotFoundException('Mapa no encontrado');
    return map;
  }

  async findPublicByTheme(theme: string) {
    return this.prisma.map.findMany({
      where: { isPublic: true, theme: { equals: theme, mode: 'insensitive' } },
      include: { layers: { where: { isPublic: true } }, _count: { select: { layers: true } } },
    });
  }

  async findAllPublic() {
    return this.prisma.map.findMany({
      where: { isPublic: true },
      include: {
        _count: { select: { layers: { where: { isPublic: true } } } },
        tenant: { select: { name: true, slug: true } },
      },
      orderBy: { theme: 'asc' },
    });
  }

  async update(id: string, dto: UpdateMapDto, userRole: string, userId: string) {
    const map = await this.prisma.map.findUnique({ where: { id } });
    if (!map) throw new NotFoundException('Mapa no encontrado');

    if (dto.isPublic !== undefined && userRole !== 'ADMIN' && userRole !== 'SUPERADMIN') {
      throw new ForbiddenException('Solo ADMIN puede cambiar la visibilidad');
    }

    const updated = await this.prisma.map.update({ where: { id }, data: dto });
    await this.audit.log(userId, 'UPDATE', 'Map', id, { changes: Object.keys(dto) }, map.tenantId);
    return updated;
  }

  async remove(id: string) {
    const map = await this.prisma.map.findUnique({ where: { id } });
    if (!map) throw new NotFoundException('Mapa no encontrado');
    await this.audit.log(id, 'DELETE', 'Map', id, { name: map.name }, map.tenantId);
    await this.prisma.map.delete({ where: { id } });
    return { message: 'Mapa eliminado' };
  }
}