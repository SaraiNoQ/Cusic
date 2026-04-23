# Repository Guidelines

## 仓库速览

这是一个 `pnpm + Turborepo` Monorepo。主线结构是：

- `apps/web`: Next.js Web 前端
- `apps/api`: NestJS API 与 Swagger
- `apps/worker`: 异步任务与 BullMQ 骨架
- `packages/shared`: 共享 DTO、类型、常量
- `packages/ui`: UI 共享层
- `packages/config`: ESLint、Prettier、TSConfig 共享配置
- `prisma`: schema、migration、init SQL
- `docs`: 产品、架构、规范文档

## 先看哪里

不要一次性通读所有文档，按任务进入：

- 产品需求或范围变更：`docs/RPD.md`
- 系统分层、模块职责、技术架构：`docs/arch.md`
- 工程规范、技术栈、目录约定：`docs/specs/engineering-playbook.md`
- 代码组织、分层与命名：`docs/specs/code-organization.md`
- 数据库设计或 Prisma 相关：`docs/specs/database-design.md`
- API 协议或 Swagger 相关：`docs/specs/api-design.md`
- 日常开发、提交流程、服务器交付：`docs/specs/development-flow.md`

## 代码地图

- 前端实现主要在 `apps/web/src/app`
- API 模块在 `apps/api/src/modules`
- Worker 入口在 `apps/worker/src`
- OpenAPI 草案在 `apps/api/openapi/openapi.yaml`
- 共享类型优先放 `packages/shared/src`

## 常用命令

- `pnpm dev`
- `pnpm build`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm prisma:validate`

## 最小工作规则

- 改数据结构前，先对齐 `database-design.md` 和 `prisma/`
- 改接口时，同时维护 NestJS Swagger 与 `openapi.yaml`
- 可复用类型不要散落定义，优先收敛到 `packages/shared`
- 不要在 `AGENTS.md` 重复详细规范，缺细节就进入 `docs/` 对应文档
