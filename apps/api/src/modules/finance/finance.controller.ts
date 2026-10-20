import { Body, Controller, Get, Headers, HttpCode, Param, ParseUUIDPipe, Post, Put, Query, Req, UploadedFile, UseInterceptors } from '@nestjs/common';
import { ApiConsumes, ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import {
  depositInvoiceSchema,
  invoiceListQuery,
  optionalReasonBody,
  reasonBody,
  recordMoneySchema,
  updatePaymentConfigSchema,
  type DepositInvoiceInput,
  type InvoiceListQuery,
  type OptionalReasonBody,
  type ReasonBody,
  type RecordMoneyInput,
  type UpdatePaymentConfigInput,
} from '@empgt/contracts';
import type { Request } from 'express';
import type { Actor } from '../auth/actor.js';
import { CurrentActor, MachineAuth, Public, Roles } from '../auth/decorators.js';
import { uploadInterceptor } from '../documents/document.controller.js';
import type { UploadedFile as Upload } from '../documents/document.service.js';
import { InvoiceService } from './invoice.service.js';
import { WebhookService } from './webhook.service.js';

@ApiTags('Finance — factures et règlements')
@Controller()
export class FinanceController {
  constructor(private readonly invoices: InvoiceService) {}

  @Get('invoices')
  list(@CurrentActor() actor: Actor, @Query({ schema: invoiceListQuery }) query: InvoiceListQuery) {
    return this.invoices.list(actor, query);
  }

  @Roles(['FREELANCER', 'PLATFORM_ADMIN'])
  @Post('invoices')
  @UseInterceptors(uploadInterceptor())
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Déposer une facture (PDF) avec ses montants déclarés ; la plateforme ne calcule pas les taxes' })
  deposit(@CurrentActor() actor: Actor, @UploadedFile() file: Upload | undefined, @Body({ schema: depositInvoiceSchema }) body: DepositInvoiceInput) {
    return this.invoices.deposit(actor, file, body);
  }

  @Get('invoices/:id')
  get(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string) {
    return this.invoices.get(actor, id);
  }

  @Roles(['PLATFORM_ADMIN'])
  @Post('invoices/:id/verify')
  @HttpCode(200)
  verify(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: optionalReasonBody }) body: OptionalReasonBody) {
    return this.invoices.decide(actor, id, 'verify', body.reason);
  }

  @Roles(['PLATFORM_ADMIN'])
  @Post('invoices/:id/reject')
  @HttpCode(200)
  reject(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: reasonBody }) body: ReasonBody) {
    return this.invoices.decide(actor, id, 'reject', body.reason);
  }

  @Roles(['PLATFORM_ADMIN'])
  @Post('invoices/:id/cancel')
  @HttpCode(200)
  cancel(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: reasonBody }) body: ReasonBody) {
    return this.invoices.decide(actor, id, 'cancel', body.reason);
  }

  @Roles(['PLATFORM_ADMIN'])
  @Post('invoices/:id/payments')
  @UseInterceptors(uploadInterceptor())
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Enregistrer un encaissement client (partiel possible) : référence et justificatif obligatoires' })
  recordPayment(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Upload | undefined,
    @Body({ schema: recordMoneySchema }) body: RecordMoneyInput,
  ) {
    return this.invoices.record(actor, id, 'payment', file, body);
  }

  @Roles(['PLATFORM_ADMIN'])
  @Post('invoices/:id/payouts')
  @UseInterceptors(uploadInterceptor())
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Enregistrer un règlement au freelance : référence et justificatif obligatoires' })
  recordPayout(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Upload | undefined,
    @Body({ schema: recordMoneySchema }) body: RecordMoneyInput,
  ) {
    return this.invoices.record(actor, id, 'payout', file, body);
  }

  @Roles(['PLATFORM_ADMIN'])
  @Post('payments/:id/cancel')
  @HttpCode(200)
  cancelPayment(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: reasonBody }) body: ReasonBody) {
    return this.invoices.cancelRecord(actor, 'payment', id, body.reason);
  }

  @Roles(['PLATFORM_ADMIN'])
  @Post('payouts/:id/cancel')
  @HttpCode(200)
  cancelPayout(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: reasonBody }) body: ReasonBody) {
    return this.invoices.cancelRecord(actor, 'payout', id, body.reason);
  }

  @Roles(['FREELANCER'])
  @Get('freelancer/payments')
  @ApiOperation({ summary: 'Page « Paiements » du freelance : méthode, configuration, montants approuvés, échéances, règlements' })
  freelancerPayments(@CurrentActor() actor: Actor) {
    return this.invoices.freelancerOverview(actor);
  }

  @Roles(['COMPANY'])
  @Get('company/billing')
  companyBilling(@CurrentActor() actor: Actor) {
    return this.invoices.companyOverview(actor);
  }

  @Roles(['PLATFORM_ADMIN'])
  @Get('admin/finance/overview')
  @ApiOperation({ summary: 'Synthèse E-MPGT : montants approuvés, commissions, facturé, encaissé, réglé, en retard (par devise)' })
  adminOverview() {
    return this.invoices.adminOverview();
  }

  @Roles(['PLATFORM_ADMIN', 'FREELANCER'])
  @Get('freelancers/:profileId/payment-configuration')
  paymentConfiguration(@CurrentActor() actor: Actor, @Param('profileId', ParseUUIDPipe) profileId: string) {
    return this.invoices.getPaymentConfiguration(actor, profileId);
  }

  @Roles(['PLATFORM_ADMIN'])
  @Put('freelancers/:profileId/payment-configuration')
  updatePaymentConfiguration(
    @CurrentActor() actor: Actor,
    @Param('profileId', ParseUUIDPipe) profileId: string,
    @Body({ schema: updatePaymentConfigSchema }) body: UpdatePaymentConfigInput,
  ) {
    return this.invoices.updatePaymentConfiguration(actor, profileId, body);
  }
}

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhookController {
  constructor(private readonly webhooks: WebhookService) {}

  @Public()
  @MachineAuth()
  @SkipThrottle()
  @Post('payments/:provider')
  @HttpCode(200)
  @ApiExcludeEndpoint()
  receive(@Param('provider') provider: string, @Req() req: Request & { rawBody?: Buffer }, @Headers() headers: Record<string, string>) {
    return this.webhooks.ingest(provider, req.rawBody, headers);
  }
}
