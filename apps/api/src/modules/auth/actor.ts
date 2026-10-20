import type { CompanyRole, RoleCode } from '@empgt/contracts';

/** Utilisateur authentifié tel que vu par les règles d'autorisation. */
export interface Actor {
  userId: string;
  sessionId: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: RoleCode[];
  isAdmin: boolean;
  isCompany: boolean;
  isFreelancer: boolean;
  /** V1 : une organisation active au plus par utilisateur entreprise. */
  companyId: string | null;
  companyRole: CompanyRole | null;
  profileId: string | null;
}

export function isCompanyMember(actor: Actor, companyId: string): boolean {
  return actor.isCompany && actor.companyId === companyId;
}

export function isCompanyOwner(actor: Actor, companyId: string): boolean {
  return isCompanyMember(actor, companyId) && actor.companyRole === 'OWNER';
}

export function ownsProfile(actor: Actor, profileId: string): boolean {
  return actor.isFreelancer && actor.profileId === profileId;
}

/** Identité minimale enregistrée dans le journal d'audit. */
export function auditActor(actor: Actor | null) {
  return actor
    ? { actorType: 'USER' as const, actorUserId: actor.userId, actorRoles: actor.roles }
    : { actorType: 'SYSTEM' as const, actorUserId: null, actorRoles: [] };
}
