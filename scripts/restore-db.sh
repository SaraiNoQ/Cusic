#!/usr/bin/env bash
set -euo pipefail

if [ -z "${1:-}" ]; then
  echo "Usage: $0 <backup-file.sql.gz>"
  echo "Available backups:"
  ls -1 "$(dirname "$0")/../backups/"*.sql.gz 2>/dev/null || echo "  No backups found in backups/"
  exit 1
fi

BACKUP_FILE="$1"
COMPOSE_DIR="$(dirname "$0")/.."

if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERROR: Backup file not found: $BACKUP_FILE"
  exit 1
fi

echo "WARNING: This will OVERWRITE the current database!"
read -rp "Are you sure? Type 'yes' to confirm: " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "Aborted."
  exit 0
fi

echo "Restoring from: $BACKUP_FILE"
cd "$COMPOSE_DIR"
gunzip -c "$BACKUP_FILE" | docker compose exec -T postgres psql -U postgres music_app
echo "Restore complete."
