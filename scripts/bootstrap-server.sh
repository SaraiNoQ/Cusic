#!/usr/bin/env bash
set -euo pipefail

TARGET_DIR="${1:-/root/music_app}"

echo "[bootstrap] target dir: ${TARGET_DIR}"

if ! command -v node >/dev/null 2>&1; then
  echo "[bootstrap] node is missing" >&2
  exit 1
fi

if ! command -v corepack >/dev/null 2>&1; then
  echo "[bootstrap] corepack is missing" >&2
  exit 1
fi

mkdir -p "${TARGET_DIR}"
cd "${TARGET_DIR}"

corepack enable
corepack prepare pnpm@9.15.0 --activate

if [ ! -f .env ]; then
  cp .env.example .env
fi

pnpm install
echo "[bootstrap] dependencies installed"

