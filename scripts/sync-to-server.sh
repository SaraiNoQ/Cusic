#!/usr/bin/env bash
set -euo pipefail

REMOTE_HOST="${REMOTE_HOST:-root@10.132.166.83}"
REMOTE_DIR="${REMOTE_DIR:-/root/music_app}"

rsync -az --delete \
  --exclude node_modules \
  --exclude .next \
  --exclude dist \
  --exclude coverage \
  ./ "${REMOTE_HOST}:${REMOTE_DIR}"

echo "[sync] pushed repository to ${REMOTE_HOST}:${REMOTE_DIR}"
