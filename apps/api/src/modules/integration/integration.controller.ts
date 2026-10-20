import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  createIntegrationClientSchema,
  integrationApplicationSchema,
  integrationAvailabilitySchema,
  integrationChangeSchema,
  integrationContractSchema,
  integrationCostSchema,
  integrationDocumentSchema,
  integrationFreelancerSchema,
  integrationListQuery,
  integrationMissionSchema,
  integrationPage,
  integrationReviewSchema,
  integrationSkillSchema,
  reasonBody,
  type CreateIntegrationClientInput,
  type IntegrationListQuery,
  type ReasonBody,
} from '@empgt/contracts';
import type { Actor } from '../auth/actor.js';
import { CurrentActor, MachineAuth, Public, Roles } from '../auth/decorators.js';
import { SettingsService } from '../core/settings.service.js';
import { IntegrationGuard, RequireScope, type IntegrationRequest } from './integration.guard.js';
import { IntegrationService } from './integration.service.js';

@ApiTags('Intégration Knowledge Graph (lecture seule)')
@ApiBearerAuth('integration')
@Public()
@MachineAuth()
@UseGuards(IntegrationGuard)
@Controller('integration')
export class IntegrationController {
  constructor(
    private readonly integration: IntegrationService,
    private readonly settings: SettingsService,
  ) {}

  @Get('freelancers')
  @RequireScope('FREELANCERS')
  @ApiOperation({ summary: 'Profils validés (sans identité ni coordonnées) — pagination par curseur, synchronisation incrémentale' })
  @ApiResponse({ status: 200, standardSchema: integrationPage(integrationFreelancerSchema) })
  freelancers(@Query({ schema: integrationListQuery }) query: IntegrationListQuery) {
    return this.integration.freelancers(query);
  }

  @Get('skills')
  @RequireScope('SKILLS')
  @ApiResponse({ status: 200, standardSchema: integrationPage(integrationSkillSchema) })
  skills(@Query({ schema: integrationListQuery }) query: IntegrationListQuery) {
    return this.integration.skills(query);
  }

  @Get('availabilities')
  @RequireScope('AVAILABILITY')
  @ApiResponse({ status: 200, standardSchema: integrationPage(integrationAvailabilitySchema) })
  availabilities(@Query({ schema: integrationListQuery }) query: IntegrationListQuery) {
    return this.integration.availabilities(query);
  }

  @Get('missions')
  @RequireScope('MISSIONS')
  @ApiResponse({ status: 200, standardSchema: integrationPage(integrationMissionSchema) })
  missions(@Query({ schema: integrationListQuery }) query: IntegrationListQuery) {
    return this.integration.missions(query);
  }

  @Get('applications')
  @RequireScope('APPLICATIONS')
  @ApiResponse({ status: 200, standardSchema: integrationPage(integrationApplicationSchema) })
  applications(@Query({ schema: integrationListQuery }) query: IntegrationListQuery) {
    return this.integration.applications(query);
  }

  @Get('contracts')
  @RequireScope('CONTRACTS')
  @ApiResponse({ status: 200, standardSchema: integrationPage(integrationContractSchema) })
  contracts(@Query({ schema: integrationListQuery }) query: IntegrationListQuery) {
    return this.integration.contracts(query);
  }

  @Get('costs')
  @RequireScope('COSTS')
  @ApiOperation({ summary: 'Coûts issus des CRA validés (instantané figé à l’approbation)' })
  @ApiResponse({ status: 200, standardSchema: integrationPage(integrationCostSchema) })
  costs(@Query({ schema: integrationListQuery }) query: IntegrationListQuery) {
    return this.integration.costs(query);
  }

  @Get('reviews')
  @RequireScope('REVIEWS')
  @ApiResponse({ status: 200, standardSchema: integrationPage(integrationReviewSchema) })
  reviews(@Query({ schema: integrationListQuery }) query: IntegrationListQuery) {
    return this.integration.reviews(query);
  }

  @Get('documents')
  @RequireScope('DOCUMENTS_METADATA')
  @ApiOperation({ summary: 'Métadonnées documentaires uniquement (jamais le contenu, ni les pièces d’identité)' })
  @ApiResponse({ status: 200, standardSchema: integrationPage(integrationDocumentSchema) })
  documents(@Query({ schema: integrationListQuery }) query: IntegrationListQuery) {
    return this.integration.documents(query);
  }

  @Get('changes')
  @RequireScope('ANY')
  @ApiOperation({ summary: 'Flux ordonné des changements (UPSERT, DELETE, WITHDRAWN) pour les domaines autorisés' })
  @ApiResponse({ status: 200, standardSchema: integrationPage(integrationChangeSchema) })
  async changes(@Req() req: IntegrationRequest, @Query({ schema: integrationListQuery }) query: IntegrationListQuery) {
    const settings = await this.settings.get();
    return this.integration.changes(req.integrationClient!, settings.integrationEnabledScopes, query);
  }
}

@ApiTags('Administration — intégration')
@Roles(['PLATFORM_ADMIN'])
@Controller('admin/integration-clients')
export class IntegrationAdminController {
  constructor(private readonly integration: IntegrationService) {}

  @Get()
  list() {
    return this.integration.listClients();
  }

  @Post()
  @ApiOperation({ summary: 'Créer un client machine (jeton affiché une seule fois)' })
  create(@CurrentActor() actor: Actor, @Body({ schema: createIntegrationClientSchema }) body: CreateIntegrationClientInput) {
    return this.integration.createClient(actor, body);
  }

  @Post(':id/revoke')
  @HttpCode(200)
  revoke(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: reasonBody }) body: ReasonBody) {
    return this.integration.revokeClient(actor, id, body.reason);
  }
}
