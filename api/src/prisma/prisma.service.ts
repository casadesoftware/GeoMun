import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
    await this.seed();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  private async seed() {
    // Seed tenant por defecto
    let defaultTenant = await this.tenant.findUnique({ where: { slug: 'default' } });
    if (!defaultTenant) {
      defaultTenant = await this.tenant.create({
        data: { name: 'Default', slug: 'default' },
      });
      console.log('[Seed] Tenant default creado');
    }

    // Seed SUPERADMIN (sin tenant)
    const saEmail = process.env.ADMIN_EMAIL || 'admin@geomun.local';
    const existingSa = await this.user.findUnique({ where: { email: saEmail } });
    if (!existingSa) {
      const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'Admin123!', 10);
      await this.user.create({
        data: {
          email: saEmail,
          password: hash,
          name: process.env.ADMIN_NAME || 'Administrador',
          role: 'SUPERADMIN',
          tenantId: null,
        },
      });
      console.log(`[Seed] SUPERADMIN creado: ${saEmail}`);
    }
  }
}