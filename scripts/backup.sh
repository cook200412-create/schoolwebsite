#!/usr/bin/env bash
# Weekly logical backup of the school database (in addition to Atlas continuous/cloud backups).
# Usage: MONGODB_URI="mongodb+srv://..." ./scripts/backup.sh [output-dir]
# Requires MongoDB Database Tools (mongodump). Store the archive encrypted and off-site; test restores quarterly.
set -euo pipefail
: "${MONGODB_URI:?Set MONGODB_URI}"
OUT="${1:-./backups}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$OUT"
mongodump --uri="$MONGODB_URI" --gzip --archive="$OUT/ssv-$STAMP.archive.gz"
# keep the 12 most recent archives
ls -1t "$OUT"/ssv-*.archive.gz | tail -n +13 | xargs -r rm --
echo "Backup written to $OUT/ssv-$STAMP.archive.gz"
# Restore:  mongorestore --uri="$MONGODB_URI" --gzip --archive=<file> --drop
