import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ProfileOrigin,
  ProfileValidationStatus,
  adminUpdateProfileSchema,
  availabilitySchema,
  availabilityStatusSchema,
  educationSchema,
  experienceSchema,
  inviteProfileClaimSchema,
  optionalReasonBody,
  pageQuery,
  profileLanguagesSchema,
  profileSkillsSchema,
  publicProfilesQuery,
  publicationSchema,
  qualificationSchema,
  reasonBody,
  updateProfileSchema,
  verifyDocumentSchema,
  type AdminUpdateProfileInput,
  type AvailabilityInput,
  type AvailabilityStatusInput,
  type EducationInput,
  type ExperienceInput,
  type InviteProfileClaimInput,
  type OptionalReasonBody,
  type ProfileLanguagesInput,
  type ProfileSkillsInput,
  type PublicProfilesQuery,
  type PublicationInput,
  type QualificationInput,
  type ReasonBody,
  type UpdateProfileInput,
  type VerifyDocumentInput,
} from '@empgt/contracts';
import { z } from 'zod';
import type { Actor } from '../auth/actor.js';
import { CurrentActor, Public, Roles } from '../auth/decorators.js';
import { ProfileService } from './profile.service.js';
import { SkillsService } from './skills.service.js';

const SECTIONS = { experiences: experienceSchema, educations: educationSchema, qualifications: qualificationSchema, availabilities: availabilitySchema };

@ApiTags('Espace freelance — profil')
@Roles(['FREELANCER'])
@Controller('profile')
export class ProfileController {
  constructor(private readonly profiles: ProfileService) {}

  @Get()
  @ApiOperation({ summary: 'Mon profil complet, état de validation, éléments manquants et actions possibles' })
  get(@CurrentActor() actor: Actor) {
    return this.profiles.getOwn(actor);
  }

  @Patch()
  update(@CurrentActor() actor: Actor, @Body({ schema: updateProfileSchema }) body: UpdateProfileInput) {
    return this.profiles.update(actor, body);
  }

  @Put('skills')
  setSkills(@CurrentActor() actor: Actor, @Body({ schema: profileSkillsSchema }) body: ProfileSkillsInput) {
    return this.profiles.setSkills(actor, body);
  }

  @Put('languages')
  setLanguages(@CurrentActor() actor: Actor, @Body({ schema: profileLanguagesSchema }) body: ProfileLanguagesInput) {
    return this.profiles.setLanguages(actor, body);
  }

  @Post('experiences')
  addExperience(@CurrentActor() actor: Actor, @Body({ schema: SECTIONS.experiences }) body: ExperienceInput) {
    return this.profiles.addItem(actor, 'experiences', body);
  }

  @Patch('experiences/:id')
  updateExperience(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: SECTIONS.experiences }) body: ExperienceInput) {
    return this.profiles.updateItem(actor, 'experiences', id, body);
  }

  @Delete('experiences/:id')
  removeExperience(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string) {
    return this.profiles.removeItem(actor, 'experiences', id);
  }

  @Post('educations')
  addEducation(@CurrentActor() actor: Actor, @Body({ schema: SECTIONS.educations }) body: EducationInput) {
    return this.profiles.addItem(actor, 'educations', body);
  }

  @Patch('educations/:id')
  updateEducation(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: SECTIONS.educations }) body: EducationInput) {
    return this.profiles.updateItem(actor, 'educations', id, body);
  }

  @Delete('educations/:id')
  removeEducation(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string) {
    return this.profiles.removeItem(actor, 'educations', id);
  }

  @Post('qualifications')
  addQualification(@CurrentActor() actor: Actor, @Body({ schema: SECTIONS.qualifications }) body: QualificationInput) {
    return this.profiles.addItem(actor, 'qualifications', body);
  }

  @Patch('qualifications/:id')
  updateQualification(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body({ schema: SECTIONS.qualifications }) body: QualificationInput,
  ) {
    return this.profiles.updateItem(actor, 'qualifications', id, body);
  }

  @Delete('qualifications/:id')
  removeQualification(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string) {
    return this.profiles.removeItem(actor, 'qualifications', id);
  }

  @Post('availabilities')
  addAvailability(@CurrentActor() actor: Actor, @Body({ schema: SECTIONS.availabilities }) body: AvailabilityInput) {
    return this.profiles.addItem(actor, 'availabilities', body);
  }

  @Patch('availabilities/:id')
  updateAvailability(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body({ schema: SECTIONS.availabilities }) body: AvailabilityInput,
  ) {
    return this.profiles.updateItem(actor, 'availabilities', id, body);
  }

  @Delete('availabilities/:id')
  removeAvailability(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string) {
    return this.profiles.removeItem(actor, 'availabilities', id);
  }

  @Patch('availability-status')
  setAvailabilityStatus(@CurrentActor() actor: Actor, @Body({ schema: availabilityStatusSchema }) body: AvailabilityStatusInput) {
    return this.profiles.setAvailabilityStatus(actor, body);
  }

  @Put('publication')
  @ApiOperation({ summary: 'Choisir la visibilité dans le catalogue public (consentement explicite)' })
  setPublication(@CurrentActor() actor: Actor, @Body({ schema: publicationSchema }) body: PublicationInput) {
    return this.profiles.setPublication(actor, body);
  }

  @Post('submit')
  @HttpCode(200)
  @ApiOperation({ summary: 'Soumettre le profil à la validation d’E-MPGT' })
  submit(@CurrentActor() actor: Actor) {
    return this.profiles.submit(actor);
  }
}

