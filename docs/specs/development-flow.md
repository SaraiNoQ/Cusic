# Development Flow

## Goal
This document defines the default delivery flow for `Cusic` after the monorepo, Prisma baseline, Swagger skeleton, and Docker Compose runtime are in place.

## Daily Workflow
1. Pull latest `master` locally and create a short-lived branch, for example `feat/auth-login`.
2. Update docs first when the change affects product scope, data shape, or API contracts.
3. Implement code in the monorepo:
   - `apps/web` for UI and interaction
   - `apps/api` for REST, Swagger, and orchestration
   - `apps/worker` for async jobs
   - `packages/shared` for shared DTOs and types
4. Run local checks before commit:
   - `pnpm lint`
   - `pnpm typecheck`
   - `pnpm --filter @music-ai/api build`
   - `pnpm --filter @music-ai/web build`
   - `pnpm prisma:validate`
5. Commit with `type(scope): summary`, for example `feat(auth): add email login dto`.

## Database and API Rules
- Any schema change must update `prisma/schema.prisma`, generate a new migration, and record the impact in the API and architecture docs when relevant.
- Any API change must keep NestJS Swagger decorators and `apps/api/openapi/openapi.yaml` aligned.
- Breaking changes to DTOs must be reflected in `packages/shared`.

## Server Delivery Flow
1. Push branch to GitHub and open a PR.
2. After review, merge into `master`.
3. On `10.132.166.83`, run:
   - `cd /root/music_app && git pull origin master`
   - `COMPOSE_BAKE=false docker compose build --pull=false <service>`
   - `docker compose up -d <service>`
4. Verify:
   - `curl http://127.0.0.1:3001/api/v1/system/health`
   - `curl -I http://127.0.0.1:3000`
   - `docker compose ps`

### Docker Build Notes
- The server may not have direct access to Docker Hub. A registry mirror is configured in `/etc/docker/daemon.json`:
  ```json
  {
    "registry-mirrors": ["https://docker.1ms.run", "https://docker.xuanyuan.me"],
    "ipv6": false
  }
  ```
- Use `--pull=false` to avoid re-pulling base images. Only rebuild the service that changed (e.g., `web`, `api`).
- Use `COMPOSE_BAKE=false` when Bake-related metadata resolution issues occur.

## Public Tunnel Delivery
- Public Web traffic is routed by Cloudflare Tunnel from `https://web.sarainoq.cn` to `http://localhost:3000`.
- Public API traffic is routed by Cloudflare Tunnel from `https://api.sarainoq.cn` to `http://localhost:3001`.
- Production Web builds must set `NEXT_PUBLIC_API_BASE_URL=https://api.sarainoq.cn/api/v1`.
- Production API CORS must include `API_CORS_ORIGINS=https://web.sarainoq.cn,http://localhost:3000`.
- For branch-level server testing, confirm `/root/music_app` is clean, fetch the short branch, switch to it, run migrations/builds, then deploy with `docker compose up -d --build`.
- If Cloudflare returns `502` while local `127.0.0.1:3000` and `127.0.0.1:3001` are healthy, check `cloudflared tunnel info` for active connectors and `journalctl -u cloudflared`; prefer `protocol: http2` when QUIC connections time out.

## Feature Priority
Build in this order unless product priorities change:
1. `auth`
2. `content/search`
3. `player/library`
4. `profile/recommendation`
5. `ai-dj`
6. `imports`
7. `knowledge/voice`
