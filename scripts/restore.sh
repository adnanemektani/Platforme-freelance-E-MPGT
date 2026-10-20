#!/usr/bin/env bash
# Restauration d'une sauvegarde produite par scripts/backup.sh.
#
#   scripts/restore.sh <dossier> <horodatage>      ex. scripts/restore.sh backups 20261019T180000Z
#
# ATTENTION : remplace intégralement la base et les documents de l'instance ciblée.
# Procédure : arrêt de l'API et du frontend, contrôle des empreintes, restauration de la base
# (dans une base recréée à vide), restauration du volume de stockage, redémarrage.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIR="${1:?Dossier de sauvegarde requis}"
STAMP="${2:?Horodatage requis (ex. 20261019T180000Z)}"
COMPOSE=(docker compose -f "$ROOT/docker/compose.yml" --env-file "$ROOT/.env")
PROJECT="$("${COMPOSE[@]}" config --format json | sed -n 's/^ *"name": *"\([^"]*\)".*/\1/p' | head -n1)"

( cd "$DIR" && sha256sum -c "SHA256SUMS-$STAMP" )

read -r -p "Restaurer $STAMP sur le projet « $PROJECT » ? Les données actuelles seront remplacées. Tapez RESTAURER : " answer
[ "$answer" = "RESTAURER" ] || { echo "Abandon."; exit 1; }

"${COMPOSE[@]}" stop caddy web api
"${COMPOSE[@]}" up -d postgres

echo "→ Base de données"
"${COMPOSE[@]}" exec -T postgres sh -c 'dropdb -U "$POSTGRES_USER" --if-exists --force "$POSTGRES_DB" && createdb -U "$POSTGRES_USER" "$POSTGRES_DB"'
"${COMPOSE[@]}" exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --exit-on-error' < "$DIR/db-$STAMP.dump"

echo "→ Stockage des documents"
"${COMPOSE[@]}" stop storage
docker run --rm -v "${PROJECT}_storagedata:/data" -v "$(cd "$DIR" && pwd):/backup:ro" alpine:3.22 \
  sh -c "rm -rf /data/* /data/.[!.]* 2>/dev/null; tar -xzf /backup/storage-$STAMP.tar.gz -C /data"

"${COMPOSE[@]}" up -d
echo "Restauration terminée. Vérifiez /api/v1/health puis connectez-vous."
