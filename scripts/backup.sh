#!/usr/bin/env bash
#
# Daily Postgres backup for naga-jaya-v2.
# Reads DATABASE_URL from apps/api/.env unless already set in env.
# Writes gzipped pg_dump to $BACKUP_DIR (default: ./backups).
# Rotates: keeps last $RETENTION_DAYS files (default: 14).
#
# Install (run on the server laptop):
#   crontab -e
#   0 2 * * * cd /home/ariel/personal-projects/naga-jaya-v2 && ./scripts/backup.sh >> /var/log/naga-backup.log 2>&1

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$REPO_ROOT/apps/api/.env"

if [ -z "${DATABASE_URL:-}" ] && [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  set -a; source "$ENV_FILE"; set +a
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL not set and $ENV_FILE missing" >&2
  exit 1
fi

BACKUP_DIR="${BACKUP_DIR:-$REPO_ROOT/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

mkdir -p "$BACKUP_DIR"

TIMESTAMP="$(date +%Y-%m-%d_%H%M)"
OUT="$BACKUP_DIR/naga_${TIMESTAMP}.sql.gz"

echo "[$(date -Iseconds)] Backup starting → $OUT"

pg_dump "$DATABASE_URL" \
  --no-owner \
  --no-privileges \
  --format=plain \
  | gzip -9 > "$OUT"

SIZE="$(du -h "$OUT" | cut -f1)"
echo "[$(date -Iseconds)] Backup done. Size: $SIZE"

# Rotation: delete files older than retention
DELETED="$(find "$BACKUP_DIR" -maxdepth 1 -name 'naga_*.sql.gz' -mtime +"$RETENTION_DAYS" -print -delete | wc -l)"
echo "[$(date -Iseconds)] Rotated $DELETED old backups (>${RETENTION_DAYS}d)"
