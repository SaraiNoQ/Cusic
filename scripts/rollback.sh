#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

TARGET="${1:-HEAD~1}"

echo "=== Rolling back to: $TARGET ==="
read -rp "Are you sure? Type 'yes' to confirm: " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "Aborted."
  exit 0
fi

echo "=== Checking out $TARGET ==="
git checkout "$TARGET"

echo "=== Rebuilding and restarting ==="
docker compose up -d --build --remove-orphans

echo "=== Checking health ==="
sleep 3
curl -sf http://localhost:3001/api/v1/system/health | head -c 200 || echo "Health check failed"

echo "=== Rollback complete. To return to master: git checkout master ==="
