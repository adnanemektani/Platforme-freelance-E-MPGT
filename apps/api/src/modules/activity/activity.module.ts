import { Module } from '@nestjs/common';
import { DisputeController, TimesheetController } from './activity.controller.js';
import { DisputeService } from './dispute.service.js';
import { TimesheetService } from './timesheet.service.js';

@Module({
  controllers: [TimesheetController, DisputeController],
  providers: [TimesheetService, DisputeService],
  exports: [TimesheetService],
})
export class ActivityModule {}
