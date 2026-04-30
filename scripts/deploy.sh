#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "=== Pulling latest code ==="
git pull origin master

echo "=== Building and starting containers ==="
docker compose up -d --build --remove-orphans

echo "=== Running database migrations ==="
docker compose exec -T api npx prisma migrate deploy 2>/dev/null || echo "Migration step skipped (prisma may not be available)"

echo "=== Checking health ==="
sleep 3
curl -sf http://localhost:3001/api/v1/system/health | head -c 200 || echo "Health check failed, check docker compose ps"

echo "=== Deploy complete ==="
docker compose ps
