import { createHash } from 'node:crypto';
import type { Readable } from 'node:stream';
import { Injectable } from '@nestjs/common';
import type {
  DocumentKind,
  DocumentListQuery,
  DocumentVerificationStatus,
  DocumentView,
  DocumentVisibility,
  Page,
  UploadDocumentInput,
  VerifyDocumentInput,
} from '@empgt/contracts';
import { HttpException, HttpStatus } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { allow, check, visibleActions } from '../../common/actions.js';
import { addDays, parseOptionalIsoDate, today, toIso, toIsoDate } from '../../common/dates.js';
import { badRequest, conflict, forbidden, notFound } from '../../common/errors.js';
import { pageArgs, toPage } from '../../common/pagination.js';
import { PrismaService, type Db } from '../../common/prisma.service.js';
import { fullName } from '../../common/text.js';
import { isCompanyMember, ownsProfile, type Actor } from '../auth/actor.js';
import { AuditService, type AuditActor } from '../core/audit.service.js';
import { allowedTypesFor, safeFilename, sniffMimeType } from '../core/file-validation.js';
import { NotificationService } from '../core/notification.service.js';
import { StorageService } from '../core/storage.service.js';
import { env } from '../../config/env.js';
import { canReadDocument, documentAccessWhere } from './document.access.js';

export interface UploadedFile {
  buffer: Buffer;
  originalname: string;
  size: number;
}

export interface StoreInput {
  file: UploadedFile;
  kind: DocumentKind;
  title?: string | null;
  visibility: DocumentVisibility;
  uploadedById: string | null;
  verificationStatus?: DocumentVerificationStatus;
  expiresAt?: Date | null;
  links: Partial<Record<'profileId' | 'companyId' | 'missionId' | 'contractId' | 'invoiceId' | 'qualificationId' | 'timesheetId' | 'importBatchId', string | null>>;
}

/** Documents nécessitant une vérification par E-MPGT (avec échéance éventuelle). */
const VERIFIED_KINDS = new Set<DocumentKind>(['IDENTITY', 'INSURANCE', 'COMPANY_REGISTRATION', 'TAX_SOCIAL_CERTIFICATE', 'QUALIFICATION_CERTIFICATE']);

const PROFILE_KINDS = new Set<DocumentKind>(['CV', 'IDENTITY', 'INSURANCE', 'TAX_SOCIAL_CERTIFICATE', 'QUALIFICATION_CERTIFICATE', 'OTHER']);
const COMPANY_KINDS = new Set<DocumentKind>(['COMPANY_REGISTRATION', 'INSURANCE', 'TAX_SOCIAL_CERTIFICATE', 'OTHER']);
/** Pièces probantes : jamais supprimables par un utilisateur. */
const EVIDENCE_KINDS = new Set<DocumentKind>(['SIGNED_CONTRACT', 'SIGNED_AMENDMENT', 'INVOICE', 'PAYMENT_PROOF', 'IMPORT_SNAPSHOT']);

const documentInclude = {
  contract: { select: { companyId: true, profileId: true } },
  uploadedBy: { select: { firstName: true, lastName: true } },
} satisfies Prisma.DocumentInclude;

type DocumentFull = Prisma.DocumentGetPayload<{ include: typeof documentInclude }>;

