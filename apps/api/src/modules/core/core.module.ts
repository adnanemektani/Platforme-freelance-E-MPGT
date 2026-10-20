import { Global, Module } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service.js';
import { AuditService } from './audit.service.js';
import { MailService } from './mail.service.js';
import { NotificationService } from './notification.service.js';
import { SettingsService } from './settings.service.js';
import { StorageService } from './storage.service.js';

/** Services transverses disponibles dans tous les modules. */
@Global()
@Module({
  providers: [PrismaService, AuditService, MailService, NotificationService, SettingsService, StorageService],
  exports: [PrismaService, AuditService, MailService, NotificationService, SettingsService, StorageService],
})
export class CoreModule {}
