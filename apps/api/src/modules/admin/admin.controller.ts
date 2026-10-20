import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  auditListQuery,
  contactRequestSchema,
  pageQuery,
  reasonBody,
  updateSettingsSchema,
  userListQuery,
  type AuditListQuery,
  type ContactRequestInput,
  type PageQuery,
  type ReasonBody,
  type UpdateSettingsInput,
  type UserListQuery,
} from '@empgt/contracts';
import { env } from '../../config/env.js';
import type { Actor } from '../auth/actor.js';
import { CurrentActor, Public, Roles } from '../auth/decorators.js';
import { SettingsService } from '../core/settings.service.js';
import { AdminService } from './admin.service.js';

@ApiTags('Administration')
@Roles(['PLATFORM_ADMIN'])
@Controller('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly settings: SettingsService,
  ) {}

  @Get('users')
  users(@CurrentActor() actor: Actor, @Query({ schema: userListQuery }) query: UserListQuery) {
    return this.admin.users(actor, query);
  }

  @Post('users/:id/suspend')
  @HttpCode(200)
  suspend(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: reasonBody }) body: ReasonBody) {
    return this.admin.setUserStatus(actor, id, 'suspend', body.reason);
  }

  @Post('users/:id/reactivate')
  @HttpCode(200)
  reactivate(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: reasonBody }) body: ReasonBody) {
    return this.admin.setUserStatus(actor, id, 'reactivate', body.reason);
  }

  @Post('users/:id/resend-verification')
  @HttpCode(200)
  resend(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string) {
    return this.admin.resendVerification(actor, id);
  }

  @Get('audit')
  @ApiOperation({ summary: 'Journal d’audit (ajout seul) : acteur, date, objet, action, motif' })
  audit(@Query({ schema: auditListQuery }) query: AuditListQuery) {
    return this.admin.auditEvents(query);
  }

  @Get('settings')
  getSettings() {
    return this.settings.get();
  }

  @Patch('settings')
  @ApiOperation({ summary: 'Modifier les paramètres métier (politique de validation, informations légales…) avec motif' })
  updateSettings(@CurrentActor() actor: Actor, @Body({ schema: updateSettingsSchema }) body: UpdateSettingsInput) {
    return this.settings.update(actor, body);
  }

  @Get('contact-requests')
  contactRequests(@Query({ schema: pageQuery }) query: PageQuery) {
    return this.admin.contactRequests(query);
  }

  @Post('contact-requests/:id/handled')
  @HttpCode(200)
  handled(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string) {
    return this.admin.handleContactRequest(actor, id);
  }
}

@ApiTags('Public')
@Controller('public')
export class PublicController {
  constructor(
    private readonly admin: AdminService,
    private readonly settings: SettingsService,
  ) {}

  @Public()
  @Get('settings')
  @ApiOperation({ summary: 'Informations légales et politique de validation (les champs non renseignés sont nuls)' })
  publicSettings() {
    return this.settings.getPublic();
  }

  @Public()
  @Throttle({ default: { limit: () => env().THROTTLE_AUTH_PER_MINUTE, ttl: 60_000 } })
  @Post('contact')
  @HttpCode(200)
  contact(@Body({ schema: contactRequestSchema }) body: ContactRequestInput) {
    return this.admin.createContactRequest(body);
  }
}
