import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  integrationApplicationSchema,
  integrationAvailabilitySchema,
  integrationChangeSchema,
  integrationContractSchema,
  integrationCostSchema,
  integrationDocumentSchema,
  integrationFreelancerSchema,
  integrationMissionSchema,
  integrationReviewSchema,
  integrationSkillSchema,
  type CreateIntegrationClientInput,
  type CreatedIntegrationClient,
  type CursorPage,
  type IntegrationChange,
  type IntegrationClientView,
  type IntegrationEntityType,
  type IntegrationListQuery,
  type IntegrationScope,
} from '@empgt/contracts';
import type { z } from 'zod';
import type { IntegrationClient, Prisma } from '../../generated/prisma/client.js';
import { sha256Hex } from '../../common/crypto.js';
import { addDays, toIso, toIsoDate } from '../../common/dates.js';
import { badRequest, conflict, notFound } from '../../common/errors.js';
import { decimalString } from '../../common/money.js';
import { decodeCursor, encodeCursor } from '../../common/pagination.js';
import { PrismaService } from '../../common/prisma.service.js';
import type { Actor } from '../auth/actor.js';
import { AuditService } from '../core/audit.service.js';
import type { AmountsSnapshot } from '../finance/calc.js';

export const ENTITY_SCOPE: Record<IntegrationEntityType, IntegrationScope> = {
  freelancer: 'FREELANCERS',
  skill: 'SKILLS',
  availability: 'AVAILABILITY',
  mission: 'MISSIONS',
  application: 'APPLICATIONS',
  contract: 'CONTRACTS',
  cost: 'COSTS',
  review: 'REVIEWS',
  document: 'DOCUMENTS_METADATA',
};

// Règles de partage : seules des données validées et réelles (jamais de démonstration) sont exposées.
const SHARE = {
  freelancer: { validationStatus: 'APPROVED', origin: { not: 'DEMO' }, user: { status: 'ACTIVE', isDemo: false } } satisfies Prisma.FreelancerProfileWhereInput,
  mission: {
    isDemo: false,
    OR: [{ publicationStatus: 'PUBLISHED' }, { status: { in: ['SELECTION', 'ACTIVE', 'SUSPENDED', 'COMPLETED'] } }],
  } satisfies Prisma.MissionWhereInput,
  document: {
    deletedAt: null,
    visibility: { not: 'ADMIN_ONLY' },
    kind: { notIn: ['IDENTITY', 'IMPORT_SNAPSHOT', 'PAYMENT_PROOF'] },
  } satisfies Prisma.DocumentWhereInput,
};

type Keyset = { updatedAt: Date; id: string };

