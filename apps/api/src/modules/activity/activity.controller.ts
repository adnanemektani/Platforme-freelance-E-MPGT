import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  approveTimesheetSchema,
  correctTimesheetSchema,
  createTimesheetSchema,
  openDisputeSchema,
  reasonBody,
  resolveDisputeSchema,
  timesheetEntriesSchema,
  timesheetListQuery,
  type ApproveTimesheetInput,
  type CorrectTimesheetInput,
  type CreateTimesheetInput,
  type OpenDisputeInput,
  type ReasonBody,
  type ResolveDisputeInput,
  type TimesheetEntriesInput,
  type TimesheetListQuery,
} from '@empgt/contracts';
import type { Actor } from '../auth/actor.js';
import { CurrentActor, Roles } from '../auth/decorators.js';
import { DisputeService } from './dispute.service.js';
import { TimesheetService } from './timesheet.service.js';

@ApiTags('Activité — CRA')
@Controller()
export class TimesheetController {
  constructor(private readonly timesheets: TimesheetService) {}

  @Get('timesheets')
  list(@CurrentActor() actor: Actor, @Query({ schema: timesheetListQuery }) query: TimesheetListQuery) {
    return this.timesheets.list(actor, query);
  }

  @Roles(['FREELANCER'])
  @Post('contracts/:contractId/timesheets')
  @ApiOperation({ summary: 'Ouvrir le CRA d’un mois (mission active)' })
  create(@CurrentActor() actor: Actor, @Param('contractId', ParseUUIDPipe) contractId: string, @Body({ schema: createTimesheetSchema }) body: CreateTimesheetInput) {
    return this.timesheets.create(actor, contractId, body);
  }

  @Get('timesheets/:id')
  get(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string) {
    return this.timesheets.get(actor, id);
  }

  @Roles(['FREELANCER'])
  @Put('timesheets/:id/entries')
  @ApiOperation({ summary: 'Enregistrer les heures par date (remplace la saisie du brouillon)' })
  saveEntries(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: timesheetEntriesSchema }) body: TimesheetEntriesInput) {
    return this.timesheets.saveEntries(actor, id, body);
  }

  @Roles(['FREELANCER'])
  @Delete('timesheets/:id')
  @HttpCode(204)
  async remove(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string) {
    await this.timesheets.remove(actor, id);
  }

  @Roles(['FREELANCER'])
  @Post('timesheets/:id/submit')
  @HttpCode(200)
  submit(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string) {
    return this.timesheets.submit(actor, id);
  }

  @Roles(['COMPANY', 'PLATFORM_ADMIN'])
  @Post('timesheets/:id/approve')
  @HttpCode(200)
  @ApiOperation({ summary: 'Valider le CRA (entreprise ; E-MPGT uniquement avec motif, validation tracée « à la place du client »)' })
  approve(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: approveTimesheetSchema }) body: ApproveTimesheetInput) {
    return this.timesheets.approve(actor, id, body.reason);
  }

  @Roles(['COMPANY', 'PLATFORM_ADMIN'])
  @Post('timesheets/:id/request-changes')
  @HttpCode(200)
  requestChanges(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: reasonBody }) body: ReasonBody) {
    return this.timesheets.requestChanges(actor, id, body.reason);
  }

  @Roles(['FREELANCER', 'PLATFORM_ADMIN'])
  @Post('timesheets/:id/correct')
  @HttpCode(200)
  @ApiOperation({ summary: 'Ouvrir une correction tracée d’un CRA validé (nouvelle version à valider)' })
  correct(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: correctTimesheetSchema }) body: CorrectTimesheetInput) {
    return this.timesheets.correct(actor, id, body.reason);
  }
}

@ApiTags('Activité — litiges')
@Controller('disputes')
export class DisputeController {
  constructor(private readonly disputes: DisputeService) {}

  @Get()
  list(@CurrentActor() actor: Actor) {
    return this.disputes.list(actor);
  }

  @Post()
  open(@CurrentActor() actor: Actor, @Body({ schema: openDisputeSchema }) body: OpenDisputeInput) {
    return this.disputes.open(actor, body);
  }

  @Roles(['PLATFORM_ADMIN'])
  @Post(':id/resolve')
  @HttpCode(200)
  resolve(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: resolveDisputeSchema }) body: ResolveDisputeInput) {
    return this.disputes.resolve(actor, id, body);
  }
}
