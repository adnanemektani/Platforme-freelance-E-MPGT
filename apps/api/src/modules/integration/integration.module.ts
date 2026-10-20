import { Module } from '@nestjs/common';
import { IntegrationAdminController, IntegrationController } from './integration.controller.js';
import { IntegrationGuard } from './integration.guard.js';
import { IntegrationService } from './integration.service.js';

@Module({
  controllers: [IntegrationController, IntegrationAdminController],
  providers: [IntegrationService, IntegrationGuard],
})
export class IntegrationModule {}
