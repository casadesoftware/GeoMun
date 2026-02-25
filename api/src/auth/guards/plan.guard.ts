import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { PLAN_LIMIT_KEY } from '../decorators/plan-limit.decorator';

@Injectable()
export class PlanGuard implements CanActivate {
  constructor(private reflector: Reflector, private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const resource = this.reflector.get<string>(PLAN_LIMIT_KEY, context.getHandler());
    if (!resource) return true;

    const { user } = context.switchToHttp().getRequest();
    if (user.role === 'SUPERADMIN') return true;
    if (!user.tenantId) throw new ForbiddenException('Tenant no asignado');

    const tenant = await this.prisma.tenant.findUnique({ where: { id: user.tenantId } });
    if (!tenant) throw new ForbiddenException('Tenant no encontrado');

    const limitMap: Record<string, { max: number; count: () => Promise<number> }> = {
      users: {
        max: tenant.maxUsers,
        count: () => this.prisma.user.count({ where: { tenantId: tenant.id, active: true } }),
      },
      maps: {
        max: tenant.maxMaps,
        count: () => this.prisma.map.count({ where: { tenantId: tenant.id } }),
      },
      layers: {
        max: tenant.maxLayers,
        count: () => this.prisma.layer.count({
          where: { map: { tenantId: tenant.id } },
        }),
      },
    };

    const check = limitMap[resource];
    if (!check) return true;

    if (check.max === -1) return true; // -1 = ilimitado

    const current = await check.count();
    if (current >= check.max) {
      throw new ForbiddenException(
        `Límite del plan ${tenant.plan} alcanzado: máximo ${check.max} ${resource}. Actualiza tu plan.`,
      );
    }

    return true;
  }
}