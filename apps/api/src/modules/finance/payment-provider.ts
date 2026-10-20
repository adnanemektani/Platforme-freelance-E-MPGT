import { Injectable } from '@nestjs/common';
import { env } from '../../config/env.js';
import { hmac, safeEqual } from '../../common/crypto.js';

// Adaptateur de prestataire de paiement, préparé pour une automatisation ultérieure.
//
// V1 : aucun prestataire réel n'est intégré (décision D-11). Le mode « manual » est le seul
// disponible en production : aucun mouvement d'argent, aucune collecte de coordonnées bancaires.
// Le prestataire « sandbox » (environnements hors production uniquement) sert à éprouver la
// chaîne de réception des webhooks : vérification de signature, idempotence, rejeux.
// Pour un vrai prestataire, privilégier son onboarding hébergé (KYC, IBAN saisis chez lui).

export interface WebhookVerification {
  valid: boolean;
  reason?: string;
  eventId?: string;
  eventType?: string;
  payload?: unknown;
}

export interface PaymentProvider {
  code: string;
  label: string;
  mode: 'NONE' | 'TEST' | 'LIVE';
  /** Les opérations financières automatiques restent désactivées tant que le modèle n'est pas validé. */
  automationEnabled: false;
  verifyWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>, now?: Date): WebhookVerification;
}

class ManualProvider implements PaymentProvider {
  readonly code = 'manual';
  readonly label = 'Suivi manuel (aucun prestataire)';
  readonly mode = 'NONE' as const;
  readonly automationEnabled = false as const;
  verifyWebhook(): WebhookVerification {
    return { valid: false, reason: 'Aucun prestataire de paiement configuré' };
  }
}

/** Signature « t=<horodatage>,v1=<HMAC-SHA256(secret, `${t}.${corps}`)> », tolérance de 5 minutes. */
export class SandboxProvider implements PaymentProvider {
  readonly code = 'sandbox';
  readonly label = 'Bac à sable (MODE TEST — aucun paiement réel)';
  readonly mode = 'TEST' as const;
  readonly automationEnabled = false as const;
  static readonly TOLERANCE_SECONDS = 300;

  constructor(private readonly secret: string) {}

  static sign(secret: string, body: string, timestamp: number): string {
    return `t=${timestamp},v1=${hmac(secret, `${timestamp}.${body}`)}`;
  }

  verifyWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>, now = new Date()): WebhookVerification {
    const header = headers['x-empgt-signature'];
    const value = Array.isArray(header) ? header[0] : header;
    if (!value) return { valid: false, reason: 'Signature absente' };
    const parts = Object.fromEntries(value.split(',').map((p) => p.split('=') as [string, string]));
    const timestamp = Number(parts.t);
    if (!Number.isFinite(timestamp)) return { valid: false, reason: 'Horodatage invalide' };
    if (Math.abs(now.getTime() / 1000 - timestamp) > SandboxProvider.TOLERANCE_SECONDS) {
      return { valid: false, reason: 'Horodatage hors tolérance (rejeu possible)' };
    }
    const expected = hmac(this.secret, `${timestamp}.${rawBody.toString('utf8')}`);
    if (!parts.v1 || !safeEqual(parts.v1, expected)) return { valid: false, reason: 'Signature invalide' };
    try {
      const payload = JSON.parse(rawBody.toString('utf8')) as { id?: unknown; type?: unknown };
      if (typeof payload.id !== 'string' || typeof payload.type !== 'string') return { valid: false, reason: 'Événement sans identifiant ou type' };
      return { valid: true, eventId: payload.id, eventType: payload.type, payload };
    } catch {
      return { valid: false, reason: 'Corps JSON invalide' };
    }
  }
}

@Injectable()
export class PaymentProviderRegistry {
  private readonly provider: PaymentProvider;

  constructor() {
    const code = (env().PAYMENT_PROVIDER ?? '').trim();
    if (code === 'sandbox' && env().APP_ENV !== 'production' && env().PAYMENT_WEBHOOK_SECRET) {
      this.provider = new SandboxProvider(env().PAYMENT_WEBHOOK_SECRET!);
    } else {
      this.provider = new ManualProvider();
    }
  }

  current(): PaymentProvider {
    return this.provider;
  }

  get(code: string): PaymentProvider | null {
    return this.provider.code === code && this.provider.code !== 'manual' ? this.provider : null;
  }

  describe() {
    return {
      code: this.provider.code,
      label: this.provider.label,
      mode: this.provider.mode,
      automationEnabled: this.provider.automationEnabled,
    };
  }
}
