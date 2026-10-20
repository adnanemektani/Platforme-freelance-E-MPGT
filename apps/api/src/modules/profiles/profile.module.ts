import { Module } from '@nestjs/common';
import { AdminProfileController, ProfileController, PublicProfileController, SkillsController } from './profile.controller.js';
import { ProfileService } from './profile.service.js';
import { SkillsService } from './skills.service.js';

@Module({
  controllers: [ProfileController, AdminProfileController, PublicProfileController, SkillsController],
  providers: [ProfileService, SkillsService],
  exports: [ProfileService, SkillsService],
})
export class ProfileModule {}
