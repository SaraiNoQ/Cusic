- 文档版本：v0.1
- 文档状态：生效
- 更新时间：2026-04-30

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
- CI/CD 自动化：每次 push 到 GitHub 仓库时，`.github/workflows/ci.yml` 自动触发 GitHub Actions 流水线，依次执行 lint、typecheck、test-api、build-api 和 build-web，确保代码在合并前通过所有质量门禁。

### Cloudflare 注入脚本与 React 水合

Cloudflare 的 Web Analytics 功能会在 HTML 中自动注入 `beacon.min.js` 脚本，导致服务端渲染的 HTML 与浏览器端 DOM 不一致，触发 React #418 水合错误。应对措施：

- `apps/web/src/app/layout.tsx` 中 `<html>` 标签添加了 `suppressHydrationWarning` 属性，抑制因 Cloudflare 注入导致的属性/文本水合警告。
- 根因修复：在 Cloudflare Dashboard → 对应域名 → Speed → Optimization 中禁用 "Auto Minify" 和 "Rocket Loader"；或在 Analytics 中关闭自动注入。
- 注入脚本的 `integrity` 哈希不匹配属于 Cloudflare CDN 侧问题，不影响页面功能，可忽略。

## 容器健康检查

Docker Compose 中的全部 5 个服务（`api`、`web`、`worker`、`postgres`、`redis`）均配置了 Docker HEALTHCHECK 指令，用于持续检测容器内部服务是否正常运行。

- `docker-compose.yml` 中通过 `condition: service_healthy` 声明服务间启动依赖关系，确保上游服务（如数据库、缓存）完全就绪后才启动下游服务（如 API、worker）。
- 健康检查失败时，Docker 会根据重试策略自动重启不健康的容器。
- API 服务的健康状态也可通过 `GET /api/v1/system/health` 端点外部探测，该端点返回当前服务状态及上游依赖（数据库、Redis、worker）的连通性。

## 备份与恢复

项目在 `scripts/` 目录下提供完整的数据库和卷备份工具链：

- `scripts/backup-db.sh` — 使用 `pg_dump` 导出 PostgreSQL 全量数据，经 gzip 压缩后存入 `backups/` 目录，默认保留最近 7 天的备份文件（7-day rotation）。
- `scripts/restore-db.sh` — 交互式恢复脚本，列出可用备份文件供操作者选择，并将选定的备份恢复到目标 PostgreSQL 实例。
- `scripts/backup-volumes.sh` — Docker 命名卷备份脚本，将 postgres 数据和 redis 数据卷打包为 `.tar.gz` 归档文件。
- `scripts/setup-backup-cron.sh` — 一键安装定时备份任务，将上述备份脚本注册到系统 crontab，默认每日凌晨 2:00 自动执行。

备份文件统一存储在 `backups/` 目录，`.gz` 和 `.tar.gz` 后缀文件已通过 `.gitignore` 排除，避免误提交大型二进制文件。

## 部署与回滚

项目使用 IMAGE_TAG 版本化与 Shell 脚本实现可追溯、可回滚的部署流程：

- `scripts/deploy.sh` — 部署脚本，执行 git pull、Docker 镜像构建（注入 `IMAGE_TAG` 版本号）和 `docker compose up -d` 启动/更新服务。
- `scripts/rollback.sh` — 回滚脚本，通过指定 `IMAGE_TAG` 参数将服务回退到先前构建的镜像版本，快速恢复到已知良好状态。
- `IMAGE_TAG` — 每次构建时通过环境变量或 CI 注入的 Git commit SHA 标识镜像版本，确保每个部署版本可唯一追溯。在 `docker-compose.yml` 中通过 `${IMAGE_TAG:-latest}` 语法引用，未指定时默认使用 `latest`。

## Feature Priority

Build in this order unless product priorities change:

1. `auth`
2. `content/search`
3. `player/library`
4. `profile/recommendation`
5. `ai-dj`
6. `imports`
7. `knowledge/voice`
