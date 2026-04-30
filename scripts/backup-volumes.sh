#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-$(dirname "$0")/../backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

echo "Backing up Docker volumes..."

docker run --rm \
  -v postgres_data:/data \
  -v "$(cd "$(dirname "$0")/.." && pwd)/backups:/backup \
  alpine tar czf "/backup/postgres_data_${TIMESTAMP}.tar.gz" -C /data . 2>/dev/null || \
  echo "WARNING: Could not back up postgres_data volume (may not exist)"

docker run --rm \
  -v redis_data:/data \
  -v "$(cd "$(dirname "$0")/.." && pwd)/backups:/backup \
  alpine tar czf "/backup/redis_data_${TIMESTAMP}.tar.gz" -C /data . 2>/dev/null || \
  echo "WARNING: Could not back up redis_data volume (may not exist)"

echo "Volume backups created with timestamp $TIMESTAMP"
