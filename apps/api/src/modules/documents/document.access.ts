import type { Contract, Document, Prisma } from '../../generated/prisma/client.js';
import type { Actor } from '../auth/actor.js';

// Règles de visibilité des documents (une seule définition, utilisée pour les listes et les accès unitaires).
//
// - OWNER_AND_ADMIN   : déposant ; freelance du profil rattaché ; E-MPGT.
// - COMPANY_AND_ADMIN : membres de l'entreprise rattachée ; déposant ; E-MPGT.
// - CONTRACT_PARTIES  : entreprise et freelance du contrat rattaché ; E-MPGT.
// - ADMIN_ONLY        : E-MPGT uniquement.
// Un client ne voit donc jamais automatiquement les documents de profil d'un freelance.

const NONE = '00000000-0000-0000-0000-000000000000';

export function documentAccessWhere(actor: Actor): Prisma.DocumentWhereInput {
  if (actor.isAdmin) return {};
  const profileId = actor.profileId ?? NONE;
  const companyId = actor.companyId ?? NONE;
  return {
    deletedAt: null,
    OR: [
      { visibility: 'OWNER_AND_ADMIN', OR: [{ uploadedById: actor.userId }, { profileId }] },
      { visibility: 'COMPANY_AND_ADMIN', OR: [{ companyId }, { uploadedById: actor.userId }] },
      { visibility: 'CONTRACT_PARTIES', contract: { OR: [{ companyId }, { profileId }] } },
    ],
  };
}

export function canReadDocument(actor: Actor, doc: Document & { contract?: Pick<Contract, 'companyId' | 'profileId'> | null }): boolean {
  if (actor.isAdmin) return true;
  if (doc.deletedAt) return false;
  switch (doc.visibility) {
    case 'OWNER_AND_ADMIN':
      return doc.uploadedById === actor.userId || (Boolean(actor.profileId) && doc.profileId === actor.profileId);
    case 'COMPANY_AND_ADMIN':
      return (Boolean(actor.companyId) && doc.companyId === actor.companyId) || doc.uploadedById === actor.userId;
    case 'CONTRACT_PARTIES':
      return Boolean(
        doc.contract &&
          ((actor.companyId && doc.contract.companyId === actor.companyId) || (actor.profileId && doc.contract.profileId === actor.profileId)),
      );
    default:
      return false;
  }
}
