#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-$(dirname "$0")/../backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
COMPOSE_DIR="$(dirname "$0")/.."
LOG_FILE="/var/log/music_app_backup.log"

mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/music_app_${TIMESTAMP}.sql.gz"

echo "[$(date -Iseconds)] Starting PostgreSQL backup..." | tee -a "$LOG_FILE"

cd "$COMPOSE_DIR"
docker compose exec -T postgres pg_dump -U postgres music_app | gzip > "$BACKUP_FILE"

if [ -f "$BACKUP_FILE" ] && [ -s "$BACKUP_FILE" ]; then
  echo "[$(date -Iseconds)] Backup created: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))" | tee -a "$LOG_FILE"
else
  echo "[$(date -Iseconds)] ERROR: Backup file is empty or missing!" | tee -a "$LOG_FILE"
  exit 1
fi

# Remove old backups
find "$BACKUP_DIR" -name "music_app_*.sql.gz" -mtime "+$RETENTION_DAYS" -delete 2>/dev/null || true
echo "[$(date -Iseconds)] Cleaned backups older than $RETENTION_DAYS days" | tee -a "$LOG_FILE"
