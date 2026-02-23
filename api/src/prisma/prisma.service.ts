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
    const email = process.env.ADMIN_EMAIL || 'admin@geomun.local';
    const existing = await this.user.findUnique({ where: { email } });
    if (existing) return;

    const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'Admin123!', 10);
    await this.user.create({
      data: {
        email,
        password: hash,
        name: process.env.ADMIN_NAME || 'Administrador',
        role: 'ADMIN',
      },
    });
    console.log(`[Seed] Admin creado: ${email}`);
  }
}
