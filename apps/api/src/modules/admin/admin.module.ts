import { Module } from '@nestjs/common';
import { DashboardController } from '../dashboard/dashboard.controller.js';
import { DashboardService } from '../dashboard/dashboard.service.js';
import { AdminController, PublicController } from './admin.controller.js';
import { AdminService } from './admin.service.js';

@Module({
  controllers: [AdminController, PublicController, DashboardController],
  providers: [AdminService, DashboardService],
})
export class AdminModule {}
