# Exploitation : déploiement, migrations, compte administrateur, sauvegardes

> Rien n'a été déployé. Ce document décrit la procédure ; il ne vaut pas validation de mise en production
> (voir « Avant la production » ci-dessous).

## Environnements

| | Développement (`pnpm dev`) | Essai local complet | Production |
|---|---|---|---|
| Compose | `docker/compose.dev.yml` (base, stockage, Mailpit seulement) | `docker/compose.yml` + `docker/compose.local.yml` | `docker/compose.yml` |
| Accès | http://localhost:3000 (web), :4000 (API) | http://localhost:8080 | https://<domaine> (Caddy, certificat automatique) |
| Ports publiés | 127.0.0.1 uniquement : 5440, 8333, 1025, 8025 | 127.0.0.1:8080, 127.0.0.1:8026 (Mailpit) | 80, 443 uniquement |
| E-mails | Mailpit | Mailpit | SMTP réel (`SMTP_*`) |
| `APP_ENV` / cookies | development / non sécurisés | staging / non sécurisés | production / `Secure` + `__Host-` |

## Variables d'environnement

Toutes documentées dans `.env.example` (aucun secret réel). `node scripts/generate-env.mjs` crée un `.env`
de développement avec des secrets aléatoires. En production, renseigner au minimum : `APP_ENV=production`,
`APP_ORIGIN=https://…`, `COOKIE_SECURE=true`, `POSTGRES_PASSWORD`, `APP_SECRET` (≥ 32 caractères),
`S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `SMTP_*`, `MAIL_FROM`, `SITE_ADDRESS=<domaine>`. L'API refuse de
démarrer si une valeur d'exemple subsiste ou si les exigences de production ne sont pas remplies.

## Déploiement Docker

```bash
cp .env.example .env            # puis renseigner les secrets (ou node scripts/generate-env.mjs en essai)
docker compose -f docker/compose.yml --env-file .env up -d --build
docker compose -f docker/compose.yml --env-file .env ps        # tous les services « healthy »
```

Ordre garanti par Compose : PostgreSQL et stockage sains → service `migrate` (`prisma migrate deploy`, puis
arrêt) → API saine (`/api/v1/health`) → frontend sain → Caddy. Volumes persistants : `pgdata`,
`storagedata`, `caddydata`, `caddyconfig`. Réseau `backend` interne : base et stockage injoignables
depuis l'extérieur.

Première construction : environ 450 Mo de paquets et les métadonnées de publication de chaque paquet
(contrôle « délai minimal de publication » de pnpm 11, conservé volontairement) sont téléchargés ; sur une
connexion lente, compter plusieurs dizaines de minutes. Les constructions suivantes réutilisent les caches
BuildKit `pnpm-store` et `pnpm-metadata`.

Mise à jour : `git pull`, puis la même commande `up -d --build` (les migrations s'appliquent avant l'API).
Les migrations sont versionnées dans `apps/api/prisma/migrations` ; ne jamais modifier une migration déjà
appliquée : en créer une nouvelle (`pnpm db:migrate` en développement).

## Compte d'administration (Emmanuel)

Aucun identifiant ni mot de passe n'est versionné. Après le premier démarrage :

```bash
docker compose -f docker/compose.yml --env-file .env exec api \
  node dist/cli/create-admin.js --email <adresse> --first-name Emmanuel --last-name <Nom> [--send-email]
```

La commande affiche un lien à usage unique (valable 1 heure) pour définir le mot de passe ; `--send-email`
l'envoie aussi à l'adresse. En développement : `pnpm admin:create -- --email … --first-name … --last-name …`.

## Jeu de démonstration (jamais en production)

Le jeu fictif (`seed-demo`) est refusé si `APP_ENV=production` **ou** `NODE_ENV=production`. Les images
fixent `NODE_ENV=production` ; pour l'essai local en conteneurs (`APP_ENV=staging` via `compose.local.yml`),
lever explicitement la seconde garde pour cette seule commande ponctuelle :

```bash
docker compose -f docker/compose.yml -f docker/compose.local.yml --env-file .env \
  run --rm -e NODE_ENV=development api node dist/cli/seed-demo.js
```

Les comptes créés utilisent le domaine réservé `demo.empgt.invalid` ; leurs mots de passe sont affichés une
seule fois et ne sont enregistrés nulle part.

## Sauvegarde et restauration

```bash
bash scripts/backup.sh [dossier]            # db-<date>.dump (pg_dump -Fc), storage-<date>.tar.gz, SHA256SUMS-<date>
bash scripts/restore.sh <dossier> <date>    # vérifie les empreintes, demande confirmation, remplace base et documents
```

- La base est sauvegardée à chaud (cohérente). Le stockage est copié pendant une courte pause du service de
  stockage (quelques secondes ; les dépôts de documents échouent proprement pendant ce temps).
- Les sauvegardes contiennent des données personnelles : les chiffrer, les copier hors du serveur,
  conserver plusieurs générations, **tester régulièrement une restauration** sur une instance séparée.
- Base et documents doivent être restaurés ensemble (les documents sont référencés par la base).

## Supervision

- Healthchecks Docker sur tous les services ; `GET /api/v1/health` renvoie 503 si la base ou le stockage
  sont indisponibles.
- Journaux : `docker compose logs api` (erreurs inattendues avec identifiant de requête ; pas de contenu de
  requête ni de secret). Le journal d'audit fonctionnel est consultable dans Administration → Audit.

## Ressources et dépannage

Constats de l'essai local du 20/10/2026 (poste Windows 11, 8 Go de RAM, Docker Desktop/WSL plafonné à
3,7 Go, 3 Go libres sur C:) :

- La pile complète consomme environ 700 Mo (API ≈ 450 Mo au démarrage, PostgreSQL ≈ 50 Mo, stockage,
  Mailpit, frontend, Caddy) ; la construction des images demande nettement plus (compilation Next.js).
  Prévoir au moins 4 Go de RAM libres pour Docker et 10 Go d'espace disque sur le volume de Docker.
- Machine saturée : les healthchecks échouent (« timed out starting health check ») et `up` s'arrête sur
  « dependency failed to start ». Libérer de la mémoire (par ex. `docker compose -f docker/compose.dev.yml
  stop` si la pile de développement tourne aussi), puis relancer la même commande `up -d`.
- Moteur Docker figé puis « WSL update required » au redémarrage alors que WSL est à jour : `docker desktop
  stop`, `wsl --shutdown`, `docker desktop start` (aucune donnée supprimée).
- Avertissement `DeprecationWarning: Calling client.query() when the client is already executing a query`
  au démarrage d'une transaction : émis par l'interpréteur de requêtes de Prisma 7.10.1 avec
  `@prisma/adapter-pg` (pile vérifiée, pas par le code applicatif). `pg` 8 met ces requêtes en file sur la
  même connexion : le comportement est correct, mais à revérifier avant toute montée vers `pg` 9.

## Avant la production (non réalisé à ce jour)

- [ ] Décisions D-01 à D-20 traitées (`docs/decisions.md`), informations légales renseignées.
- [ ] Revue de sécurité indépendante et test d'intrusion ; vérification RGPD (registre, durées D-17).
- [ ] Hébergement : sauvegardes chiffrées hors site, supervision, alertes, mises à jour de sécurité.
- [ ] SMTP de production authentifié (SPF, DKIM, DMARC) ; domaine et HTTPS.
- [ ] Recette utilisateur complète par E-MPGT sur un environnement de préproduction.
- [ ] Limitation de débit partagée (Redis…) si plusieurs instances d'API (V1 : une instance, stockage mémoire).
