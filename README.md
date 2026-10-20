# Plateforme Freelance E-MPGT — V1

Plateforme B2B de mise en relation entre **freelances du BTP** et **entreprises** qui leur confient des
missions, supervisée par l'administration E-MPGT : inscription et vérifications, missions validées,
candidatures et sélection, propositions commerciales, contrats figés et avenants, CRA, factures déposées et
suivi manuel des règlements, documents privés, notifications, import des profils historiques, API
d'intégration préparée pour le Knowledge Graph.

> **Statut** : V1 fonctionnelle et testée en local. **Non validée pour la production** : décisions métier
> ouvertes (`docs/decisions.md`), recette utilisateur, revue de sécurité et hébergement restent à faire
> (`docs/operations.md`, « Avant la production »). Rien n'a été déployé.

## Démarrage local (développement)

Prérequis : Node.js ≥ 24.15, pnpm 11 (`corepack enable`), Docker (Compose v2).

```bash
pnpm install                         # dépendances verrouillées (pnpm-lock.yaml)
node scripts/generate-env.mjs        # crée .env avec des secrets aléatoires (développement)
pnpm infra:up                        # PostgreSQL :5440, stockage S3 :8333, Mailpit :8025 (127.0.0.1)
pnpm db:deploy                       # applique les migrations versionnées
pnpm dev                             # API http://localhost:4000, frontend http://localhost:3000
```

Compte d'administration (aucun mot de passe versionné ; lien à usage unique valable 1 h) :

```bash
pnpm admin:create -- --email emmanuel@exemple.test --first-name Emmanuel --last-name Admin
```

Données de démonstration **fictives** (facultatif, refusé en production, identifiants affichés une fois) :

```bash
pnpm db:seed:demo
```

E-mails envoyés (vérifications, invitations, notifications) : http://localhost:8025 (Mailpit).
Documentation OpenAPI : http://localhost:4000/api/docs.

## Pile complète en conteneurs

```bash
node scripts/generate-env.mjs        # ou cp .env.example .env puis renseigner les secrets
# Essai local (http://localhost:8080, e-mails dans Mailpit http://localhost:8026)
docker compose -f docker/compose.yml -f docker/compose.local.yml --env-file .env up -d --build
# Production (HTTPS automatique avec SITE_ADDRESS=<domaine>, APP_ENV=production, SMTP réel)
docker compose -f docker/compose.yml --env-file .env up -d --build
docker compose -f docker/compose.yml --env-file .env exec api \
  node dist/cli/create-admin.js --email <adresse> --first-name Emmanuel --last-name <Nom>
```

Essai local en conteneurs uniquement : compte d'administration et jeu de démonstration fictif (le jeu reste
refusé dès que `APP_ENV=production`, valeur par défaut de `docker/compose.yml` seul) :

```bash
DC="docker compose -f docker/compose.yml -f docker/compose.local.yml --env-file .env"
$DC exec api node dist/cli/create-admin.js --email emmanuel@exemple.test --first-name Emmanuel --last-name Admin
$DC run --rm -e NODE_ENV=development api node dist/cli/seed-demo.js      # affiche les identifiants fictifs
```

Les liens de ces commandes pointent vers `APP_ORIGIN` (http://localhost:8080).

PostgreSQL et le stockage ne publient aucun port ; les migrations s'appliquent automatiquement avant l'API.
Sauvegarde : `bash scripts/backup.sh` ; restauration : `bash scripts/restore.sh <dossier> <horodatage>`.

## Vérifications

```bash
pnpm typecheck                        # TypeScript : contrats, API (parité des énumérations), frontend
pnpm lint                             # oxlint (API, contrats), ESLint Next.js (frontend)
pnpm test                             # tests unitaires (calculs, arrondis, analyseur d'import)
pnpm test:e2e                         # API de bout en bout sur une base empgt_test recréée et migrée à vide
pnpm --filter @empgt/web build        # build de production Next.js
pnpm test:ui                          # Playwright : toutes les pages par rôle, sur une instance démarrée
```

`pnpm test:ui` nécessite une instance en marche (`E2E_BASE_URL`, défaut http://localhost:3000) et les
identifiants `E2E_ADMIN_EMAIL/PASSWORD`, `E2E_COMPANY_EMAIL/PASSWORD`, `E2E_FREELANCER_EMAIL/PASSWORD`
(par exemple ceux affichés par `pnpm db:seed:demo`), et `npx playwright install chromium` une fois.

## Structure

```
apps/api            API NestJS 12, Prisma 7 (schéma, migrations, triggers d'intégrité), commandes d'exploitation
apps/web            Frontend Next.js 16 : pages publiques, espaces entreprise / freelance / administration
packages/contracts  Schémas Zod, énumérations, libellés français et types partagés API ↔ frontend
docker/             Dockerfile multi-cible, Compose (dev, production, surcharge locale), Caddy, SeaweedFS
e2e/                Parcours Playwright de l'interface
scripts/            Génération du .env, sauvegarde, restauration
docs/               Documentation (ci-dessous)
```

## Documentation

| Document | Contenu |
|---|---|
| [docs/architecture.md](docs/architecture.md) | Architecture, données, intégrité, sécurité |
| [docs/permissions.md](docs/permissions.md) | Rôles, matrice de visibilité, documents, interventions administratives |
| [docs/workflows.md](docs/workflows.md) | Politique de validation V1, machines à états, cas particuliers |
| [docs/finance.md](docs/finance.md) | Commission, calculs et arrondis, factures, règlements, prestataire de paiement |
| [docs/api.md](docs/api.md) | Conventions de l'API, API d'intégration Knowledge Graph |
| [docs/import.md](docs/import.md) | Procédure d'import des profils historiques |
| [docs/operations.md](docs/operations.md) | Déploiement, migrations, compte administrateur, sauvegarde et restauration |
| [docs/decisions.md](docs/decisions.md) | Registre des décisions attendues d'Emmanuel |
| [docs/demo-scenario.md](docs/demo-scenario.md) | Scénario de démonstration et de recette |
| [docs/sources.md](docs/sources.md) | Sources consultées (dont source inaccessible) |
| [docs/brand/PROVENANCE.md](docs/brand/PROVENANCE.md) | Provenance du logo |
| [apps/web/CONVENTIONS.md](apps/web/CONVENTIONS.md) | Conventions du frontend et liste des routes API par espace |

Les documents de cadrage d'origine (`CAHIER_DES_CHARGES.*`, `SCHEMA_ARCHITECTURE.*`, `ARCHITECTURE.*`) sont
conservés à la racine ; la consigne V1 du 19/10/2026 les remplace lorsqu'ils divergent (voir `docs/sources.md`).
