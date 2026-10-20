#!/usr/bin/env bash
# Sauvegarde de la Plateforme Freelance E-MPGT (déploiement docker/compose.yml).
#
#   scripts/backup.sh [dossier_de_destination]
#
# Produit, horodatés :
#   - db-<date>.dump        : base PostgreSQL au format personnalisé (pg_dump -Fc), cohérente à chaud ;
#   - storage-<date>.tar.gz : volume du stockage S3 (documents), copié pendant une courte pause du service ;
#   - SHA256SUMS-<date>     : empreintes de contrôle.
# Les sauvegardes contiennent des données personnelles : les chiffrer et les stocker hors du serveur.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${1:-$ROOT/backups}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
COMPOSE=(docker compose -f "$ROOT/docker/compose.yml" --env-file "$ROOT/.env")
PROJECT="$("${COMPOSE[@]}" config --format json | sed -n 's/^ *"name": *"\([^"]*\)".*/\1/p' | head -n1)"
mkdir -p "$DEST"

echo "→ Base de données"
"${COMPOSE[@]}" exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc --no-owner' > "$DEST/db-$STAMP.dump"

echo "→ Stockage des documents (pause du service de stockage)"
"${COMPOSE[@]}" stop storage
trap '"${COMPOSE[@]}" start storage >/dev/null' EXIT
docker run --rm -v "${PROJECT}_storagedata:/data:ro" -v "$DEST:/backup" alpine:3.22 \
  tar -czf "/backup/storage-$STAMP.tar.gz" -C /data .
"${COMPOSE[@]}" start storage
trap - EXIT

( cd "$DEST" && sha256sum "db-$STAMP.dump" "storage-$STAMP.tar.gz" > "SHA256SUMS-$STAMP" )
echo "Sauvegarde terminée dans $DEST (horodatage $STAMP)."
