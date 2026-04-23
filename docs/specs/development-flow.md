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
3. On `10.132.166.5`, run:
   - `cd /root/music_app && git pull origin master`
   - `docker compose build`
   - `docker compose up -d`
4. Verify:
   - `curl http://127.0.0.1:3001/api/v1/system/health`
   - `curl -I http://127.0.0.1:3000`
   - `docker compose ps`

## Feature Priority
Build in this order unless product priorities change:
1. `auth`
2. `content/search`
3. `player/library`
4. `profile/recommendation`
5. `ai-dj`
6. `imports`
7. `knowledge/voice`
