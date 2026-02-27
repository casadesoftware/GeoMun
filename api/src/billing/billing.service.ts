import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';

const PLAN_CONFIG = {
  BASIC: { maxUsers: 10, maxMaps: 5, maxLayers: 15 },
  PRO: { maxUsers: -1, maxMaps: -1, maxLayers: -1 },
  FREE: { maxUsers: 2, maxMaps: 1, maxLayers: 3 },
};

@Injectable()
export class BillingService {
  private stripe: Stripe;

  constructor(private prisma: PrismaService) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-02-24.acacia',
    });
  }

  async createCheckout(tenantId: string, plan: 'BASIC' | 'PRO', origin: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant no encontrado');

    let customerId = tenant.stripeCustomerId;
    if (!customerId) {
      const customer = await this.stripe.customers.create({
        name: tenant.name,
        metadata: { tenantId: tenant.id },
      });
      customerId = customer.id;
      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: { stripeCustomerId: customerId },
      });
    }

    const priceId = plan === 'PRO'
      ? process.env.STRIPE_PRICE_PRO
      : process.env.STRIPE_PRICE_BASIC;

    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/?billing=success`,
      cancel_url: `${origin}/?billing=cancel`,
      metadata: { tenantId: tenant.id, plan },
    });

    return { url: session.url };
  }

  async handleWebhook(body: Buffer, signature: string) {
    const event = this.stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET,
    );

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const tenantId = session.metadata?.tenantId;
        const plan = session.metadata?.plan as 'BASIC' | 'PRO';
        if (tenantId && plan) {
          await this.activatePlan(tenantId, plan, session.subscription as string);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const tenant = await this.prisma.tenant.findFirst({
          where: { stripeSubscriptionId: sub.id },
        });
        if (tenant) {
          await this.activatePlan(tenant.id, 'FREE', null);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const sub = invoice.subscription as string;
        if (sub) {
          const tenant = await this.prisma.tenant.findFirst({
            where: { stripeSubscriptionId: sub },
          });
          if (tenant) {
            await this.activatePlan(tenant.id, 'FREE', tenant.stripeSubscriptionId);
          }
        }
        break;
      }
    }

    return { received: true };
  }

  async getStatus(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant no encontrado');

    const [users, maps, layers] = await Promise.all([
      this.prisma.user.count({ where: { tenantId, active: true } }),
      this.prisma.map.count({ where: { tenantId } }),
      this.prisma.layer.count({ where: { map: { tenantId } } }),
    ]);

    return {
      plan: tenant.plan,
      limits: { maxUsers: tenant.maxUsers, maxMaps: tenant.maxMaps, maxLayers: tenant.maxLayers },
      usage: { users, maps, layers },
      hasSubscription: !!tenant.stripeSubscriptionId,
    };
  }

  async createPortalSession(tenantId: string, origin: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant?.stripeCustomerId) throw new ForbiddenException('Sin suscripción activa');

    const session = await this.stripe.billingPortal.sessions.create({
      customer: tenant.stripeCustomerId,
      return_url: origin,
    });

    return { url: session.url };
  }

  private async activatePlan(tenantId: string, plan: 'FREE' | 'BASIC' | 'PRO', subscriptionId: string | null) {
    const config = PLAN_CONFIG[plan];
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        plan,
        maxUsers: config.maxUsers,
        maxMaps: config.maxMaps,
        maxLayers: config.maxLayers,
        stripeSubscriptionId: subscriptionId,
        planExpiresAt: plan === 'FREE' ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
  }
}