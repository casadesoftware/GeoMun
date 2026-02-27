import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { EmailService } from '../email/email.service';
import { randomBytes } from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private emailService: EmailService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.active) throw new UnauthorizedException('Credenciales inválidas');

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) throw new UnauthorizedException('Credenciales inválidas');

    const payload = { sub: user.id, role: user.role, tenantId: user.tenantId };
    return {
      token: this.jwt.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
      },
    };
  }

  async profile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { tenant: { select: { name: true, slug: true } } },
    });
    if (!user) throw new UnauthorizedException();
    const { password, ...result } = user;
    return result;
  }

  async register(orgName: string, email: string, name: string, password: string) {
    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new ForbiddenException('El email ya está registrado');
    }

    const slug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const existingTenant = await this.prisma.tenant.findUnique({ where: { slug } });
    if (existingTenant) {
      throw new ForbiddenException('El nombre de organización ya está en uso');
    }

    const token = randomBytes(32).toString('hex');
    const hashedPassword = await bcrypt.hash(password, 10);

    const tenant = await this.prisma.tenant.create({
      data: {
        name: orgName,
        slug,
        active: false,
        verificationToken: token,
        tokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: 'ADMIN',
        tenantId: tenant.id,
        active: false,
      },
    });

    await this.emailService.sendVerificationEmail(email, name, token);

    return { message: 'Registro exitoso. Revisa tu correo para verificar tu cuenta.' };
  }

  async verifyEmail(token: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: { verificationToken: token },
    });

    if (!tenant) {
      return { success: false, reason: 'invalid' };
    }

    if (tenant.tokenExpiresAt && tenant.tokenExpiresAt < new Date()) {
      return { success: false, reason: 'expired' };
    }

  await this.prisma.tenant.update({
    where: { id: tenant.id },
    data: {
      active: true,
      emailVerified: true,
      verificationToken: null,
      tokenExpiresAt: null,
    },
  });

  await this.prisma.user.updateMany({
    where: { tenantId: tenant.id, role: 'ADMIN' },
    data: { active: true },
  });

    return { success: true };
  }


}