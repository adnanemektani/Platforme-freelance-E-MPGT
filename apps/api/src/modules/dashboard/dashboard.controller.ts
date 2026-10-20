import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { pageQuery } from '@empgt/contracts';
import { z } from 'zod';
import type { Actor } from '../auth/actor.js';
import { CurrentActor, Roles } from '../auth/decorators.js';
import { DashboardService } from './dashboard.service.js';

const notificationsQuery = pageQuery.extend({ unread: z.stringbool().optional() });

@ApiTags('Tableaux de bord')
@Controller()
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Roles(['COMPANY'])
  @Get('company/overview')
  @ApiOperation({ summary: 'Tableau de bord entreprise : compteurs et éléments en attente (quoi, pourquoi, quelle action)' })
  company(@CurrentActor() actor: Actor) {
    return this.dashboard.company(actor);
  }

  @Roles(['FREELANCER'])
  @Get('freelancer/overview')
  freelancer(@CurrentActor() actor: Actor) {
    return this.dashboard.freelancer(actor);
  }

  @Roles(['PLATFORM_ADMIN'])
  @Get('admin/overview')
  admin(@CurrentActor() actor: Actor) {
    return this.dashboard.admin(actor);
  }

  @Get('notifications')
  notifications(@CurrentActor() actor: Actor, @Query({ schema: notificationsQuery }) query: z.infer<typeof notificationsQuery>) {
    return this.dashboard.notifications(actor, query);
  }

  @Post('notifications/read-all')
  @HttpCode(200)
  markAllRead(@CurrentActor() actor: Actor) {
    return this.dashboard.markAllRead(actor);
  }

  @Post('notifications/:id/read')
  @HttpCode(204)
  async markRead(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string) {
    await this.dashboard.markRead(actor, id);
  }
}
