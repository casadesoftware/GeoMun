import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(userId: string, action: string, entity: string, entityId?: string, details?: any, tenantId?: string) {
    return this.prisma.auditLog.create({
      data: { userId, action, entity, entityId, details, tenantId },
    });
  }

  async findAll(tenantId: string | null, role: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (role !== 'SUPERADMIN') {
      where.tenantId = tenantId;
    }
    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { name: true, email: true, role: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async findByUser(userId: string) {
    return this.prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}