const adminProfileQuery = pageQuery.extend({
  validationStatus: z.enum(ProfileValidationStatus).optional(),
  origin: z.enum(ProfileOrigin).optional(),
});

@ApiTags('Administration — freelances')
@Roles(['PLATFORM_ADMIN'])
@Controller('admin/freelancers')
export class AdminProfileController {
  constructor(private readonly profiles: ProfileService) {}

  @Get()
  list(@Query({ schema: adminProfileQuery }) query: z.infer<typeof adminProfileQuery>) {
    return this.profiles.adminList(query);
  }

  @Get(':id')
  get(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string) {
    return this.profiles.adminGet(actor, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Modifier un profil (motif obligatoire ; correction humaine verrouillée vis-à-vis des imports)' })
  update(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: adminUpdateProfileSchema }) body: AdminUpdateProfileInput) {
    return this.profiles.adminUpdate(actor, id, body);
  }

  @Put(':id/skills')
  @ApiOperation({ summary: 'Corriger les compétences d’un profil historique non rattaché' })
  setSkills(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: profileSkillsSchema }) body: ProfileSkillsInput) {
    return this.profiles.setSkills(actor, body, id);
  }

  @Put(':id/languages')
  setLanguages(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: profileLanguagesSchema }) body: ProfileLanguagesInput) {
    return this.profiles.setLanguages(actor, body, id);
  }

  @Post(':id/experiences')
  addExperience(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: experienceSchema }) body: ExperienceInput) {
    return this.profiles.addItem(actor, 'experiences', body, id);
  }

  @Patch(':id/experiences/:itemId')
  updateExperience(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body({ schema: experienceSchema }) body: ExperienceInput,
  ) {
    return this.profiles.updateItem(actor, 'experiences', itemId, body, id);
  }

  @Delete(':id/experiences/:itemId')
  removeExperience(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string, @Param('itemId', ParseUUIDPipe) itemId: string) {
    return this.profiles.removeItem(actor, 'experiences', itemId, id);
  }

  @Post(':id/educations')
  addEducation(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: educationSchema }) body: EducationInput) {
    return this.profiles.addItem(actor, 'educations', body, id);
  }

  @Patch(':id/educations/:itemId')
  updateEducation(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body({ schema: educationSchema }) body: EducationInput,
  ) {
    return this.profiles.updateItem(actor, 'educations', itemId, body, id);
  }

  @Delete(':id/educations/:itemId')
  removeEducation(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string, @Param('itemId', ParseUUIDPipe) itemId: string) {
    return this.profiles.removeItem(actor, 'educations', itemId, id);
  }

  @Post(':id/approve')
  @HttpCode(200)
  approve(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: optionalReasonBody }) body: OptionalReasonBody) {
    return this.profiles.adminDecide(actor, id, 'approve', body.reason);
  }

  @Post(':id/request-changes')
  @HttpCode(200)
  requestChanges(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: reasonBody }) body: ReasonBody) {
    return this.profiles.adminDecide(actor, id, 'requestChanges', body.reason);
  }

  @Post(':id/reject')
  @HttpCode(200)
  reject(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: reasonBody }) body: ReasonBody) {
    return this.profiles.adminDecide(actor, id, 'reject', body.reason);
  }

  @Post(':id/suspend')
  @HttpCode(200)
  suspend(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: reasonBody }) body: ReasonBody) {
    return this.profiles.adminDecide(actor, id, 'suspend', body.reason);
  }

  @Post(':id/reactivate')
  @HttpCode(200)
  reactivate(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: reasonBody }) body: ReasonBody) {
    return this.profiles.adminDecide(actor, id, 'reactivate', body.reason);
  }

  @Post(':id/qualifications/:qualificationId/verify')
  @HttpCode(200)
  verifyQualification(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('qualificationId', ParseUUIDPipe) qualificationId: string,
    @Body({ schema: verifyDocumentSchema }) body: VerifyDocumentInput,
  ) {
    return this.profiles.verifyQualification(actor, id, qualificationId, body);
  }

  @Post(':id/invite-claim')
  @HttpCode(200)
  @ApiOperation({ summary: 'Inviter explicitement la personne concernée à rattacher un profil historique (e-mail envoyé)' })
  inviteClaim(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: inviteProfileClaimSchema }) body: InviteProfileClaimInput) {
    return this.profiles.inviteClaim(actor, id, body);
  }
}

@ApiTags('Public')
@Controller('public/profiles')
export class PublicProfileController {
  constructor(private readonly profiles: ProfileService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Catalogue public : profils validés, publiés avec consentement, anonymisés' })
  list(@Query({ schema: publicProfilesQuery }) query: PublicProfilesQuery) {
    return this.profiles.publicList(query);
  }

  @Public()
  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.profiles.publicGet(id);
  }
}

const skillQuery = z.object({ q: z.string().trim().max(100).optional() });

@ApiTags('Référentiels')
@Controller('skills')
export class SkillsController {
  constructor(private readonly skills: SkillsService) {}

  @Get()
  suggest(@Query({ schema: skillQuery }) query: z.infer<typeof skillQuery>) {
    return this.skills.suggest(query.q);
  }
}
