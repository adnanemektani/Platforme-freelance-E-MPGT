#!/bin/sh
# Démarre SeaweedFS en mode « mini » (stockage objet compatible S3, mono-nœud).
# Les identifiants S3 sont générés à partir des variables d'environnement :
# aucun secret n'est stocké dans le dépôt.
set -eu

: "${S3_ACCESS_KEY_ID:?S3_ACCESS_KEY_ID est obligatoire}"
: "${S3_SECRET_ACCESS_KEY:?S3_SECRET_ACCESS_KEY est obligatoire}"
: "${S3_BUCKET:=empgt-documents}"

CONFIG=/tmp/empgt-s3.json
cat > "$CONFIG" <<EOF
{
  "identities": [
    {
      "name": "empgt-api",
      "credentials": [
        { "accessKey": "${S3_ACCESS_KEY_ID}", "secretKey": "${S3_SECRET_ACCESS_KEY}" }
      ],
      "actions": ["Read", "Write", "List", "Tagging", "Admin"]
    }
  ]
}
EOF
chmod 640 "$CONFIG"
chown seaweed:seaweed "$CONFIG" 2>/dev/null || true

# Interfaces annexes (WebDAV, console d'administration, Iceberg, Lance) désactivées :
# seul le point d'accès S3 est utile, et il n'est jamais exposé publiquement en production.
exec /entrypoint.sh mini \
  -dir=/data \
  -s3.config="$CONFIG" \
  -bucket="$S3_BUCKET" \
  -webdav=false \
  -admin.ui=false \
  -s3.port.iceberg=0 \
  -s3.port.lance=0
