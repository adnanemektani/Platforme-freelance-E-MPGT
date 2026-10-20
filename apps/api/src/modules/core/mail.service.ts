import { Injectable, Logger } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../../config/env.js';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Adaptateur e-mail. Transports :
 * - smtp   : envoi réel (Mailpit en local, relais SMTP en production) ;
 * - memory : messages conservés en mémoire (tests automatisés) ;
 * - log    : journalise uniquement destinataire et sujet (jamais le contenu, qui peut contenir un lien sensible).
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger('Mail');
  private transporter: Transporter | undefined;
  /** Boîte d'envoi en mémoire (transport « memory » uniquement). */
  readonly outbox: MailMessage[] = [];

  async send(message: MailMessage): Promise<void> {
    const transport = env().MAIL_TRANSPORT;
    if (transport === 'memory') {
      this.outbox.push(message);
      return;
    }
    if (transport === 'log') {
      this.logger.log(`E-mail (non envoyé, transport « log ») à ${maskEmail(message.to)} : ${message.subject}`);
      return;
    }
    this.transporter ??= nodemailer.createTransport({
      host: env().SMTP_HOST,
      port: env().SMTP_PORT,
      secure: env().SMTP_SECURE,
      auth: env().SMTP_USER ? { user: env().SMTP_USER, pass: env().SMTP_PASSWORD } : undefined,
    });
    await this.transporter.sendMail({ from: env().MAIL_FROM, ...message });
    this.logger.log(`E-mail envoyé à ${maskEmail(message.to)} : ${message.subject}`);
  }

  /** Envoi « au mieux » : un échec d'e-mail ne fait jamais échouer le parcours métier. */
  async sendSafely(message: MailMessage): Promise<boolean> {
    try {
      await this.send(message);
      return true;
    } catch (error) {
      this.logger.warn(`Échec d'envoi à ${maskEmail(message.to)} : ${(error as Error).message}`);
      return false;
    }
  }
}

export function maskEmail(email: string): string {
  const [local = '', domain = ''] = email.split('@');
  return `${local.slice(0, 2)}***@${domain}`;
}
