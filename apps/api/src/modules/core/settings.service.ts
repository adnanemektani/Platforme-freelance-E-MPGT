import { Injectable } from '@nestjs/common';
import { platformSettingsSchema, type PlatformSettings, type PublicSettings, type UpdateSettingsInput } from '@empgt/contracts';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../common/prisma.service.js';
import type { Actor } from '../auth/actor.js';
import { AuditService } from './audit.service.js';

/**
 * Politique initiale V1 (susceptible d'évoluer, modifiable par E-MPGT avec motif tracé) :
 * - vérification de l'e-mail pour tous (non désactivable) ;
 * - validation des profils freelances avant publication et candidature ;
 * - vérification de l'entreprise avant la publication de sa première mission ;
 * - validation des missions avant leur visibilité aux freelances.
 */
export const DEFAULT_SETTINGS: PlatformSettings = {
  freelancerProfileApprovalRequired: true,
  companyVerificationRequiredForPublication: true,
  missionApprovalRequired: true,
  freelancerSeesCompanyName: false,
  commissionPolicy: null,
  legal: {
    operatorName: null,
    operatorLegalForm: null,
    operatorAddress: null,
    operatorRegistration: null,
    operatorCountry: null,
    publicationDirector: null,
    hostingProvider: null,
    contactEmail: null,
    dataProtectionContact: null,
  },
  integrationEnabledScopes: [],
};

const KEY = 'platform';

@Injectable()
export class SettingsService {
  private cache: { value: PlatformSettings; at: number } | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async get(): Promise<PlatformSettings> {
    if (this.cache && Date.now() - this.cache.at < 10_000) return this.cache.value;
    const row = await this.prisma.platformSetting.findUnique({ where: { key: KEY } });
    const stored = (row?.value ?? {}) as Partial<PlatformSettings>;
    const merged = platformSettingsSchema.safeParse({
      ...DEFAULT_SETTINGS,
      ...stored,
      legal: { ...DEFAULT_SETTINGS.legal, ...stored.legal },
    });
    const value = merged.success ? merged.data : DEFAULT_SETTINGS;
    this.cache = { value, at: Date.now() };
    return value;
  }

  async getPublic(): Promise<PublicSettings> {
    const settings = await this.get();
    return {
      legal: settings.legal,
      policy: {
        freelancerProfileApprovalRequired: settings.freelancerProfileApprovalRequired,
        companyVerificationRequiredForPublication: settings.companyVerificationRequiredForPublication,
        missionApprovalRequired: settings.missionApprovalRequired,
      },
    };
  }

  async update(actor: Actor, input: UpdateSettingsInput): Promise<PlatformSettings> {
    const current = await this.get();
    const { reason, legal, ...rest } = input;
    const next = platformSettingsSchema.parse({
      ...current,
      ...Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined)),
      legal: { ...current.legal, ...legal },
    });
    const changes: Record<string, { before: unknown; after: unknown }> = {};
    for (const key of Object.keys(next) as Array<keyof PlatformSettings>) {
      if (JSON.stringify(current[key]) !== JSON.stringify(next[key])) changes[key] = { before: current[key], after: next[key] };
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.platformSetting.upsert({
        where: { key: KEY },
        create: { key: KEY, value: next as unknown as Prisma.InputJsonValue, updatedById: actor.userId },
        update: { value: next as unknown as Prisma.InputJsonValue, updatedById: actor.userId },
      });
      await this.audit.record(tx, actor, {
        action: 'settings.update',
        entityType: 'PlatformSetting',
        entityId: KEY,
        reason,
        metadata: { changes },
      });
    });
    this.cache = undefined;
    return next;
  }

  invalidate(): void {
    this.cache = undefined;
  }
}
