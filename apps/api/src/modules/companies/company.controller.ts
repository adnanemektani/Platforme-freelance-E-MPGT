import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CompanyStatus,
  CompanyVerificationStatus,
  companyContactSchema,
  inviteMemberSchema,
  optionalReasonBody,
  optionalText,
  pageQuery,
  reason,
  reasonBody,
  updateCompanySchema,
  type CompanyContactInput,
  type InviteMemberInput,
  type OptionalReasonBody,
  type ReasonBody,
  type UpdateCompanyInput,
} from '@empgt/contracts';
import { z } from 'zod';
import type { Actor } from '../auth/actor.js';
import { CurrentActor, Roles } from '../auth/decorators.js';
import { CompanyService } from './company.service.js';

const adminCompanyQuery = pageQuery.extend({
  verificationStatus: z.enum(CompanyVerificationStatus).optional(),
  status: z.enum(CompanyStatus).optional(),
});
const adminCompanyUpdate = updateCompanySchema.extend({ internalNotes: optionalText(5000), reason });

@ApiTags('Espace entreprise')
@Roles(['COMPANY'])
@Controller('company')
export class CompanyController {
  constructor(private readonly companies: CompanyService) {}

  @Get()
  @ApiOperation({ summary: 'Mon organisation (informations, contacts, membres, état de vérification)' })
  get(@CurrentActor() actor: Actor) {
    return this.companies.getOwn(actor);
  }

  @Patch()
  update(@CurrentActor() actor: Actor, @Body({ schema: updateCompanySchema }) body: UpdateCompanyInput) {
    return this.companies.updateOwn(actor, body);
  }

  @Post('submit-verification')
  @HttpCode(200)
  @ApiOperation({ summary: 'Demander la vérification de l’entreprise par E-MPGT' })
  submitVerification(@CurrentActor() actor: Actor) {
    return this.companies.submitVerification(actor);
  }

  @Post('contacts')
  addContact(@CurrentActor() actor: Actor, @Body({ schema: companyContactSchema }) body: CompanyContactInput) {
    return this.companies.addContact(actor, body);
  }

  @Patch('contacts/:id')
  updateContact(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body({ schema: companyContactSchema }) body: CompanyContactInput,
  ) {
    return this.companies.updateContact(actor, id, body);
  }

  @Delete('contacts/:id')
  removeContact(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string) {
    return this.companies.removeContact(actor, id);
  }

  @Post('invitations')
  @ApiOperation({ summary: 'Inviter un membre (responsable uniquement) : un e-mail est envoyé à l’adresse indiquée' })
  invite(@CurrentActor() actor: Actor, @Body({ schema: inviteMemberSchema }) body: InviteMemberInput) {
    return this.companies.inviteMember(actor, body);
  }

  @Delete('invitations/:id')
  revokeInvitation(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string) {
    return this.companies.revokeInvitation(actor, id);
  }

  @Delete('members/:id')
  removeMember(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string) {
    return this.companies.removeMember(actor, id);
  }
}

@ApiTags('Administration — entreprises')
@Roles(['PLATFORM_ADMIN'])
@Controller('admin/companies')
export class AdminCompanyController {
  constructor(private readonly companies: CompanyService) {}

  @Get()
  list(@Query({ schema: adminCompanyQuery }) query: z.infer<typeof adminCompanyQuery>) {
    return this.companies.adminList(query);
  }

  @Get(':id')
  get(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string) {
    return this.companies.adminGet(actor, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Modifier une entreprise (motif obligatoire, tracé)' })
  update(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body({ schema: adminCompanyUpdate }) body: z.infer<typeof adminCompanyUpdate>,
  ) {
    return this.companies.adminUpdate(actor, id, body);
  }

  @Post(':id/verify')
  @HttpCode(200)
  verify(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: optionalReasonBody }) body: OptionalReasonBody) {
    return this.companies.adminDecide(actor, id, 'verify', body.reason);
  }

  @Post(':id/request-changes')
  @HttpCode(200)
  requestChanges(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: reasonBody }) body: ReasonBody) {
    return this.companies.adminDecide(actor, id, 'requestChanges', body.reason);
  }

  @Post(':id/reject')
  @HttpCode(200)
  reject(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: reasonBody }) body: ReasonBody) {
    return this.companies.adminDecide(actor, id, 'reject', body.reason);
  }

  @Post(':id/suspend')
  @HttpCode(200)
  suspend(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: reasonBody }) body: ReasonBody) {
    return this.companies.adminDecide(actor, id, 'suspend', body.reason);
  }

  @Post(':id/reactivate')
  @HttpCode(200)
  reactivate(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: reasonBody }) body: ReasonBody) {
    return this.companies.adminDecide(actor, id, 'reactivate', body.reason);
  }
}
