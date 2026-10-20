# Architecture technique

## Vue d'ensemble

```
Navigateur ──HTTPS──► Caddy (proxy, TLS)
                        ├── /api/*  ──► API NestJS (apps/api) ──► PostgreSQL 18 (réseau interne)
                        │                                   └──► Stockage S3 privé SeaweedFS (réseau interne)
                        │                                   └──► SMTP (e-mails)
                        └── /*      ──► Frontend Next.js (apps/web)
Knowledge Graph (futur) ──► /api/v1/integration (jeton machine, lecture seule, désactivé par défaut)
```

Application **autonome** : son dépôt, sa base, son API, son frontend, son stockage, ses utilisateurs et
permissions, son Compose. Aucune connexion au Knowledge Graph n'est établie ; l'indisponibilité de celui-ci
ne bloque aucun parcours. Le Knowledge Graph n'a aucun accès à PostgreSQL.

## Monorepo (pnpm)

| Paquet | Rôle |
|---|---|
| `packages/contracts` | Énumérations, schémas Zod d'entrée, types des vues, libellés français, DTO d'intégration — **source unique** partagée par l'API (validation) et le frontend (types, libellés) |
| `apps/api` | NestJS 12 (ESM), Prisma 7 (adaptateur `pg`), validation par Standard Schema (Zod 4), OpenAPI généré depuis les mêmes schémas |
| `apps/web` | Next.js 16 (App Router, Cache Components), React 19, Tailwind CSS 4 |
| `docker/` | Image multi-cible, Compose de production, surcharge locale, Caddy, démarrage SeaweedFS |
| `e2e/` | Parcours Playwright de l'interface |

Versions vérifiées le 19/10/2026 et verrouillées (`pnpm-lock.yaml`, versions exactes, délai minimal de
publication pnpm respecté — aucune version publiée depuis moins de 24 h). TypeScript 6.0 (typescript-eslint
n'accepte pas encore TypeScript 7). MinIO Community étant archivé (avril 2026), le stockage S3 local est
SeaweedFS (Apache 2.0).

## API

- Préfixe `/api/v1` ; modules : auth, companies, profiles, missions (+ candidatures), commercial
  (propositions, contrats, avenants, évaluations), activity (CRA, litiges), documents, finance (factures,
  paiements, prestataire, webhooks), dashboard, admin, imports, integration, health.
- **Une fonction de politique par entité** calcule `actions` (possible / motif) et `pending` ; le même
  résultat sert à l'affichage et à l'autorisation (`assertAllowed`) : aucune règle dupliquée côté frontend.
- Transactions : toute opération métier et sa trace d'audit sont atomiques ; sélection de candidat, paiements,
  approbations en isolation **sérialisable** avec nouvel essai automatique.
- Notifications créées dans la transaction ; les e-mails associés partent après validation (répartiteur
  périodique, 3 essais). Les e-mails contenant un jeton (vérification, réinitialisation, invitation) sont
  envoyés directement et le jeton n'est jamais stocké en clair.
- Erreurs normalisées en français `{ statusCode, error, message, details?, requestId }`, sans trace
  technique ; ressources d'autres organisations → 404.

## Données (Prisma, `apps/api/prisma/schema.prisma`)

Identité (User, UserRole, Session, AuthToken, Invitation) · Entreprises (Company, CompanyMembership,
CompanyContact) · Freelances (FreelancerProfile, Skill, FreelancerSkill, Experience, Education, Language,
Qualification, Availability) · Missions (Mission, MissionSkill, Application) · Commercial
(CommercialProposal, Contract, ContractAmendment) · Activité (Timesheet, TimesheetEntry, Dispute) ·
Documents et finance (Document, Invoice, PaymentRecord, PayoutRecord, PaymentConfiguration,
PaymentWebhookEvent) · Suivi (Review, Notification, AuditEvent, PlatformSetting, ContactRequest,
ImportBatch, ImportItem, ReferenceCounter) · Intégration (IntegrationClient, SyncChange).

Identifiants UUID v7, références lisibles (`MIS-2026-0001`, `PRO-…`, `CTR-…`), dates métier en `date`,
montants en `numeric`. Un profil historique peut exister sans utilisateur. Toute donnée entreprise est
rattachée à son organisation.

**Intégrité imposée par la base** (migration `integrity_rules`) :
- index uniques partiels : un candidat retenu par mission, une proposition vivante par candidature, un
  contrat non annulé par mission, un CRA approuvé + un CRA en cours par période, numéros de facture,
  une facture par CRA et par type ;
- contraintes CHECK : heures ∈ ]0 ; 24], TTC = HT + taxes, montants positifs, heures/jour obligatoires si
  unité jour, commission complète, dates ordonnées, e-mails en minuscules… ;
- triggers d'immuabilité : journal d'audit (ajout seul), conditions de contrat, avenants signés, lignes et
  totaux d'un CRA approuvé, factures, paiements (annulation motivée seule), documents (pas de suppression
  physique) ;
- triggers `SyncChange` : journal des changements pour la synchronisation incrémentale (suppressions comprises).

## Sécurité

| Mesure | Mise en œuvre |
|---|---|
| Mots de passe | Argon2id (19 Mio, 2 itérations), 12 caractères minimum |
| Sessions | Jeton opaque 256 bits, seul son SHA-256 est stocké ; cookie `HttpOnly`, `SameSite=Lax`, `Secure` + préfixe `__Host-` en production ; durée absolue (7 j, 12 h pour l'administration) et d'inactivité (24 h) ; révocation à la déconnexion, au changement de mot de passe, à la suspension |
| CSRF | Jeton signé HMAC « double soumission » (cookie HttpOnly + en-tête `X-CSRF-Token`) et contrôle de l'en-tête `Origin` |
| Limitation | 300 req/min/IP global, 10 req/min/IP sur les routes sensibles ; verrouillage du compte 15 min après 5 échecs |
| Énumération | Réponses identiques à l'inscription et au mot de passe oublié ; temps de vérification homogène |
| Validation | Schémas Zod côté serveur sur chaque entrée (champs inconnus ignorés) |
| Fichiers | Type déterminé par signature binaire, taille limitée, stockage privé, téléchargement contrôlé et tracé |
| En-têtes | Helmet (API) ; CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` (web) |
| Journaux | Aucune donnée de requête ni secret journalisé ; adresses e-mail masquées ; IP de session tronquée (/24) |
| Secrets | Variables d'environnement uniquement ; `.env` hors dépôt ; refus de démarrer avec des valeurs d'exemple ; contrôles renforcés en production (HTTPS, cookies sécurisés, pas de stockage mémoire) |
| SSRF | Collecte d'import limitée aux hôtes autorisés en HTTPS |
| Réseau | PostgreSQL et stockage sur un réseau Docker interne, aucun port publié en production |

## Frontend

Pages privées en composants client : la session est lue via `/auth/me` ; la sécurité reste côté API.
Pages publiques prérendues. Composants accessibles (libellés reliés, `aria-*`, focus visible, `<dialog>`
natif, tableaux réactifs, navigation clavier, lien d'évitement). Libellés et types issus de
`@empgt/contracts`. Voir `apps/web/CONVENTIONS.md`.

## Hors périmètre V1 (différé, signalé dans l'interface)

Messagerie temps réel, matching par IA, import LinkedIn, signature électronique intégrée, paiements
automatisés réels, génération de factures et de contrats, refonte graphique avancée, gestion multi-organisation
par utilisateur, synchronisation réelle avec le Knowledge Graph.
