import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { currentRequestId } from '../../common/request-context.js';
import type { Db } from '../../common/prisma.service.js';
import type { Actor } from '../auth/actor.js';

export interface AuditInput {
  action: string;
  entityType: string;
  entityId?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
}

export type AuditActor = Actor | { kind: 'SYSTEM' } | { kind: 'CLI'; label?: string } | { kind: 'INTEGRATION'; clientId: string };

const SENSITIVE_KEY = /pass(word)?|token|secret|hash|iban|bic|card|cvv|authorization|cookie/i;

/** Retire récursivement toute donnée sensible des métadonnées d'audit. */
export function sanitizeMetadata(value: unknown, depth = 0): unknown {
  if (depth > 5) return '[profondeur]';
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitizeMetadata(item, depth + 1));
  if (value && typeof value === 'object') {
    if (value instanceof Date) return value.toISOString();
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEY.test(key) ? '[masqué]' : sanitizeMetadata(item, depth + 1);
    }
    return out;
  }
  if (typeof value === 'string' && value.length > 2000) return `${value.slice(0, 2000)}…`;
  if (typeof value === 'bigint') return value.toString();
  return value;
}

@Injectable()
export class AuditService {
  /**
   * Enregistre un événement dans la même transaction que l'opération auditée :
   * pas d'opération sensible sans trace, pas de trace sans opération.
   */
  async record(db: Db, actor: AuditActor | null, input: AuditInput): Promise<void> {
    let actorType: 'USER' | 'SYSTEM' | 'CLI' | 'INTEGRATION' = 'SYSTEM';
    let actorUserId: string | null = null;
    let actorRoles: string[] = [];
    const extra: Record<string, unknown> = {};
    if (actor && 'userId' in actor) {
      actorType = 'USER';
      actorUserId = actor.userId;
      actorRoles = actor.roles;
    } else if (actor && 'kind' in actor) {
      actorType = actor.kind;
      if (actor.kind === 'CLI' && actor.label) extra.cli = actor.label;
      if (actor.kind === 'INTEGRATION') extra.integrationClientId = actor.clientId;
    }
    const metadata = { ...input.metadata, ...extra };
    await db.auditEvent.create({
      data: {
        actorType,
        actorUserId,
        actorRoles,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        reason: input.reason ?? null,
        metadata: Object.keys(metadata).length ? (sanitizeMetadata(metadata) as Prisma.InputJsonValue) : undefined,
        requestId: currentRequestId() ?? null,
      },
    });
  }
}