@Injectable()
export class DocumentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
  ) {}

  // ── Contrôle et stockage ──────────────────────────────────────────────────

  /** Vérifie taille et type réel ; renvoie le type MIME détecté. */
  validateFile(file: UploadedFile | undefined, kind: DocumentKind): string {
    if (!file || !file.buffer?.length) throw badRequest('Aucun fichier reçu.');
    const max = env().UPLOAD_MAX_MB * 1024 * 1024;
    if (file.size > max) throw new HttpException(`Fichier trop volumineux (${env().UPLOAD_MAX_MB} Mo maximum).`, HttpStatus.PAYLOAD_TOO_LARGE);
    const mime = sniffMimeType(file.buffer);
    const allowed = allowedTypesFor(kind);
    if (!mime || !allowed.includes(mime)) {
      throw new HttpException(
        `Type de fichier non accepté pour ce document. Formats autorisés : ${allowed.map((t) => t.split('/')[1]!.replace('vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx')).join(', ')}.`,
        HttpStatus.UNSUPPORTED_MEDIA_TYPE,
      );
    }
    return mime;
  }

  /**
   * Stocke le fichier dans le stockage privé puis enregistre ses métadonnées.
   * Le dépôt binaire précède l'écriture en base : un échec de transaction laisse au pire
   * un objet orphelin, jamais une ligne pointant vers un fichier absent.
   */
  async store(db: Db, input: StoreInput): Promise<{ id: string }> {
    const mimeType = this.validateFile(input.file, input.kind);
    const sha256 = createHash('sha256').update(input.file.buffer).digest('hex');
    const storageKey = this.storage.newKey();
    await this.storage.put(storageKey, input.file.buffer, mimeType);
    return db.document.create({
      data: {
        kind: input.kind,
        title: input.title ?? null,
        originalFilename: safeFilename(input.file.originalname || 'document', mimeType),
        mimeType,
        sizeBytes: input.file.size,
        sha256,
        storageKey,
        visibility: input.visibility,
        uploadedById: input.uploadedById,
        verificationStatus: input.verificationStatus ?? (VERIFIED_KINDS.has(input.kind) ? 'PENDING' : 'NOT_REQUIRED'),
        expiresAt: input.expiresAt ?? null,
        ...input.links,
      },
      select: { id: true },
    });
  }

  /** Fichier produit par le système (instantané d'import…) : interne, jamais servi en ligne. */
  async storeSystemFile(
    db: Db,
    input: { buffer: Buffer; mimeType: string; filename: string; kind: DocumentKind; title: string; links: StoreInput['links'] },
  ): Promise<{ id: string }> {
    const storageKey = this.storage.newKey('system');
    await this.storage.put(storageKey, input.buffer, input.mimeType);
    return db.document.create({
      data: {
        kind: input.kind,
        title: input.title,
        originalFilename: input.filename,
        mimeType: input.mimeType,
        sizeBytes: input.buffer.length,
        sha256: createHash('sha256').update(input.buffer).digest('hex'),
        storageKey,
        visibility: 'ADMIN_ONLY',
        uploadedById: null,
        verificationStatus: 'NOT_REQUIRED',
        ...input.links,
      },
      select: { id: true },
    });
  }

  // ── Dépôt par un utilisateur ──────────────────────────────────────────────

  async upload(actor: Actor, file: UploadedFile | undefined, input: UploadDocumentInput): Promise<DocumentView> {
    const target = await this.resolveTarget(actor, input);
    const expiresAt = parseOptionalIsoDate(input.expiresAt);
    const id = await this.prisma.$transaction(async (tx) => {
      const doc = await this.store(tx, {
        file: file as UploadedFile,
        kind: input.kind,
        title: input.title,
        visibility: target.visibility,
        uploadedById: actor.userId,
        expiresAt,
        links: target.links,
      });
      if (input.target === 'qualification') {
        await tx.qualification.update({ where: { id: input.targetId }, data: { status: 'PENDING_VERIFICATION' } });
      }
      await this.audit.record(tx, actor, {
        action: 'document.upload',
        entityType: 'Document',
        entityId: doc.id,
        metadata: { kind: input.kind, target: input.target, targetId: input.targetId },
      });
      if (VERIFIED_KINDS.has(input.kind)) {
        await this.notifications.notifyAdmins(tx, {
          type: 'document.to_verify',
          title: 'Document à vérifier',
          body: `Un document (${input.kind}) a été déposé et attend une vérification.`,
          link: `/admin/documents?verificationStatus=PENDING`,
        });
      }
      return doc.id;
    });
    return this.get(actor, id);
  }

  private async resolveTarget(
    actor: Actor,
    input: UploadDocumentInput,
  ): Promise<{ visibility: DocumentVisibility; links: StoreInput['links'] }> {
    const kind = input.kind;
    switch (input.target) {
      case 'profile': {
        if (!actor.isAdmin && !ownsProfile(actor, input.targetId)) throw notFound('Profil');
        if (!PROFILE_KINDS.has(kind)) throw badRequest('Type de document non prévu pour un profil.');
        await this.prisma.freelancerProfile.findUniqueOrThrow({ where: { id: input.targetId } });
        return { visibility: 'OWNER_AND_ADMIN', links: { profileId: input.targetId } };
      }
      case 'qualification': {
        const q = await this.prisma.qualification.findUnique({ where: { id: input.targetId } });
        if (!q || (!actor.isAdmin && !ownsProfile(actor, q.profileId))) throw notFound('Qualification');
        if (kind !== 'QUALIFICATION_CERTIFICATE') throw badRequest('Seul un justificatif de qualification peut être rattaché ici.');
        return { visibility: 'OWNER_AND_ADMIN', links: { profileId: q.profileId, qualificationId: q.id } };
      }
      case 'company': {
        if (!actor.isAdmin && !isCompanyMember(actor, input.targetId)) throw notFound('Entreprise');
        if (!COMPANY_KINDS.has(kind)) throw badRequest('Type de document non prévu pour une entreprise.');
        return { visibility: 'COMPANY_AND_ADMIN', links: { companyId: input.targetId } };
      }
      case 'mission': {
        const mission = await this.prisma.mission.findUnique({ where: { id: input.targetId } });
        if (!mission || (!actor.isAdmin && !isCompanyMember(actor, mission.companyId))) throw notFound('Mission');
        if (kind !== 'OTHER') throw badRequest('Seules des pièces jointes « Autre document » se rattachent à une mission.');
        return { visibility: 'COMPANY_AND_ADMIN', links: { missionId: mission.id, companyId: mission.companyId } };
      }
      case 'contract': {
        const contract = await this.prisma.contract.findUnique({ where: { id: input.targetId } });
        if (!contract || (!actor.isAdmin && !isCompanyMember(actor, contract.companyId) && !ownsProfile(actor, contract.profileId))) {
          throw notFound('Contrat');
        }
        if (kind !== 'OTHER' && kind !== 'TIMESHEET_ATTACHMENT') {
          throw badRequest('Contrats signés, factures et justificatifs passent par leurs écrans dédiés.');
        }
        return { visibility: 'CONTRACT_PARTIES', links: { contractId: contract.id } };
      }
      case 'timesheet': {
        const ts = await this.prisma.timesheet.findUnique({ where: { id: input.targetId }, include: { contract: true } });
        if (!ts || (!actor.isAdmin && !ownsProfile(actor, ts.contract.profileId))) throw notFound('CRA');
        if (kind !== 'TIMESHEET_ATTACHMENT') throw badRequest('Seule une pièce jointe de CRA peut être rattachée ici.');
        return { visibility: 'CONTRACT_PARTIES', links: { timesheetId: ts.id, contractId: ts.contractId } };
      }
      default:
        throw badRequest('Cible de rattachement inconnue.');
    }
  }

  // ── Lecture ───────────────────────────────────────────────────────────────

  private async load(documentId: string): Promise<DocumentFull> {
    const doc = await this.prisma.document.findUnique({ where: { id: documentId }, include: documentInclude });
    if (!doc) throw notFound('Document');
    return doc;
  }

  private expiryState(expiresAt: Date | null): DocumentView['expiryState'] {
    if (!expiresAt) return 'none';
    const now = today();
    if (expiresAt < now) return 'expired';
    if (expiresAt <= addDays(now, 30)) return 'expiring';
    return 'valid';
  }

  toView(actor: Actor, doc: DocumentFull): DocumentView {
    const deletable = !EVIDENCE_KINDS.has(doc.kind) && !doc.deletedAt && (actor.isAdmin || doc.uploadedById === actor.userId);
    return {
      id: doc.id,
      kind: doc.kind,
      title: doc.title,
      originalFilename: doc.originalFilename,
      mimeType: doc.mimeType,
      sizeBytes: doc.sizeBytes,
      sha256: doc.sha256,
      visibility: doc.visibility,
      uploadedByName: doc.uploadedBy ? fullName(doc.uploadedBy.firstName, doc.uploadedBy.lastName) : null,
      profileId: doc.profileId,
      companyId: doc.companyId,
      missionId: doc.missionId,
      contractId: doc.contractId,
      invoiceId: doc.invoiceId,
      qualificationId: doc.qualificationId,
      timesheetId: doc.timesheetId,
      verificationStatus: doc.verificationStatus,
      verificationNote: doc.verificationNote,
      verifiedAt: toIso(doc.verifiedAt),
      expiresAt: toIsoDate(doc.expiresAt),
      expiryState: this.expiryState(doc.expiresAt),
      createdAt: toIso(doc.createdAt),
      actions: visibleActions([
        allow('download'),
        check('delete', [[deletable, EVIDENCE_KINDS.has(doc.kind) ? 'Pièce probante : elle ne peut pas être supprimée' : 'Seul le déposant peut supprimer ce document']]),
        ...(actor.isAdmin ? [check('verify', [[doc.verificationStatus !== 'NOT_REQUIRED' || VERIFIED_KINDS.has(doc.kind), 'Aucune vérification requise']])] : []),
      ]),
    };
  }

  async get(actor: Actor, documentId: string): Promise<DocumentView> {
    const doc = await this.load(documentId);
    if (!canReadDocument(actor, doc)) throw notFound('Document');
    return this.toView(actor, doc);
  }

  async list(actor: Actor, query: DocumentListQuery): Promise<Page<DocumentView>> {
    const filters: Prisma.DocumentWhereInput[] = [documentAccessWhere(actor)];
    if (actor.isAdmin) filters.push({ deletedAt: null });
    if (query.kind) filters.push({ kind: query.kind });
    if (query.verificationStatus) filters.push({ verificationStatus: query.verificationStatus });
    if (query.profileId) filters.push({ profileId: query.profileId });
    if (query.companyId) filters.push({ companyId: query.companyId });
    if (query.contractId) filters.push({ contractId: query.contractId });
    if (query.expiringWithinDays !== undefined) filters.push({ expiresAt: { not: null, lte: addDays(today(), query.expiringWithinDays) } });
    if (query.q) {
      filters.push({ OR: [{ title: { contains: query.q, mode: 'insensitive' } }, { originalFilename: { contains: query.q, mode: 'insensitive' } }] });
    }
    const where: Prisma.DocumentWhereInput = { AND: filters };
    const [items, total] = await Promise.all([
      this.prisma.document.findMany({ where, ...pageArgs(query), orderBy: { createdAt: 'desc' }, include: documentInclude }),
      this.prisma.document.count({ where }),
    ]);
    return toPage(items.map((d) => this.toView(actor, d)), total, query);
  }

  /** Téléchargement autorisé : contrôle d'accès, en-têtes sûrs, trace d'audit. */
  async open(actor: Actor | AuditActor, documentId: string, check = true): Promise<{ stream: Readable; mimeType: string; filename: string; size: number }> {
    const doc = await this.load(documentId);
    if (check && 'userId' in actor && !canReadDocument(actor, doc)) throw notFound('Document');
    if (doc.deletedAt && !('userId' in actor && actor.isAdmin)) throw notFound('Document');
    const stream = await this.storage.get(doc.storageKey);
    await this.audit.record(this.prisma, actor, {
      action: 'document.download',
      entityType: 'Document',
      entityId: doc.id,
      metadata: { kind: doc.kind },
    });
    return { stream, mimeType: doc.mimeType, filename: doc.originalFilename, size: doc.sizeBytes };
  }

  // ── Vérification et suppression ───────────────────────────────────────────

  async verify(actor: Actor, documentId: string, input: VerifyDocumentInput): Promise<DocumentView> {
    if (!actor.isAdmin) throw forbidden();
    const doc = await this.load(documentId);
    if (input.status === 'REJECTED' && !input.note) throw conflict('Un motif est obligatoire pour refuser un document.');
    await this.prisma.$transaction(async (tx) => {
      await tx.document.update({
        where: { id: documentId },
        data: {
          verificationStatus: input.status,
          verificationNote: input.note,
          verifiedAt: new Date(),
          verifiedById: actor.userId,
          ...(input.expiresAt ? { expiresAt: parseOptionalIsoDate(input.expiresAt) } : {}),
        },
      });
      if (doc.qualificationId && doc.kind === 'QUALIFICATION_CERTIFICATE') {
        await tx.qualification.update({
          where: { id: doc.qualificationId },
          data: {
            status: input.status === 'VERIFIED' ? 'VERIFIED' : 'REJECTED',
            verifiedAt: new Date(),
            verifiedById: actor.userId,
            verificationNote: input.note,
            ...(input.expiresAt ? { expiresAt: parseOptionalIsoDate(input.expiresAt) } : {}),
          },
        });
      }
      await this.audit.record(tx, actor, {
        action: `admin.document.${input.status.toLowerCase()}`,
        entityType: 'Document',
        entityId: documentId,
        reason: input.note,
      });
      const recipients = doc.uploadedById ? [doc.uploadedById] : [];
      await this.notifications.notifyUsers(tx, recipients, {
        type: 'document.reviewed',
        title: input.status === 'VERIFIED' ? 'Document vérifié' : 'Document refusé',
        body: `Votre document « ${doc.title ?? doc.originalFilename} » a été ${input.status === 'VERIFIED' ? 'vérifié' : `refusé : ${input.note}`}.`,
        link: doc.profileId ? '/freelance/documents' : '/entreprise/documents',
      });
    });
    return this.get(actor, documentId);
  }

  async remove(actor: Actor, documentId: string, reason: string | null): Promise<void> {
    const doc = await this.load(documentId);
    if (!canReadDocument(actor, doc)) throw notFound('Document');
    if (EVIDENCE_KINDS.has(doc.kind)) throw conflict('Pièce probante : elle ne peut pas être supprimée.');
    if (!actor.isAdmin && doc.uploadedById !== actor.userId) throw forbidden('Seul le déposant peut supprimer ce document.');
    if (actor.isAdmin && doc.uploadedById !== actor.userId && !reason) throw conflict('Motif obligatoire pour supprimer le document d’un tiers.');
    await this.prisma.$transaction(async (tx) => {
      await tx.document.update({ where: { id: documentId }, data: { deletedAt: new Date(), deletedById: actor.userId, deleteReason: reason } });
      await this.audit.record(tx, actor, { action: 'document.delete', entityType: 'Document', entityId: documentId, reason, metadata: { kind: doc.kind } });
    });
  }
}
