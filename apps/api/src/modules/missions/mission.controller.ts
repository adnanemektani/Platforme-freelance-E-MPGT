import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  adminUpdateMissionSchema,
  applicationListQuery,
  applySchema,
  createMissionSchema,
  missionListQuery,
  optionalReasonBody,
  reasonBody,
  updateMissionSchema,
  type AdminUpdateMissionInput,
  type ApplicationListQuery,
  type ApplyInput,
  type CreateMissionInput,
  type MissionListQuery,
  type OptionalReasonBody,
  type ReasonBody,
  type UpdateMissionInput,
} from '@empgt/contracts';
import type { Actor } from '../auth/actor.js';
import { CurrentActor, Roles } from '../auth/decorators.js';
import { ApplicationService } from './application.service.js';
import { MissionService } from './mission.service.js';

@ApiTags('Missions')
@Controller('missions')
export class MissionController {
  constructor(
    private readonly missions: MissionService,
    private readonly applications: ApplicationService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Missions : celles de mon entreprise, celles publiées (freelance) ou toutes (E-MPGT)' })
  list(@CurrentActor() actor: Actor, @Query({ schema: missionListQuery }) query: MissionListQuery) {
    return this.missions.list(actor, query);
  }

  @Roles(['COMPANY'])
  @Post()
  create(@CurrentActor() actor: Actor, @Body({ schema: createMissionSchema }) body: CreateMissionInput) {
    return this.missions.create(actor, body);
  }

  @Get(':id')
  get(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string) {
    return this.missions.get(actor, id);
  }

  @Roles(['COMPANY'])
  @Patch(':id')
  update(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: updateMissionSchema }) body: UpdateMissionInput) {
    return this.missions.update(actor, id, body);
  }

  @Roles(['COMPANY'])
  @Post(':id/submit')
  @HttpCode(200)
  @ApiOperation({ summary: 'Soumettre la mission à la validation d’E-MPGT' })
  submit(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string) {
    return this.missions.submit(actor, id);
  }

  @Roles(['COMPANY'])
  @Post(':id/withdraw')
  @HttpCode(200)
  withdraw(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string) {
    return this.missions.withdraw(actor, id);
  }

  @Roles(['COMPANY', 'PLATFORM_ADMIN'])
  @Post(':id/cancel')
  @HttpCode(200)
  cancel(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: reasonBody }) body: ReasonBody) {
    return this.missions.cancel(actor, id, body.reason);
  }

  @Roles(['PLATFORM_ADMIN'])
  @Post(':id/approve')
  @HttpCode(200)
  @ApiOperation({ summary: 'Valider et publier la mission (E-MPGT)' })
  approve(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: optionalReasonBody }) body: OptionalReasonBody) {
    return this.missions.adminDecide(actor, id, 'approve', body.reason);
  }

  @Roles(['PLATFORM_ADMIN'])
  @Post(':id/request-changes')
  @HttpCode(200)
  requestChanges(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: reasonBody }) body: ReasonBody) {
    return this.missions.adminDecide(actor, id, 'requestChanges', body.reason);
  }

  @Roles(['PLATFORM_ADMIN'])
  @Post(':id/reject')
  @HttpCode(200)
  reject(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: reasonBody }) body: ReasonBody) {
    return this.missions.adminDecide(actor, id, 'reject', body.reason);
  }

  @Roles(['PLATFORM_ADMIN'])
  @Post(':id/unpublish')
  @HttpCode(200)
  unpublish(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: reasonBody }) body: ReasonBody) {
    return this.missions.adminDecide(actor, id, 'unpublish', body.reason);
  }

  @Roles(['PLATFORM_ADMIN'])
  @Post(':id/republish')
  @HttpCode(200)
  republish(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: reasonBody }) body: ReasonBody) {
    return this.missions.adminDecide(actor, id, 'republish', body.reason);
  }

  @Roles(['PLATFORM_ADMIN'])
  @Patch(':id/admin')
  @ApiOperation({ summary: 'Modifier une mission en tant qu’E-MPGT (motif obligatoire, tracé)' })
  adminUpdate(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: adminUpdateMissionSchema }) body: AdminUpdateMissionInput) {
    return this.missions.adminUpdate(actor, id, body);
  }

  @Roles(['FREELANCER'])
  @Post(':id/applications')
  @ApiOperation({ summary: 'Candidater à une mission publiée (profil validé requis)' })
  apply(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: applySchema }) body: ApplyInput) {
    return this.applications.apply(actor, id, body);
  }
}

@ApiTags('Candidatures')
@Controller('applications')
export class ApplicationController {
  constructor(private readonly applications: ApplicationService) {}

  @Get()
  list(@CurrentActor() actor: Actor, @Query({ schema: applicationListQuery }) query: ApplicationListQuery) {
    return this.applications.list(actor, query);
  }

  @Get(':id')
  get(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string) {
    return this.applications.get(actor, id);
  }

  @Roles(['COMPANY', 'PLATFORM_ADMIN'])
  @Post(':id/shortlist')
  @HttpCode(200)
  shortlist(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: optionalReasonBody }) body: OptionalReasonBody) {
    return this.applications.decide(actor, id, 'shortlist', body.reason);
  }

  @Roles(['COMPANY', 'PLATFORM_ADMIN'])
  @Post(':id/select')
  @HttpCode(200)
  @ApiOperation({ summary: 'Retenir le candidat (transactionnel : un seul candidat retenu par mission)' })
  select(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: optionalReasonBody }) body: OptionalReasonBody) {
    return this.applications.decide(actor, id, 'select', body.reason);
  }

  @Roles(['COMPANY', 'PLATFORM_ADMIN'])
  @Post(':id/reject')
  @HttpCode(200)
  reject(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: reasonBody }) body: ReasonBody) {
    return this.applications.decide(actor, id, 'reject', body.reason);
  }

  @Roles(['COMPANY', 'PLATFORM_ADMIN'])
  @Post(':id/deselect')
  @HttpCode(200)
  deselect(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: reasonBody }) body: ReasonBody) {
    return this.applications.decide(actor, id, 'deselect', body.reason);
  }

  @Roles(['FREELANCER'])
  @Post(':id/withdraw')
  @HttpCode(200)
  withdraw(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: optionalReasonBody }) body: OptionalReasonBody) {
    return this.applications.withdraw(actor, id, body.reason);
  }
}
