# 代码组织规范

- 文档版本：v0.4
- 文档状态：生效
- 更新时间：2026-04-30
- 关联文档：`docs/specs/engineering-playbook.md`、`docs/specs/api-design.md`

## 1. 目标

本文档用于锁定当前仓库的代码组织方式，避免页面、接口、DTO、状态和 mock 数据继续集中在单文件中。

适用范围：

1. `apps/web`
2. `apps/api`
3. `packages/shared`
4. `packages/ui`

## 2. 前端目录规则

前端按"路由装配、feature、状态、API"分层，不按页面堆逻辑。

推荐结构：

1. `apps/web/src/app`
   只放 Next.js 路由、布局和 providers。`theme-sync.tsx` 为客户端组件负责将 `uiStore.theme` 同步到 `document.documentElement.dataset.theme`。`globals.css` 存放全部 CSS 自定义属性（主题 token），按 `:root`（深色默认值）和 `[data-theme='light']`（浅色覆盖值）两层组织。
2. `apps/web/src/features`
   按业务能力拆分，如 `player`、`chat`、`search`、`profile`、`atmosphere`、`settings`。
   - `features/atmosphere`：WebGL 氛围背景着色器（`AtmosphereCanvas.tsx`），深色/浅色双分支渲染，通过 `u_theme` uniform 切换。
   - `features/settings`：设置页面，包含主题切换（theme toggle）、LLM 开关（LLM toggle）、语音选择器（voice selector）。
   - `features/chat`：包含 `KnowledgeCard.tsx`（音乐知识响应卡片）和 `VoiceRecordButton.tsx`（按住说话 MediaRecorder 按钮）。
   - `features/player`：包含 `CusicLogo.tsx`（SVG 金色金属质感 C + USIC 文字 logo）。
   - 各 feature 的 `*.module.css` 中如需针对浅色模式调整装饰层，使用 `:global([data-theme='light']) .className` 选择器穿透模块作用域。
3. `apps/web/src/lib/api`
   API client、请求封装、模块级 API 方法。`client.ts` 为中枢：`getApiBaseUrl()` 按环境解析 API 基地址（本地直连，生产走 `/api/v1` 相对路径以复用 Next.js rewrites），`apiFetch()` 统一注入认证头、时区头和 token 自动刷新。
4. `apps/web/src/lib/query`
   TanStack Query 的 client、query key、query helper。
5. `apps/web/src/store`
   Zustand store，仅放会话级和本地交互状态。
6. `apps/web/src/hooks`
   只放跨 feature 复用的 hooks；feature 私有 hook 放在各自目录下。

硬约束：

1. `page.tsx` 只负责组装页面，不写复杂业务逻辑。
2. 服务端状态统一走 TanStack Query。
3. 播放器、聊天输入、弹层显隐、本地播放状态统一走 Zustand。
4. 页面内禁止继续定义大块 API 封装和复杂状态机。

## 3. 前端文件命名

1. 组件：`PascalCase.tsx`
2. hooks：`useXxx.ts`
3. store：`xxx-store.ts`
4. API：`xxx-api.ts`
5. query：`query-client.ts`、`query-keys.ts`
6. 样式：优先 feature 级 `*.module.css`

## 4. 后端目录规则

入口文件 `apps/api/src/main.ts` 负责 NestJS 应用启动、CORS 配置（`app.enableCors` 含字符串/正则混合白名单）、全局路径前缀（`api/v1`）和 Swagger 挂载。

后端按领域模块组织，每个核心模块至少具备以下层次：

1. `controllers/`
   HTTP 路由、Swagger 装饰器、请求入口。
2. `dto/`
   请求 DTO 和必要的响应模型定义。
3. `services/`
   业务编排和领域规则。
4. `providers/`
   外部 Provider 或 mock 数据源封装。
5. `types/`
   模块私有类型，不对外暴露。

当前各模块目录结构：

- Knowledge 模块：`controllers/knowledge.controller.ts`、`services/knowledge.service.ts`、`dto/knowledge-query.dto.ts`、`providers/web-search.provider.ts`
- Voice 模块：`voice.controller.ts`、`voice.service.ts`、`interfaces/voice-provider.interface.ts`、`providers/mimo-voice.provider.ts`、`providers/aliyun-voice.provider.ts`、`providers/stub-voice.provider.ts`
- Content 模块：`services/embedding.service.ts`
- Prisma 模块：`vector-search.service.ts`
- Context 模块：`context.service.ts`

硬约束：

1. controller 不直接拼业务规则。
2. DTO 不写在 controller 文件里。
3. mock 数据必须封装在 provider 内，不允许散落在 controller 或 page。
4. 共享 DTO 放 `packages/shared`，模块私有类型不要泄漏到前端。

## 5. shared 与 ui

1. `packages/shared`
   只放前后端共享的 DTO、view model、常量与协议类型。
2. `packages/ui`
   只放可复用 token、基础 UI 组件、轻量表现层工具。

约束：

1. 不要把页面专属组件塞进 `packages/ui`。
2. 不要在 `shared` 中放浏览器专属逻辑或 NestJS 私有实现。

## 6. 本轮落地要求

当前仓库必须满足以下最小结构化要求：

1. 首页播放器拆到 `features/player`
2. 聊天区拆到 `features/chat`
3. 搜索层拆到 `features/search`
4. 氛围背景拆到 `features/atmosphere`
5. API 请求拆到 `lib/api`
6. 播放器、UI、聊天状态拆到 `store`
7. `content`、`library`、`events`、`ai-dj` 模块拆出 `dto/controller/service/provider`
8. Knowledge 模块含 controller/service/provider ✓
9. Voice 模块含多 Provider ✓
10. 向量搜索基础设施 ✓
11. 设置页面 ✓

## 7. 验收标准

1. 页面主入口不再是一个数百行控制器式组件。
2. 后端 controller 文件显著变薄，只保留 HTTP 语义和 Swagger。
3. Query 和 Zustand 被实际使用，而不是只写在规范文档中。
4. 后续接入 Prisma 或真实 Provider 时，只替换 service/provider，不重写页面结构。
