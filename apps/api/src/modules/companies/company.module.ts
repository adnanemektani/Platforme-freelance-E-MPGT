import { Module } from '@nestjs/common';
import { AdminCompanyController, CompanyController } from './company.controller.js';
import { CompanyService } from './company.service.js';

@Module({
  controllers: [CompanyController, AdminCompanyController],
  providers: [CompanyService],
  exports: [CompanyService],
})
export class CompanyModule {}
