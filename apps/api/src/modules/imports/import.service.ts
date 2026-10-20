import { createHash } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import type {
  ImportBatchView,
  ImportItemListQuery,
  ImportItemView,
  Page,
  PageQuery,
  ParsedProfile,
  ReviewImportItemInput,
} from '@empgt/contracts';
import type { ImportBatch, ImportItem, Prisma } from '../../generated/prisma/client.js';
import { check, visibleActions } from '../../common/actions.js';
import { toIso } from '../../common/dates.js';
import { badRequest, conflict, notFound } from '../../common/errors.js';
import { pageArgs, toPage } from '../../common/pagination.js';
import { PrismaService, type Db } from '../../common/prisma.service.js';
import { jaccard, slugify, tokens } from '../../common/text.js';
import { env } from '../../config/env.js';
import { AuditService, type AuditActor } from '../core/audit.service.js';
import { DocumentService } from '../documents/document.service.js';
import { SkillsService } from '../profiles/skills.service.js';
import { PARSER_VERSION, parseGammaProfiles, type ParsedBlock } from './gamma-parser.js';

const MAX_SNAPSHOT_BYTES = 15 * 1024 * 1024;
const DUPLICATE_THRESHOLD = 0.6;

/** Champs jamais déduits d'un profil historique : à confirmer par la personne concernée. */
const ALWAYS_TO_CONFIRM = ['identity', 'email', 'businessStatus', 'availabilityStatus', 'rates', 'city', 'country', 'mobility', 'workModes', 'qualifications', 'publicationConsent'];

const GENERAL_FIELDS = ['headline', 'summary', 'yearsOfExperience'] as const;
const SECTION_FIELDS = ['skills', 'experiences', 'educations', 'languages'] as const;

