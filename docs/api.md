# API

- Base : `/api/v1` (même origine que le frontend). Santé : `GET /api/v1/health` (base + stockage).
- Documentation interactive : `/api/docs` et JSON `/api/docs-json` quand `OPENAPI_ENABLED=true`
  (désactivée par défaut en production). Export statique : `pnpm --filter @empgt/api openapi:export`
  → `docs/openapi.json`. Les schémas d'entrée OpenAPI sont générés depuis les schémas Zod qui valident
  réellement les requêtes.

## Conventions

| Sujet | Règle |
|---|---|
| Authentification | Cookie de session HttpOnly (`POST /auth/login`) |
| CSRF | En-tête `X-CSRF-Token` obligatoire sur POST/PUT/PATCH/DELETE (jeton via `GET /auth/csrf` ou `GET /auth/me`) |
| Dates | `AAAA-MM-JJ` ; horodatages ISO 8601 UTC |
| Montants | Chaînes décimales (`"1250.50"`), jamais de nombres flottants |
| Listes | `{ items, total, page, pageSize }`, paramètres `page`, `pageSize` (≤ 100), `q` + filtres |
| Autorisations | Chaque vue contient `actions: [{ action, allowed, reason? }]` et `pending: [{ code, title, description, severity, link? }]` |
| Erreurs | `{ statusCode, error, message, details?, requestId }` en français. 400 validation, 401 session, 403 rôle/CSRF, 404 introuvable ou hors périmètre, 409 règle métier (motif explicite), 413 fichier trop gros, 415 type refusé, 429 limitation, 503 fonction désactivée (décision attendue) |
| Requêtes | En-tête `X-Request-Id` repris ou généré, renvoyé et stocké dans l'audit |

La liste détaillée des routes figure dans `apps/web/CONVENTIONS.md` (par espace) et dans la spécification
OpenAPI.

## API d'intégration (Knowledge Graph)

Lecture seule, **désactivée par défaut** (décision D-16), aucune synchronisation réelle à ce stade.

- Authentification : `Authorization: Bearer empgt_int_<préfixe>_<secret>` ; jeton créé et révoqué par E-MPGT
  (Administration → Intégration), affiché une seule fois, stocké haché, expiration facultative.
- Autorisation : domaine accordé au client **et** activé dans les paramètres (`integrationEnabledScopes`).
- Domaines : `freelancers`, `skills`, `availabilities`, `missions`, `applications`, `contracts`, `costs`
  (CRA validés, montants figés), `reviews`, `documents` (métadonnées uniquement), `changes`.
- Pagination par curseur opaque (`cursor`, `limit` ≤ 200) ordonnée par `(updatedAt, id)` ; synchronisation
  incrémentale par `updatedSince` ou en poursuivant le curseur.
- `GET /integration/changes` : flux ordonné (séquence) alimenté par triggers, opérations `UPSERT`, `DELETE`,
  `WITHDRAWN` (retrait de partage : profil suspendu, consentement retiré, statut non partageable…).
- DTO distincts des modèles internes, appliqués par schéma à chaque réponse (champ non déclaré retiré).
  Jamais exposés : mots de passe, e-mails, téléphones, coordonnées bancaires, pièces d'identité, contenu de
  documents, notes internes, tarifs indicatifs, messages de candidature, données de démonstration.
- Tests de contrat : `apps/api/test/integration.e2e-spec.ts` (schémas stricts, absence de champs sensibles,
  curseurs, retraits, révocation).
