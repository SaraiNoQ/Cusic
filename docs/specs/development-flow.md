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
    "registry-mirrors": [
      "https://docker.1ms.run",
      "https://docker.xuanyuan.me"
    ],
    "ipv6": false
  }
  ```
- Use `--pull=false` to avoid re-pulling base images. Only rebuild the service that changed (e.g., `web`, `api`).
- Use `COMPOSE_BAKE=false` when Bake-related metadata resolution issues occur.

## Public Tunnel Delivery

- Public Web traffic is routed by Cloudflare Tunnel from `https://web.sarainoq.cn` to `http://localhost:3000`.
- Public API traffic is routed by Cloudflare Tunnel from `https://api.sarainoq.cn` to `http://localhost:3001`（仅调试/直连场景使用，正常 Web 流量走 rewrites 代理）。
- 生产环境前端通过 Next.js rewrites 将同源 `/api/v1/*` 请求代理到 API 后端，不再直接向 `api.sarainoq.cn` 发请求。需确保以下环境变量：
  - `NEXT_PUBLIC_API_BASE_URL=/api/v1`（浏览器端使用相对路径；`getApiBaseUrl()` 在非 localhost 环境下直接返回此值，不再动态拼接 `api.*` 子域名）
  - `API_INTERNAL_URL=http://api:3001`（Docker 网络内 API 容器地址）
  - `API_CORS_ORIGINS=https://web.sarainoq.cn,http://localhost:3000`（API 端 CORS 白名单。`main.ts` 中未配置时使用内置默认值，包含 `*.sarainoq.cn` 正则匹配作为直连 API 的兜底）
- `docker-compose.yml` 中为 web 服务显式声明了 `build.args.NEXT_PUBLIC_API_BASE_URL` 和 `build.args.API_INTERNAL_URL`，防止宿主机 `.env` 变量意外覆盖 Dockerfile 中的 ARG 默认值。
- Web 构建时必须传入上述环境变量，因为 `NEXT_PUBLIC_*` 会在构建时内联到 JS bundle 中。
- 本地开发时 `API_INTERNAL_URL` 可省略，默认值为 `http://localhost:3001`。
- For branch-level server testing, confirm `/root/music_app` is clean, fetch the short branch, switch to it, run migrations/builds, then deploy with `docker compose up -d --build`.
- If Cloudflare returns `502` while local `127.0.0.1:3000` and `127.0.0.1:3001` are healthy, check `cloudflared tunnel info` for active connectors and `journalctl -u cloudflared`; prefer `protocol: http2` when QUIC connections time out.

### Cloudflare 注入脚本与 React 水合

Cloudflare 的 Web Analytics 功能会在 HTML 中自动注入 `beacon.min.js` 脚本，导致服务端渲染的 HTML 与浏览器端 DOM 不一致，触发 React #418 水合错误。应对措施：

- `apps/web/src/app/layout.tsx` 中 `<html>` 标签添加了 `suppressHydrationWarning` 属性，抑制因 Cloudflare 注入导致的属性/文本水合警告。
- 根因修复：在 Cloudflare Dashboard → 对应域名 → Speed → Optimization 中禁用 "Auto Minify" 和 "Rocket Loader"；或在 Analytics 中关闭自动注入。
- 注入脚本的 `integrity` 哈希不匹配属于 Cloudflare CDN 侧问题，不影响页面功能，可忽略。

## Feature Priority

Build in this order unless product priorities change:

1. `auth`
2. `content/search`
3. `player/library`
4. `profile/recommendation`
5. `ai-dj`
6. `imports`
7. `knowledge/voice`
