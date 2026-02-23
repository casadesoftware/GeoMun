import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  async create(dto: CreateUserDto, tenantId: string | null) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new ConflictException('El email ya está registrado');

    const hash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: { ...dto, password: hash, tenantId },
    });
    const { password, ...result } = user;
    await this.audit.log(result.id, 'CREATE', 'User', result.id, { email: result.email, role: result.role }, tenantId);
    return result;
  }

  async findAll(tenantId: string | null, role: string) {
    const where: any = {};
    if (role !== 'SUPERADMIN') {
      where.tenantId = tenantId;
      where.role = { not: 'SUPERADMIN' };
    }
    return this.prisma.user.findMany({
      where,
      select: { id: true, email: true, name: true, role: true, active: true, tenantId: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    const { password, ...result } = user;
    return result;
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const data: any = { ...dto };
    if (dto.password) data.password = await bcrypt.hash(dto.password, 10);

    const updated = await this.prisma.user.update({ where: { id }, data });
    const { password, ...result } = updated;
    await this.audit.log(id, 'UPDATE', 'User', id, { changes: Object.keys(dto) }, updated.tenantId);
    return result;
  }

  async remove(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    await this.prisma.user.update({ where: { id }, data: { active: false } });
    await this.audit.log(id, 'DEACTIVATE', 'User', id, { email: user.email }, user.tenantId);
    return { message: 'Usuario desactivado' };
  }
}