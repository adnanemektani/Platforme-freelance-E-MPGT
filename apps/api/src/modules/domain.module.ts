import { Module } from '@nestjs/common';
import { ActivityModule } from './activity/activity.module.js';
import { AdminModule } from './admin/admin.module.js';
import { CommercialModule } from './commercial/commercial.module.js';
import { CompanyModule } from './companies/company.module.js';
import { DocumentModule } from './documents/document.module.js';
import { FinanceModule } from './finance/finance.module.js';
import { ImportModule } from './imports/import.module.js';
import { IntegrationModule } from './integration/integration.module.js';
import { MissionModule } from './missions/mission.module.js';
import { ProfileModule } from './profiles/profile.module.js';

/** Regroupe les modules métier (entreprises, profils, missions, contrats, finance…). */
@Module({
  imports: [CompanyModule, ProfileModule, MissionModule, DocumentModule, CommercialModule, ActivityModule, FinanceModule, AdminModule, ImportModule, IntegrationModule],
})
export class DomainModule {}