@Injectable()
export class IntegrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ── Pagination par curseur (updatedAt, id) ────────────────────────────────

  private keysetWhere(query: IntegrationListQuery): Record<string, unknown> {
    const cursor = decodeCursor(query.cursor);
    if (query.cursor && !cursor) throw badRequest('Curseur invalide');
    const filters: Record<string, unknown>[] = [];
    if (query.updatedSince) filters.push({ updatedAt: { gt: new Date(query.updatedSince) } });
    if (cursor?.u && cursor.i) {
      const at = new Date(cursor.u);
      filters.push({ OR: [{ updatedAt: { gt: at } }, { updatedAt: at, id: { gt: cursor.i } }] });
    }
    return filters.length ? { AND: filters } : {};
  }

  private page<T extends Keyset, D>(rows: T[], limit: number, map: (row: T) => D, schema: z.ZodType<D>): CursorPage<D> {
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit);
    const last = items.at(-1);
    return {
      // Chaque élément passe par son schéma : tout champ non déclaré est retiré.
      data: items.map((row) => schema.parse(map(row))),
      nextCursor: last ? encodeCursor({ u: last.updatedAt.toISOString(), i: last.id }) : null,
      hasMore,
    };
  }

  private order = [{ updatedAt: 'asc' as const }, { id: 'asc' as const }];

  async freelancers(query: IntegrationListQuery) {
    const rows = await this.prisma.freelancerProfile.findMany({
      where: { AND: [SHARE.freelancer, this.keysetWhere(query)] },
      orderBy: this.order,
      take: query.limit + 1,
      include: {
        skills: { include: { skill: true } },
        experiences: { orderBy: { position: 'asc' } },
        educations: { orderBy: { position: 'asc' } },
        languages: { orderBy: { position: 'asc' } },
        qualifications: { where: { status: { not: 'REJECTED' } } },
      },
    });
    return this.page(
      rows,
      query.limit,
      (p) => ({
        id: p.id,
        headline: p.headline,
        summary: p.summary,
        yearsOfExperience: p.yearsOfExperience,
        city: p.city,
        region: p.region,
        country: p.country,
        mobility: p.mobility,
        workModes: p.workModes,
        availabilityStatus: p.availabilityStatus,
        availableFrom: toIsoDate(p.availableFrom),
        validationStatus: p.validationStatus,
        skills: p.skills.map((s) => ({ skillId: s.skillId, name: s.skill.name, category: s.skill.category, level: s.level })),
        experiences: p.experiences.map((e) => ({ title: e.title, organization: e.organization, periodLabel: e.periodLabel, startYear: e.startYear, endYear: e.endYear, isCurrent: e.isCurrent })),
        educations: p.educations.map((e) => ({ title: e.title, institution: e.institution, year: e.year })),
        languages: p.languages.map((l) => ({ name: l.name, level: l.level })),
        qualifications: p.qualifications.map((q) => ({ name: q.name, status: q.status, expiresAt: toIsoDate(q.expiresAt) })),
        updatedAt: toIso(p.updatedAt),
      }),
      integrationFreelancerSchema,
    );
  }

  async skills(query: IntegrationListQuery) {
    const rows = await this.prisma.skill.findMany({ where: this.keysetWhere(query), orderBy: this.order, take: query.limit + 1 });
    return this.page(rows, query.limit, (s) => ({ id: s.id, name: s.name, slug: s.slug, category: s.category, updatedAt: toIso(s.updatedAt) }), integrationSkillSchema);
  }

  async availabilities(query: IntegrationListQuery) {
    const rows = await this.prisma.availability.findMany({
      where: { AND: [{ profile: SHARE.freelancer }, this.keysetWhere(query)] },
      orderBy: this.order,
      take: query.limit + 1,
    });
    return this.page(
      rows,
      query.limit,
      (a) => ({ id: a.id, freelancerId: a.profileId, kind: a.kind, startDate: toIsoDate(a.startDate), endDate: toIsoDate(a.endDate), daysPerWeek: decimalString(a.daysPerWeek), updatedAt: toIso(a.updatedAt) }),
      integrationAvailabilitySchema,
    );
  }

  async missions(query: IntegrationListQuery) {
    const rows = await this.prisma.mission.findMany({
      where: { AND: [SHARE.mission, this.keysetWhere(query)] },
      orderBy: this.order,
      take: query.limit + 1,
      include: { company: { select: { legalName: true } }, skills: { include: { skill: true } } },
    });
    return this.page(
      rows,
      query.limit,
      (m) => ({
        id: m.id,
        reference: m.reference,
        title: m.title,
        companyId: m.companyId,
        companyName: m.company.legalName,
        sector: m.sector,
        city: m.city,
        country: m.country,
        workMode: m.workMode,
        startDate: toIsoDate(m.startDate),
        endDate: toIsoDate(m.endDate),
        publicationStatus: m.publicationStatus,
        status: m.status,
        skills: m.skills.map((s) => ({ skillId: s.skillId, name: s.skill.name, required: s.required })),
        updatedAt: toIso(m.updatedAt),
      }),
      integrationMissionSchema,
    );
  }

  async applications(query: IntegrationListQuery) {
    const rows = await this.prisma.application.findMany({
      where: { AND: [{ mission: SHARE.mission, profile: { origin: { not: 'DEMO' } } }, this.keysetWhere(query)] },
      orderBy: this.order,
      take: query.limit + 1,
    });
    return this.page(
      rows,
      query.limit,
      (a) => ({ id: a.id, missionId: a.missionId, freelancerId: a.profileId, status: a.status, createdAt: toIso(a.createdAt), updatedAt: toIso(a.updatedAt) }),
      integrationApplicationSchema,
    );
  }

  async contracts(query: IntegrationListQuery) {
    const rows = await this.prisma.contract.findMany({
      where: { AND: [{ mission: { isDemo: false } }, this.keysetWhere(query)] },
      orderBy: this.order,
      take: query.limit + 1,
    });
    return this.page(
      rows,
      query.limit,
      (c) => ({
        id: c.id,
        reference: c.reference,
        missionId: c.missionId,
        companyId: c.companyId,
        freelancerId: c.profileId,
        status: c.status,
        startDate: toIsoDate(c.startDate),
        endDate: toIsoDate(c.endDate),
        currentEndDate: toIsoDate(c.currentEndDate),
        billingUnit: c.billingUnit,
        currency: c.currency,
        updatedAt: toIso(c.updatedAt),
      }),
      integrationContractSchema,
    );
  }

  async costs(query: IntegrationListQuery) {
    const rows = await this.prisma.timesheet.findMany({
      where: { AND: [{ status: { in: ['APPROVED', 'SUPERSEDED'] }, contract: { mission: { isDemo: false } } }, this.keysetWhere(query)] },
      orderBy: this.order,
      take: query.limit + 1,
    });
    return this.page(
      rows,
      query.limit,
      (t) => {
        const s = t.amountsSnapshot as unknown as AmountsSnapshot | null;
        return {
          id: t.id,
          contractId: t.contractId,
          periodStart: toIsoDate(t.periodStart),
          periodEnd: toIsoDate(t.periodEnd),
          version: t.version,
          status: t.status,
          hours: t.totalHours.toString(),
          quantity: s?.quantity ?? null,
          billingUnit: s?.billingUnit ?? null,
          currency: s?.currency ?? null,
          clientTotalExclTax: s?.clientTotalExclTax ?? null,
          freelanceNetExclTax: s?.freelanceNetExclTax ?? null,
          commissionAmount: s?.commissionAmount ?? null,
          approvedAt: toIso(t.approvedAt),
          updatedAt: toIso(t.updatedAt),
        };
      },
      integrationCostSchema,
    );
  }

  async reviews(query: IntegrationListQuery) {
    const rows = await this.prisma.review.findMany({ where: { AND: [{ contract: { mission: { isDemo: false } } }, this.keysetWhere(query)] }, orderBy: this.order, take: query.limit + 1 });
    return this.page(
      rows,
      query.limit,
      (r) => ({ id: r.id, contractId: r.contractId, subject: r.subject, authorRole: r.authorRole, rating: r.rating, createdAt: toIso(r.createdAt), updatedAt: toIso(r.updatedAt) }),
      integrationReviewSchema,
    );
  }

  async documents(query: IntegrationListQuery) {
    const rows = await this.prisma.document.findMany({ where: { AND: [SHARE.document, this.keysetWhere(query)] }, orderBy: this.order, take: query.limit + 1 });
    return this.page(
      rows,
      query.limit,
      (d) => {
        const target = d.contractId
          ? { type: 'contract', id: d.contractId }
          : d.profileId
            ? { type: 'freelancer', id: d.profileId }
            : d.missionId
              ? { type: 'mission', id: d.missionId }
              : d.companyId
                ? { type: 'company', id: d.companyId }
                : null;
        return {
          id: d.id,
          kind: d.kind,
          title: d.title,
          mimeType: d.mimeType,
          sizeBytes: d.sizeBytes,
          sha256: d.sha256,
          attachedTo: target,
          verificationStatus: d.verificationStatus,
          expiresAt: toIsoDate(d.expiresAt),
          createdAt: toIso(d.createdAt),
          updatedAt: toIso(d.updatedAt),
        };
      },
      integrationDocumentSchema,
    );
  }

  // ── Flux de changements (suppressions et retraits de partage compris) ─────

  private async shareable(entityType: IntegrationEntityType, ids: string[]): Promise<Set<string>> {
    if (ids.length === 0) return new Set();
    const pick = (rows: Array<{ id: string }>) => new Set(rows.map((r) => r.id));
    switch (entityType) {
      case 'freelancer':
        return pick(await this.prisma.freelancerProfile.findMany({ where: { id: { in: ids }, ...SHARE.freelancer }, select: { id: true } }));
      case 'skill':
        return pick(await this.prisma.skill.findMany({ where: { id: { in: ids } }, select: { id: true } }));
      case 'availability':
        return pick(await this.prisma.availability.findMany({ where: { id: { in: ids }, profile: SHARE.freelancer }, select: { id: true } }));
      case 'mission':
        return pick(await this.prisma.mission.findMany({ where: { id: { in: ids }, ...SHARE.mission }, select: { id: true } }));
      case 'application':
        return pick(await this.prisma.application.findMany({ where: { id: { in: ids }, mission: SHARE.mission }, select: { id: true } }));
      case 'contract':
        return pick(await this.prisma.contract.findMany({ where: { id: { in: ids }, mission: { isDemo: false } }, select: { id: true } }));
      case 'cost':
        return pick(await this.prisma.timesheet.findMany({ where: { id: { in: ids }, status: { in: ['APPROVED', 'SUPERSEDED'] } }, select: { id: true } }));
      case 'review':
        return pick(await this.prisma.review.findMany({ where: { id: { in: ids } }, select: { id: true } }));
      case 'document':
        return pick(await this.prisma.document.findMany({ where: { id: { in: ids }, ...SHARE.document }, select: { id: true } }));
      default:
        return new Set();
    }
  }

  async changes(client: IntegrationClient, enabled: IntegrationScope[], query: IntegrationListQuery): Promise<CursorPage<IntegrationChange>> {
    const cursor = decodeCursor(query.cursor);
    if (query.cursor && !cursor?.s) throw badRequest('Curseur invalide');
    const types = (Object.keys(ENTITY_SCOPE) as IntegrationEntityType[]).filter(
      (t) => client.scopes.includes(ENTITY_SCOPE[t]) && enabled.includes(ENTITY_SCOPE[t]),
    );
    const rows = await this.prisma.syncChange.findMany({
      where: {
        entityType: { in: types },
        ...(cursor?.s ? { seq: { gt: BigInt(cursor.s) } } : {}),
        ...(query.updatedSince ? { changedAt: { gt: new Date(query.updatedSince) } } : {}),
      },
      orderBy: { seq: 'asc' },
      take: query.limit + 1,
    });
    const hasMore = rows.length > query.limit;
    const page = rows.slice(0, query.limit);
    const byType = new Map<IntegrationEntityType, string[]>();
    for (const row of page) {
      const list = byType.get(row.entityType as IntegrationEntityType) ?? [];
      list.push(row.entityId);
      byType.set(row.entityType as IntegrationEntityType, list);
    }
    const shareable = new Map<IntegrationEntityType, Set<string>>();
    for (const [type, ids] of byType) shareable.set(type, await this.shareable(type, ids));
    const data = page.map((row) => {
      const type = row.entityType as IntegrationEntityType;
      const operation = row.operation === 'DELETE' ? 'DELETE' : shareable.get(type)?.has(row.entityId) ? 'UPSERT' : 'WITHDRAWN';
      return integrationChangeSchema.parse({ seq: row.seq.toString(), entityType: type, entityId: row.entityId, operation, changedAt: toIso(row.changedAt) });
    });
    const last = page.at(-1);
    return { data, nextCursor: last ? encodeCursor({ s: last.seq.toString() }) : null, hasMore };
  }

  // ── Gestion des clients (E-MPGT) ──────────────────────────────────────────

  private clientView(c: IntegrationClient): IntegrationClientView {
    return {
      id: c.id,
      name: c.name,
      description: c.description,
      tokenPrefix: c.tokenPrefix,
      scopes: c.scopes,
      createdAt: toIso(c.createdAt),
      lastUsedAt: toIso(c.lastUsedAt),
      expiresAt: toIso(c.expiresAt),
      revokedAt: toIso(c.revokedAt),
      revokeReason: c.revokeReason,
    };
  }

  async listClients(): Promise<IntegrationClientView[]> {
    const clients = await this.prisma.integrationClient.findMany({ orderBy: { createdAt: 'desc' } });
    return clients.map((c) => this.clientView(c));
  }

  async createClient(actor: Actor, input: CreateIntegrationClientInput): Promise<CreatedIntegrationClient> {
    const prefix = randomBytes(6).toString('hex');
    const token = `empgt_int_${prefix}_${randomBytes(32).toString('base64url')}`;
    const client = await this.prisma.$transaction(async (tx) => {
      const created = await tx.integrationClient.create({
        data: {
          name: input.name,
          description: input.description,
          tokenPrefix: prefix,
          tokenHash: sha256Hex(token),
          scopes: input.scopes,
          createdById: actor.userId,
          expiresAt: input.expiresInDays ? addDays(new Date(), input.expiresInDays) : null,
        },
      });
      await this.audit.record(tx, actor, { action: 'admin.integration_client.create', entityType: 'IntegrationClient', entityId: created.id, metadata: { scopes: input.scopes, prefix } });
      return created;
    });
    return { ...this.clientView(client), token };
  }

  async revokeClient(actor: Actor, id: string, reason: string): Promise<IntegrationClientView> {
    const client = await this.prisma.integrationClient.findUnique({ where: { id } });
    if (!client) throw notFound('Client d’intégration');
    if (client.revokedAt) throw conflict('Client déjà révoqué.');
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.integrationClient.update({ where: { id }, data: { revokedAt: new Date(), revokedById: actor.userId, revokeReason: reason } });
      await this.audit.record(tx, actor, { action: 'admin.integration_client.revoke', entityType: 'IntegrationClient', entityId: id, reason });
      return result;
    });
    return this.clientView(updated);
  }
}
