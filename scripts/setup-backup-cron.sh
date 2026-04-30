#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

CRON_ENTRY="0 2 * * * ${SCRIPT_DIR}/backup-db.sh"

# Check if already installed
if crontab -l 2>/dev/null | grep -qF "backup-db.sh"; then
  echo "Backup cron already installed. Current crontab:"
  crontab -l | grep backup-db
  exit 0
fi

(crontab -l 2>/dev/null || true; echo "$CRON_ENTRY") | crontab -
echo "Backup cron installed (daily at 2 AM). Current crontab:"
crontab -l | grep backup-db
