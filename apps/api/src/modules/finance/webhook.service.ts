import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { sha256Hex } from '../../common/crypto.js';
import { notFound } from '../../common/errors.js';
import { PrismaService } from '../../common/prisma.service.js';
import { AuditService } from '../core/audit.service.js';
import { PaymentProviderRegistry } from './payment-provider.js';

/**
 * Réception des webhooks de prestataire : signature vérifiée, idempotence par
 * (prestataire, identifiant d'événement), rejeux détectés. En V1 aucun événement ne
 * déclenche d'effet financier : il est conservé et marqué « ignoré » (suivi manuel).
 */
@Injectable()
export class WebhookService {
  private readonly logger = new Logger('Webhooks');

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly providers: PaymentProviderRegistry,
  ) {}

  async ingest(providerCode: string, rawBody: Buffer | undefined, headers: Record<string, string | string[] | undefined>) {
    const provider = this.providers.get(providerCode);
    if (!provider) throw notFound('Prestataire de paiement');
    const body = rawBody ?? Buffer.alloc(0);
    const verification = provider.verifyWebhook(body, headers);
    if (!verification.valid) {
      this.logger.warn(`Webhook ${providerCode} refusé : ${verification.reason}`);
      await this.audit.record(this.prisma, { kind: 'SYSTEM' }, {
        action: 'payment.webhook_rejected',
        entityType: 'PaymentWebhookEvent',
        reason: verification.reason,
        metadata: { provider: providerCode, payloadSha256: sha256Hex(body) },
      });
      throw new HttpException('Signature de webhook invalide', HttpStatus.UNAUTHORIZED);
    }
    const existing = await this.prisma.paymentWebhookEvent.findUnique({
      where: { provider_eventId: { provider: providerCode, eventId: verification.eventId! } },
    });
    if (existing) {
      // Rejeu d'un événement déjà reçu : réponse identique, aucun nouveau traitement.
      return { received: true, duplicate: true, status: existing.status };
    }
    try {
      const event = await this.prisma.paymentWebhookEvent.create({
        data: {
          provider: providerCode,
          eventId: verification.eventId!,
          eventType: verification.eventType!,
          signatureValid: true,
          payloadSha256: sha256Hex(body),
          status: 'IGNORED',
          error: 'Traitement automatique désactivé en V1 : suivi manuel des paiements',
          processedAt: new Date(),
        },
      });
      await this.audit.record(this.prisma, { kind: 'SYSTEM' }, {
        action: 'payment.webhook_received',
        entityType: 'PaymentWebhookEvent',
        entityId: event.id,
        metadata: { provider: providerCode, eventType: verification.eventType, mode: provider.mode },
      });
      return { received: true, duplicate: false, status: event.status };
    } catch (error) {
      // Course entre deux livraisons simultanées du même événement : l'index unique tranche.
      if ((error as { code?: string }).code === 'P2002' || /unique/i.test(String(error))) {
        return { received: true, duplicate: true, status: 'IGNORED' };
      }
      throw error;
    }
  }
}
