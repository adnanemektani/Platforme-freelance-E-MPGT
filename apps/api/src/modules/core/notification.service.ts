import { Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import { env } from '../../config/env.js';
import { PrismaService, type Db } from '../../common/prisma.service.js';
import { MailService } from './mail.service.js';
import { mailTemplates } from './mail-templates.js';

export interface NotificationInput {
  type: string;
  title: string;
  body: string;
  link?: string | null;
  /** Envoyer aussi un e-mail (sans donnée sensible) après validation de la transaction. */
  email?: boolean;
}

/**
 * Notifications in-app, créées dans la transaction métier. Les e-mails associés sont
 * envoyés par un répartiteur périodique : une transaction annulée ne déclenche aucun e-mail.
 */
@Injectable()
export class NotificationService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger('Notifications');
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  async notifyUsers(db: Db, userIds: Array<string | null | undefined>, input: NotificationInput): Promise<void> {
    const unique = [...new Set(userIds.filter((id): id is string => Boolean(id)))];
    if (unique.length === 0) return;
    await db.notification.createMany({
      data: unique.map((userId) => ({
        userId,
        type: input.type,
        title: input.title,
        body: input.body,
        link: input.link ?? null,
        emailStatus: input.email ? 'PENDING' : 'NOT_REQUIRED',
      })),
    });
  }

  async notifyCompany(db: Db, companyId: string, input: NotificationInput): Promise<void> {
    const members = await db.companyMembership.findMany({
      where: { companyId, status: 'ACTIVE', user: { status: 'ACTIVE' } },
      select: { userId: true },
    });
    await this.notifyUsers(db, members.map((m) => m.userId), input);
  }

  async notifyProfileOwner(db: Db, profileId: string, input: NotificationInput): Promise<void> {
    const profile = await db.freelancerProfile.findUnique({ where: { id: profileId }, select: { userId: true } });
    await this.notifyUsers(db, [profile?.userId], input);
  }

  async notifyAdmins(db: Db, input: NotificationInput): Promise<void> {
    const admins = await db.userRole.findMany({
      where: { role: 'PLATFORM_ADMIN', revokedAt: null, user: { status: 'ACTIVE' } },
      select: { userId: true },
    });
    await this.notifyUsers(db, admins.map((a) => a.userId), input);
  }

  onApplicationBootstrap(): void {
    const interval = env().NOTIFICATION_DISPATCH_INTERVAL_MS;
    if (interval > 0) {
      this.timer = setInterval(() => void this.dispatchPendingEmails(), interval);
      this.timer.unref();
    }
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Envoie les e-mails de notification en attente (3 tentatives maximum). */
  async dispatchPendingEmails(limit = 25): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    let sent = 0;
    try {
      const pending = await this.prisma.notification.findMany({
        where: { emailStatus: 'PENDING', emailAttempts: { lt: 3 } },
        orderBy: { createdAt: 'asc' },
        take: limit,
        include: { user: { select: { email: true, status: true } } },
      });
      for (const notification of pending) {
        if (notification.user.status !== 'ACTIVE') {
          await this.prisma.notification.update({ where: { id: notification.id }, data: { emailStatus: 'NOT_REQUIRED' } });
          continue;
        }
        const ok = await this.mail.sendSafely(
          mailTemplates.notification(notification.user.email, notification.title, notification.body, notification.link),
        );
        await this.prisma.notification.update({
          where: { id: notification.id },
          data: ok
            ? { emailStatus: 'SENT', emailedAt: new Date(), emailAttempts: { increment: 1 } }
            : { emailAttempts: { increment: 1 }, ...(notification.emailAttempts >= 2 ? { emailStatus: 'FAILED' } : {}) },
        });
        if (ok) sent++;
      }
    } catch (error) {
      this.logger.warn(`Répartition des e-mails interrompue : ${(error as Error).message}`);
    } finally {
      this.running = false;
    }
    return sent;
  }
}
