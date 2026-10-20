import { Module } from '@nestjs/common';
import { AmendmentController, ContractController, ProposalController } from './commercial.controller.js';
import { ContractService } from './contract.service.js';
import { ProposalService } from './proposal.service.js';

@Module({
  controllers: [ProposalController, ContractController, AmendmentController],
  providers: [ProposalService, ContractService],
  exports: [ProposalService, ContractService],
})
export class CommercialModule {}
