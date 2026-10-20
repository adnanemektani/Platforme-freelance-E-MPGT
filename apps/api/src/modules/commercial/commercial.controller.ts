import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  contractListQuery,
  contractReviewSchema,
  createAmendmentSchema,
  createProposalSchema,
  optionalReasonBody,
  proposalDecisionSchema,
  proposalListQuery,
  proposalTermsSchema,
  reasonBody,
  signedDepositSchema,
  type ContractListQuery,
  type ContractReviewInput,
  type CreateAmendmentInput,
  type CreateProposalInput,
  type OptionalReasonBody,
  type ProposalDecisionInput,
  type ProposalListQuery,
  type ProposalTermsInput,
  type ReasonBody,
  type SignedDepositInput,
} from '@empgt/contracts';
import { z } from 'zod';
import type { Actor } from '../auth/actor.js';
import { CurrentActor, Roles } from '../auth/decorators.js';
import { uploadInterceptor } from '../documents/document.controller.js';
import type { UploadedFile as Upload } from '../documents/document.service.js';
import { ContractService } from './contract.service.js';
import { ProposalService } from './proposal.service.js';

@ApiTags('Propositions commerciales')
@Controller('proposals')
export class ProposalController {
  constructor(private readonly proposals: ProposalService) {}

  @Get()
  list(@CurrentActor() actor: Actor, @Query({ schema: proposalListQuery }) query: ProposalListQuery) {
    return this.proposals.list(actor, query);
  }

  @Roles(['PLATFORM_ADMIN'])
  @Post()
  @ApiOperation({ summary: 'Préparer une proposition pour une candidature retenue (E-MPGT)' })
  create(@CurrentActor() actor: Actor, @Body({ schema: createProposalSchema }) body: CreateProposalInput) {
    return this.proposals.create(actor, body);
  }

  @Get(':id')
  get(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string) {
    return this.proposals.get(actor, id);
  }

  @Roles(['PLATFORM_ADMIN'])
  @Patch(':id')
  update(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: proposalTermsSchema }) body: ProposalTermsInput) {
    return this.proposals.update(actor, id, body);
  }

  @Roles(['PLATFORM_ADMIN'])
  @Post(':id/send')
  @HttpCode(200)
  send(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string) {
    return this.proposals.send(actor, id);
  }

  @Roles(['COMPANY', 'FREELANCER'])
  @Post(':id/accept')
  @HttpCode(200)
  accept(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: proposalDecisionSchema }) body: ProposalDecisionInput) {
    return this.proposals.decide(actor, id, 'accept', body.comment ?? null);
  }

  @Roles(['COMPANY', 'FREELANCER'])
  @Post(':id/decline')
  @HttpCode(200)
  decline(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: proposalDecisionSchema }) body: ProposalDecisionInput) {
    return this.proposals.decide(actor, id, 'decline', body.comment ?? null);
  }

  @Roles(['PLATFORM_ADMIN'])
  @Post(':id/revise')
  @HttpCode(200)
  @ApiOperation({ summary: 'Créer une nouvelle version (l’ancienne est conservée, marquée « remplacée »)' })
  revise(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string) {
    return this.proposals.revise(actor, id);
  }

  @Roles(['PLATFORM_ADMIN'])
  @Post(':id/withdraw')
  @HttpCode(200)
  withdraw(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: reasonBody }) body: ReasonBody) {
    return this.proposals.withdraw(actor, id, body.reason);
  }

  @Roles(['PLATFORM_ADMIN'])
  @Post(':id/approve')
  @HttpCode(200)
  @ApiOperation({ summary: 'Validation E-MPGT après accord des parties : génère le contrat aux conditions figées' })
  approve(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string) {
    return this.proposals.approve(actor, id);
  }
}

const reviewsQuery = z.object({ contractId: z.uuid().optional() });

@ApiTags('Contrats')
@Controller('contracts')
export class ContractController {
  constructor(private readonly contracts: ContractService) {}

  @Get()
  list(@CurrentActor() actor: Actor, @Query({ schema: contractListQuery }) query: ContractListQuery) {
    return this.contracts.list(actor, query);
  }

  @Get('reviews')
  reviews(@CurrentActor() actor: Actor, @Query({ schema: reviewsQuery }) query: z.infer<typeof reviewsQuery>) {
    return this.contracts.reviews(actor, query.contractId);
  }

  @Get(':id')
  get(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string) {
    return this.contracts.get(actor, id);
  }

  @Roles(['PLATFORM_ADMIN'])
  @Post(':id/signed-document')
  @UseInterceptors(uploadInterceptor())
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Déposer le contrat signé (PDF) avec date et preuve de signature — pas une signature électronique' })
  depositSigned(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Upload | undefined,
    @Body({ schema: signedDepositSchema }) body: SignedDepositInput,
  ) {
    return this.contracts.depositSigned(actor, id, file, body);
  }

  @Roles(['PLATFORM_ADMIN'])
  @Post(':id/activate')
  @HttpCode(200)
  activate(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: optionalReasonBody }) body: OptionalReasonBody) {
    return this.contracts.decide(actor, id, 'activate', body.reason);
  }

  @Roles(['PLATFORM_ADMIN'])
  @Post(':id/suspend')
  @HttpCode(200)
  suspend(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: reasonBody }) body: ReasonBody) {
    return this.contracts.decide(actor, id, 'suspend', body.reason);
  }

  @Roles(['PLATFORM_ADMIN'])
  @Post(':id/resume')
  @HttpCode(200)
  resume(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: reasonBody }) body: ReasonBody) {
    return this.contracts.decide(actor, id, 'resume', body.reason);
  }

  @Roles(['PLATFORM_ADMIN'])
  @Post(':id/complete')
  @HttpCode(200)
  complete(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: optionalReasonBody }) body: OptionalReasonBody) {
    return this.contracts.decide(actor, id, 'complete', body.reason);
  }

  @Roles(['PLATFORM_ADMIN'])
  @Post(':id/terminate')
  @HttpCode(200)
  terminate(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: reasonBody }) body: ReasonBody) {
    return this.contracts.decide(actor, id, 'terminate', body.reason);
  }

  @Roles(['PLATFORM_ADMIN'])
  @Post(':id/cancel')
  @HttpCode(200)
  cancel(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: reasonBody }) body: ReasonBody) {
    return this.contracts.decide(actor, id, 'cancel', body.reason);
  }

  @Roles(['PLATFORM_ADMIN'])
  @Post(':id/amendments')
  @ApiOperation({ summary: 'Créer un avenant (prolongation, modification de conditions…)' })
  amend(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: createAmendmentSchema }) body: CreateAmendmentInput) {
    return this.contracts.createAmendment(actor, id, body);
  }

  @Post(':id/reviews')
  @ApiOperation({ summary: 'Évaluer une mission terminée (visibilité interne E-MPGT par défaut)' })
  review(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: contractReviewSchema }) body: ContractReviewInput) {
    return this.contracts.review(actor, id, body);
  }
}

@ApiTags('Contrats')
@Roles(['PLATFORM_ADMIN'])
@Controller('amendments')
export class AmendmentController {
  constructor(private readonly contracts: ContractService) {}

  @Post(':id/signed-document')
  @UseInterceptors(uploadInterceptor())
  @ApiConsumes('multipart/form-data')
  depositSigned(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Upload | undefined,
    @Body({ schema: signedDepositSchema }) body: SignedDepositInput,
  ) {
    return this.contracts.depositAmendmentSigned(actor, id, file, body);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  cancel(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: reasonBody }) body: ReasonBody) {
    return this.contracts.cancelAmendment(actor, id, body.reason);
  }
}
