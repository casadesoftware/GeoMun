import { Controller, Post, Get, Body, Req, Res, UseGuards, Headers, RawBodyRequest } from '@nestjs/common';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Request, Response } from 'express';

@Controller('billing')
export class BillingController {
  constructor(private billingService: BillingService) {}

  @Post('checkout')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  checkout(
    @Body('plan') plan: 'BASIC' | 'PRO',
    @CurrentUser('tenantId') tenantId: string,
    @Req() req: Request,
  ) {
    const origin = `${req.protocol}://${req.get('host')}`;
    return this.billingService.createCheckout(tenantId, plan, origin);
  }

  @Post('portal')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  portal(
    @CurrentUser('tenantId') tenantId: string,
    @Req() req: Request,
  ) {
    const origin = `${req.protocol}://${req.get('host')}`;
    return this.billingService.createPortalSession(tenantId, origin);
  }

  @Get('status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'EDITOR')
  status(@CurrentUser('tenantId') tenantId: string) {
    return this.billingService.getStatus(tenantId);
  }

  @Post('webhook')
  async webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    return this.billingService.handleWebhook(req.rawBody, signature);
  }
}