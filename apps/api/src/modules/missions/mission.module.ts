import { Module } from '@nestjs/common';
import { ProfileModule } from '../profiles/profile.module.js';
import { ApplicationService } from './application.service.js';
import { ApplicationController, MissionController } from './mission.controller.js';
import { MissionService } from './mission.service.js';

@Module({
  imports: [ProfileModule],
  controllers: [MissionController, ApplicationController],
  providers: [MissionService, ApplicationService],
  exports: [MissionService, ApplicationService],
})
export class MissionModule {}
