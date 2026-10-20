import { Module } from '@nestjs/common';
import { FinanceController, WebhookController } from './finance.controller.js';
import { InvoiceService } from './invoice.service.js';
import { PaymentProviderRegistry } from './payment-provider.js';
import { WebhookService } from './webhook.service.js';

@Module({
  controllers: [FinanceController, WebhookController],
  providers: [InvoiceService, WebhookService, PaymentProviderRegistry],
  exports: [InvoiceService, PaymentProviderRegistry],
})
export class FinanceModule {}