function yearsFrom(parsed: ParsedProfile): number | null {
  for (const text of [parsed.tagline, parsed.summary]) {
    const match = text ? /(\d{1,2})\s*\+?\s*(?:ans|années)\s+d['’]\s*(?:exp|expérience|expertise)/i.exec(text) : null;
    if (match) return Number(match[1]);
  }
  return null;
}

@Injectable()
export class ImportService {
  private readonly logger = new Logger('Import');

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly documents: DocumentService,
    private readonly skills: SkillsService,
  ) {}

  // ── Collecte ──────────────────────────────────────────────────────────────

  /** Collecte côté serveur, limitée aux hôtes autorisés (protection SSRF). */
  async fetchSnapshot(sourceUrl: string): Promise<string> {
    const allowed = env().IMPORT_ALLOWED_HOSTS.split(',').map((h) => h.trim().toLowerCase()).filter(Boolean);
    let url = new URL(sourceUrl);
    for (let hop = 0; hop < 4; hop++) {
      const host = url.hostname.toLowerCase();
      const hostOk = allowed.some((a) => host === a || host === `www.${a}`);
      if (url.protocol !== 'https:' || !hostOk || url.username || url.password || (url.port && url.port !== '443')) {
        throw badRequest(`Source non autorisée : seules les pages https de ${allowed.join(', ')} peuvent être collectées.`);
      }
      const response = await fetch(url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(20_000),
        headers: { 'user-agent': 'EMPGT-Freelance-Import/1.0 (+collecte manuelle validée)', accept: 'text/html' },
      });
      if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
        url = new URL(response.headers.get('location')!, url);
        continue;
      }
      if (!response.ok) throw badRequest(`La source a répondu ${response.status} : collecte impossible.`);
      const length = Number(response.headers.get('content-length') ?? 0);
      if (length > MAX_SNAPSHOT_BYTES) throw badRequest('Page trop volumineuse.');
      const text = await response.text();
      if (Buffer.byteLength(text) > MAX_SNAPSHOT_BYTES) throw badRequest('Page trop volumineuse.');
      return text;
    }
    throw badRequest('Trop de redirections.');
  }

  /** Analyse un instantané et crée un lot en prévisualisation (aucun profil n'est créé ici). */
  async createBatch(actor: AuditActor, html: string, sourceUrl: string, collectedAt = new Date()): Promise<ImportBatchView> {
    let result: ReturnType<typeof parseGammaProfiles>;
    try {
      result = parseGammaProfiles(html);
    } catch (error) {
      throw badRequest(`Instantané illisible : ${(error as Error).message}`);
    }
    const snapshotSha256 = createHash('sha256').update(html).digest('hex');
    const existing = await this.prisma.freelancerProfile.findMany({
      select: { id: true, headline: true, summary: true, sourceExternalKey: true, skills: { select: { skill: { select: { name: true } } } } },
    });
    const profileTokens = existing.map((p) => ({
      id: p.id,
      headline: p.headline,
      key: p.sourceExternalKey,
      tokens: tokens([p.headline ?? '', p.summary ?? '', ...p.skills.map((s) => s.skill.name)].join(' ')),
    }));

    const batchId = await this.prisma.$transaction(
      async (tx) => {
        const batch = await tx.importBatch.create({
          data: {
            sourceUrl,
            collectedAt,
            parserVersion: PARSER_VERSION,
            snapshotSha256,
            stats: {},
            createdById: 'userId' in actor ? actor.userId : null,
          },
        });
        await this.documents.storeSystemFile(tx, {
          buffer: Buffer.from(html, 'utf8'),
          mimeType: 'text/html',
          filename: `instantane-${collectedAt.toISOString().slice(0, 10)}.html`,
          kind: 'IMPORT_SNAPSHOT',
          title: `Instantané ${sourceUrl}`,
          links: { importBatchId: batch.id },
        });
        const stats = { blocks: result.blocks, profiles: result.profiles.length, new: 0, unchanged: 0, changed: 0, duplicates: 0, skipped: result.skipped };
        const seenFingerprints = new Map<string, string>();
        for (const block of result.profiles) {
          const item = await this.classify(tx, block, profileTokens, seenFingerprints);
          stats[item.change === 'NEW' ? 'new' : item.change === 'UNCHANGED' ? 'unchanged' : 'changed']++;
          if (item.duplicateOfProfileId || item.internalDuplicate) stats.duplicates++;
          await tx.importItem.create({
            data: {
              batchId: batch.id,
              externalKey: block.externalKey,
              fingerprint: block.fingerprint,
              change: item.change,
              status: item.change === 'UNCHANGED' ? 'APPROVED' : 'PENDING_REVIEW',
              parsed: block.parsed as unknown as Prisma.InputJsonValue,
              rawText: block.rawText,
              warnings: item.warnings,
              duplicateOfProfileId: item.duplicateOfProfileId,
              duplicateScore: item.duplicateScore,
              profileId: item.linkedProfileId,
              reviewNote: item.change === 'UNCHANGED' ? 'Inchangé depuis le dernier import validé : aucune modification appliquée' : null,
              reviewedAt: item.change === 'UNCHANGED' ? new Date() : null,
            },
          });
        }
        await tx.importBatch.update({ where: { id: batch.id }, data: { stats, status: 'PREVIEW' } });
        await this.audit.record(tx, actor, {
          action: 'import.batch_create',
          entityType: 'ImportBatch',
          entityId: batch.id,
          metadata: { sourceUrl, parserVersion: PARSER_VERSION, snapshotSha256, ...stats },
        });
        return batch.id;
      },
      { timeout: 120_000 },
    );
    return this.getBatch(batchId);
  }

  private async classify(
    tx: Db,
    block: ParsedBlock,
    profiles: Array<{ id: string; headline: string | null; key: string | null; tokens: Set<string> }>,
    seen: Map<string, string>,
  ) {
    const warnings = [...block.warnings];
    let internalDuplicate = false;
    const earlier = seen.get(block.fingerprint);
    if (earlier) {
      warnings.push(`Contenu identique au bloc ${earlier} de la même source : doublon probable`);
      internalDuplicate = true;
    } else seen.set(block.fingerprint, block.externalKey);

    const lastApproved = await tx.importItem.findFirst({
      where: { externalKey: block.externalKey, status: 'APPROVED', profileId: { not: null } },
      orderBy: { createdAt: 'desc' },
    });
    const linked = profiles.find((p) => p.key === block.externalKey);
    let change: 'NEW' | 'UNCHANGED' | 'CHANGED' = 'NEW';
    if (lastApproved || linked) change = lastApproved && lastApproved.fingerprint === block.fingerprint ? 'UNCHANGED' : 'CHANGED';

    let duplicateOfProfileId: string | null = null;
    let duplicateScore: number | null = null;
    if (!linked) {
      const candidate = tokens([block.parsed.headline ?? '', block.parsed.summary ?? '', ...block.parsed.skills.map((s) => s.name)].join(' '));
      for (const p of profiles) {
        const score = jaccard(candidate, p.tokens);
        if (score >= DUPLICATE_THRESHOLD && score > (duplicateScore ?? 0)) {
          duplicateScore = Math.round(score * 100) / 100;
          duplicateOfProfileId = p.id;
        }
      }
      if (duplicateOfProfileId) warnings.push(`Ressemble à un profil existant (similarité ${duplicateScore}) : vérifier avant validation`);
    }
    return { change, warnings, duplicateOfProfileId, duplicateScore, internalDuplicate, linkedProfileId: linked?.id ?? lastApproved?.profileId ?? null };
  }

  // ── Consultation ──────────────────────────────────────────────────────────

  private batchView(batch: ImportBatch, pendingItems: number): ImportBatchView {
    return {
      id: batch.id,
      sourceUrl: batch.sourceUrl,
      collectedAt: toIso(batch.collectedAt),
      parserVersion: batch.parserVersion,
      snapshotSha256: batch.snapshotSha256,
      status: batch.status,
      stats: batch.stats as ImportBatchView['stats'],
      error: batch.error,
      createdAt: toIso(batch.createdAt),
      pendingItems,
    };
  }

  async getBatch(id: string): Promise<ImportBatchView> {
    const batch = await this.prisma.importBatch.findUnique({ where: { id } });
    if (!batch) throw notFound('Lot d’import');
    const pending = await this.prisma.importItem.count({ where: { batchId: id, status: 'PENDING_REVIEW' } });
    return this.batchView(batch, pending);
  }

  async listBatches(query: PageQuery): Promise<Page<ImportBatchView>> {
    const [items, total] = await Promise.all([
      this.prisma.importBatch.findMany({ ...pageArgs(query), orderBy: { createdAt: 'desc' }, include: { _count: { select: { items: { where: { status: 'PENDING_REVIEW' } } } } } }),
      this.prisma.importBatch.count(),
    ]);
    return toPage(items.map((b) => this.batchView(b, b._count.items)), total, query);
  }

  private async itemView(item: ImportItem): Promise<ImportItemView> {
    const [duplicate, profile] = await Promise.all([
      item.duplicateOfProfileId ? this.prisma.freelancerProfile.findUnique({ where: { id: item.duplicateOfProfileId }, select: { id: true, headline: true } }) : null,
      item.profileId ? this.prisma.freelancerProfile.findUnique({ where: { id: item.profileId }, select: { importLockedFields: true, userId: true } }) : null,
    ]);
    const pending = item.status === 'PENDING_REVIEW';
    return {
      id: item.id,
      batchId: item.batchId,
      externalKey: item.externalKey,
      fingerprint: item.fingerprint,
      change: item.change,
      status: item.status,
      parsed: item.parsed as unknown as ParsedProfile,
      rawText: item.rawText,
      warnings: item.warnings,
      duplicateOf: duplicate ? { profileId: duplicate.id, headline: duplicate.headline, score: item.duplicateScore ?? 0 } : null,
      profileId: item.profileId,
      lockedFields: profile?.importLockedFields ?? [],
      reviewNote: item.reviewNote,
      reviewedAt: toIso(item.reviewedAt),
      actions: visibleActions([
        check('approve', [
          [pending, 'Élément déjà traité'],
          [!profile?.userId, 'Profil rattaché à un compte : son contenu est géré par le freelance'],
        ]),
        check('ignore', [[pending, 'Élément déjà traité']]),
        check('markDuplicate', [[pending, 'Élément déjà traité']]),
      ]),
    };
  }

  async listItems(batchId: string, query: ImportItemListQuery): Promise<Page<ImportItemView>> {
    const where: Prisma.ImportItemWhereInput = { batchId, ...(query.status ? { status: query.status } : {}) };
    const [items, total] = await Promise.all([
      this.prisma.importItem.findMany({ where, ...pageArgs(query), orderBy: { createdAt: 'asc' } }),
      this.prisma.importItem.count({ where }),
    ]);
    return toPage(await Promise.all(items.map((i) => this.itemView(i))), total, query);
  }

  async getItem(id: string): Promise<ImportItemView> {
    const item = await this.prisma.importItem.findUnique({ where: { id } });
    if (!item) throw notFound('Élément d’import');
    return this.itemView(item);
  }

  // ── Validation manuelle ───────────────────────────────────────────────────

  async review(actor: AuditActor, itemId: string, input: ReviewImportItemInput): Promise<ImportItemView> {
    const item = await this.prisma.importItem.findUnique({ where: { id: itemId }, include: { batch: true } });
    if (!item) throw notFound('Élément d’import');
    if (item.status !== 'PENDING_REVIEW') throw conflict('Élément déjà traité.');
    const reviewer = 'userId' in actor ? actor.userId : null;
    await this.prisma.$transaction(async (tx) => {
      if (input.decision === 'IGNORE') {
        await tx.importItem.update({ where: { id: itemId }, data: { status: 'IGNORED', reviewNote: input.note, reviewedAt: new Date(), reviewedById: reviewer } });
      } else if (input.decision === 'DUPLICATE') {
        const target = input.profileId ?? item.duplicateOfProfileId;
        if (!target) throw conflict('Indiquez le profil existant correspondant.');
        await tx.freelancerProfile.findUniqueOrThrow({ where: { id: target } });
        await tx.importItem.update({
          where: { id: itemId },
          data: { status: 'DUPLICATE', duplicateOfProfileId: target, reviewNote: input.note, reviewedAt: new Date(), reviewedById: reviewer },
        });
      } else {
        const profileId = await this.apply(tx, item, input.profileId ?? null);
        await tx.importItem.update({ where: { id: itemId }, data: { status: 'APPROVED', profileId, reviewNote: input.note, reviewedAt: new Date(), reviewedById: reviewer } });
      }
      const remaining = await tx.importItem.count({ where: { batchId: item.batchId, status: 'PENDING_REVIEW' } });
      if (remaining === 0) await tx.importBatch.update({ where: { id: item.batchId }, data: { status: 'COMPLETED' } });
      await this.audit.record(tx, actor, {
        action: `import.item_${input.decision.toLowerCase()}`,
        entityType: 'ImportItem',
        entityId: itemId,
        reason: input.note,
        metadata: { batchId: item.batchId, externalKey: item.externalKey, profileId: input.profileId },
      });
    });
    return this.getItem(itemId);
  }

  /** Crée ou met à jour le profil historique ; les champs corrigés par un humain ne sont jamais écrasés. */
  private async apply(tx: Db, item: ImportItem & { batch: ImportBatch }, targetId: string | null): Promise<string> {
    const parsed = item.parsed as unknown as ParsedProfile;
    const existing = targetId
      ? await tx.freelancerProfile.findUnique({ where: { id: targetId } })
      : await tx.freelancerProfile.findUnique({ where: { sourceExternalKey: item.externalKey } });
    if (targetId && !existing) throw notFound('Profil');
    if (existing?.userId) throw conflict('Ce profil est rattaché à un compte : son contenu est désormais géré par le freelance. Ignorez cet élément.');
    if (existing && existing.origin !== 'IMPORTED') throw conflict('Seul un profil historique importé peut recevoir un import.');

    const summary = parsed.summary ?? parsed.tagline;
    const toConfirm = new Set(ALWAYS_TO_CONFIRM);
    if (!parsed.summary && parsed.tagline) toConfirm.add('summary');
    const general = { headline: parsed.headline, summary, yearsOfExperience: yearsFrom(parsed) };
    const locked = new Set(existing?.importLockedFields ?? []);

    let profileId: string;
    if (!existing) {
      const created = await tx.freelancerProfile.create({
        data: {
          origin: 'IMPORTED',
          ...general,
          sourceUrl: item.batch.sourceUrl,
          sourceCollectedAt: item.batch.collectedAt,
          sourceExternalKey: item.externalKey,
          fieldsToConfirm: [...toConfirm],
          validationStatus: 'DRAFT',
          catalogVisibility: 'PRIVATE',
        },
      });
      profileId = created.id;
    } else {
      profileId = existing.id;
      const data: Record<string, unknown> = { sourceCollectedAt: item.batch.collectedAt, sourceUrl: item.batch.sourceUrl };
      if (!existing.sourceExternalKey) data.sourceExternalKey = item.externalKey;
      for (const field of GENERAL_FIELDS) if (!locked.has(field)) data[field] = general[field];
      await tx.freelancerProfile.update({ where: { id: profileId }, data });
    }

    const replace = (section: (typeof SECTION_FIELDS)[number]) => !existing || !locked.has(section);
    if (replace('skills')) {
      await tx.freelancerSkill.deleteMany({ where: { profileId } });
      const ids = await this.skills.resolve(tx, parsed.skills);
      const seen = new Set<string>();
      for (const skill of parsed.skills) {
        const skillId = ids.get(slugify(skill.name));
        if (!skillId || seen.has(skillId)) continue;
        seen.add(skillId);
        await tx.freelancerSkill.create({ data: { profileId, skillId } });
      }
    }
    if (replace('experiences')) {
      await tx.experience.deleteMany({ where: { profileId } });
      await tx.experience.createMany({
        data: parsed.experiences.map((e, position) => ({
          profileId,
          position,
          title: e.title,
          organization: e.organization,
          periodLabel: e.periodLabel,
          startYear: e.startYear,
          startMonth: e.startMonth,
          endYear: e.endYear,
          endMonth: e.endMonth,
          isCurrent: e.isCurrent,
          description: e.description,
        })),
      });
    }
    if (replace('educations')) {
      await tx.education.deleteMany({ where: { profileId } });
      await tx.education.createMany({
        data: parsed.educations.map((e, position) => ({ profileId, position, title: e.title, institution: e.institution, periodLabel: e.periodLabel, year: e.year })),
      });
    }
    if (replace('languages')) {
      await tx.language.deleteMany({ where: { profileId } });
      await tx.language.createMany({ data: parsed.languages.map((l, position) => ({ profileId, position, name: l.name, level: l.level })) });
    }
    this.logger.log(`Profil historique ${existing ? 'mis à jour' : 'créé'} (${item.externalKey})`);
    return profileId;
  }
}
