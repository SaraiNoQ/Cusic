# 音乐 AI App 开发总规范

- 文档版本：v0.2
- 文档状态：持续更新
- 更新时间：2026-04-29
- 关联文档：`docs/RPD.md`、`docs/arch.md`

## 1. 目标与适用范围

本文档用于在数据库设计、API 设计和正式开发前，统一项目的工程规范、设计规范、交付流程和单机运维基线。

适用范围：

1. Web 前端开发
2. API 与 Worker 开发
3. 设计系统与页面原型
4. 本地开发、测试和部署流程
5. 单机服务器运维

本文档默认前提：

1. 中国大陆优先
2. Web 首发
3. 内网先用
4. 1-3 人小团队
5. 模块化单体架构
6. 单机服务器地址为 `10.132.166.83`
7. 服务器用户为 `root`

## 2. 技术栈总表

### 2.1 前端

1. `Next.js`
2. `React`
3. `TypeScript`
4. `CSS Modules + CSS Custom Properties`
5. `TanStack Query`
6. `Zustand`

### 2.2 后端

1. `NestJS`
2. `TypeScript`
3. `Prisma`
4. `Swagger / OpenAPI`

### 2.3 数据与任务

1. `PostgreSQL`
2. `pgvector`
3. `Redis`
4. `BullMQ`

### 2.4 AI 与外部能力

1. 托管 LLM API
2. ASR Provider
3. TTS Provider
4. 外部搜索 Provider
5. 内容源 Provider
6. 飞书、日历、天气等上下文 Provider

### 2.5 工程工具链

1. `pnpm`
2. `Turborepo`
3. `ESLint`
4. `Prettier`
5. `Husky`
6. `lint-staged`
7. `GitHub Actions`
8. `Docker Compose`

## 3. Monorepo 目录约定

仓库采用 Monorepo，建议固定为以下结构：

1. `apps/web`
   Web 前端。
2. `apps/api`
   主后端 API。
3. `apps/worker`
   异步任务 Worker。
4. `packages/ui`
   可复用 UI 组件、设计 token、主题变量。
5. `packages/shared`
   共享类型、常量、工具方法。
6. `packages/config`
   ESLint、Prettier、TSConfig 等共享配置。
7. `docs/`
   需求、架构、规范、接口与运维文档。

约束：

1. 前端不得直接依赖后端私有实现。
2. 共享类型统一放在 `packages/shared`。
3. Provider 抽象放在后端领域层，不放在页面组件层。
4. UI token 和主题变量统一放在 `packages/ui`。

## 4. 工具链与开发环境规范

### 4.1 包管理与构建

统一使用：

1. `pnpm install`
2. `pnpm turbo dev`
3. `pnpm turbo build`
4. `pnpm turbo lint`
5. `pnpm turbo typecheck`
6. `pnpm turbo test`

禁止：

1. 混用 `npm`、`yarn`、`pnpm`
2. 在子项目各自定义互相冲突的脚本名

### 4.2 环境变量规范

环境变量分层：

1. 前端公开变量：仅限公开配置和站点地址
2. 服务端变量：数据库、Redis、JWT、Provider Key
3. 部署变量：端口、域名、Compose profile

命名要求：

1. 前端统一 `NEXT_PUBLIC_` 前缀
2. 私密变量不允许出现在前端构建链路
3. `.env.example` 必须维护

### 4.3 Git 与协作

采用 `Trunk-based + 短分支`。

要求：

1. 每个功能分支尽量小而可合并。
2. 分支命名示例：
   - `feat/ai-dj-chat`
   - `feat/player-queue`
   - `fix/search-timeout`
3. 提交格式：
   - `feat(ai-dj): add chat endpoint`
   - `fix(player): handle queue reset`
   - `docs(specs): add engineering playbook`

### 4.4 Pull Request 规范

每个 PR 必须包含：

1. 变更目的
2. 影响范围
3. 验证方式
4. 截图或录屏
5. 未完成项或风险说明

## 5. 前端设计系统与 UI 原型规范

### 5.1 视觉方向

产品视觉方向定义为：

1. 高级编辑感
2. 音乐杂志与电台编辑部气质
3. 克制但有内容密度
4. 融合 NASA 朋克与复古未来主义磁带质感

禁止：

1. 通用 SaaS 风格
2. 过度紫色、过度玻璃拟态、过度发光边框
3. 默认组件库风格直接上线

### 5.2 主题规范

从第一阶段开始同时支持：

1. 浅色主题（默认跟随系统偏好，可手动切换）
2. 深色主题

#### 实现方式

1. 所有颜色定义为 CSS 自定义属性（CSS Custom Properties），统一在 `apps/web/src/app/globals.css` 的 `:root`（深色默认值）和 `[data-theme='light']`（浅色覆盖）两个选择器中声明。
2. 主题切换通过 `document.documentElement.dataset.theme` 属性控制，由 `ThemeInitializer`（`apps/web/src/app/theme-sync.tsx`）在客户端同步 `ui-store`（`apps/web/src/store/ui-store.ts`）中的 `theme` 状态。
3. `DeviceHeader` 中提供 DARK/LIGHT 分段按钮直连 `uiStore.setTheme()`。
4. 组件 CSS 中统一使用 `var(--token)` 引用变量，禁止硬编码颜色值。

#### CSS Module 中的浅色覆盖

当 Module CSS 内无法完全通过变量覆盖实现效果时，使用 `:global([data-theme='light'])` 选择器穿透模块作用域进行针对性调整。`[data-theme='light']` 位于 `<html>` 全局作用域，`className` 保持模块作用域：

```css
/* PlayerScreen.module.css */
:global([data-theme='light']) .heroSun {
  display: none;
}
:global([data-theme='light']) .noise {
  opacity: 0.1;
  mix-blend-mode: multiply;
}
```

适用场景：在浅色模式下需要隐藏暗色装饰元素、调低装饰层不透明度、或切换合成模式时使用。

#### WebGL 氛围背景层（AtmosphereCanvas）

项目使用 WebGL 片段着色器渲染全屏氛围背景（星空、星云、太阳、行星）。着色器通过 `u_theme` uniform 接收主题状态（`0.0` = 深色，`1.0` = 浅色），在 `main()` 中混合两套渲染分支：

```glsl
vec3 color = mix(darkTheme(uv, ...), lightTheme(uv, ...), u_theme);
```

- **深色分支出**：深空渐变、三层星场、太阳光晕、行星剪影、星云噪声
- **浅色分支出**：暖色羊皮纸颗粒底、日光光环与日冕、星座连线、旋转轨道弧线、行星凌日、彗星轨迹、等距蓝图网格

组件位于 `apps/web/src/features/atmosphere/components/AtmosphereCanvas.tsx`，通过 `PlayerScreen` 从 `uiStore` 读取并传入 `theme` prop。

当引入新的 WebGL 装饰元素时，需要同时提供深浅两套分支实现。

#### Token 分类

- 背景色：`--bg-screen`、`--bg-body`、`--bg-surface`、`--bg-surface-deep`、`--bg-card`、`--bg-card-base`、`--bg-card-dark`、`--bg-input`、`--bg-button`、`--bg-header`、`--bg-segmented`、`--bg-footer`、`--bg-overlay`、`--bg-overlay-fog`
- 卡片与面板背景：`--bg-overlay-card-start/end`、`--bg-card-hover-start/end`、`--bg-dj-bubble-start/end`、`--bg-hero-start/end`、`--bg-queue-channel-start/end`、`--bg-queue-overlay-*`、`--bg-search-badge-*`、`--bg-import-*`
- 文字色：`--text-primary`、`--text-body`、`--text-heading`、`--text-chat`、`--text-secondary`、`--text-muted`、`--text-label`、`--text-button`、`--text-queue-name` 等
- 强调色：`--accent-orange`、`--accent-gold`、`--accent-teal`、`--accent-green` 及各级变体
- 边框色：`--border-standard`、`--border-warm`、`--border-accent`、`--border-subtle`、`--border-faint`、`--border-warm-strong` 等
- 装饰层：`--decorative-bloom-warm`、`--decorative-bloom-teal`、`--decorative-scanline`
- 设备外壳：`--device-border`、`--device-glow-orange`、`--device-glow-teal`、`--device-inner-border`、`--device-inner-shadow`、`--device-shadow-main`、`--device-shadow-accent`、`--device-mouse-light`、`--device-shine-*`
- 渐变：`--gradient-card-start/end`、`--gradient-button-start/end`、`--gradient-header-shadow-*`、`--gradient-elevated-*` 等
- 阴影：`--shadow-device`、`--shadow-card`、`--shadow-panel`、`--shadow-segment-glow`、`--shadow-btn-hover` 等

#### 约束

1. 所有颜色先定义 token，再落到组件。
2. 不允许组件内硬编码品牌色或 `rgba()` 颜色值。
3. 深浅主题必须共享同一套语义 token 命名，分别定义在 `:root` 和 `[data-theme='light']`。
4. 新增语义 token 时，必须同时在两个主题下定义对应值。
5. 装饰性 CSS 元素（星点、扫描线、辉光叠加层）在浅色模式下需要降低不透明度或切换合成模式，使用 `:global([data-theme='light'])` 覆盖。
6. WebGL 着色器元素在浅色模式下需要提供独立的渲染分支，而非直接降级为不可见。

### 5.3 页面原型策略

本项目采用“代码即原型”。

要求：

1. 先定义页面骨架和 design token。
2. 再在 `apps/web` 中实现高保真原型页面。
3. 每个新页面都必须说明：
   - 页面目标
   - 主任务
   - 主视觉层级
   - 核心交互路径

### 5.4 首页与核心界面风格

首页以“播放器工作台”为主，不是纯杂志封面，也不是纯 AI 聊天页。

首页必须同时体现：

1. 当前播放状态
2. AI DJ 主入口
3. 此刻推荐
4. 今日歌单
5. 编辑型推荐理由

### 5.5 动效规范

#### 界面动效

界面动效采用强氛围策略，但必须集中在关键节点：

1. 页面转场
2. 封面切换
3. 卡片进场
4. AI 回复流式出现
5. 播放状态变化

禁止：

1. 全局无意义 hover 动画
2. 高频闪烁
3. 影响可读性的持续运动背景

#### WebGL 氛围背景

全屏氛围背景由 `AtmosphereCanvas`（`apps/web/src/features/atmosphere/components/AtmosphereCanvas.tsx`）负责渲染，是一个独立的 WebGL 片段着色器层，位于页面最底层（`z-index` 0 级以下）。

着色器支持深色/浅色两套视觉分支，通过 `u_theme` uniform 在 `main()` 中混合切换。统一接口为：

```tsx
<AtmosphereCanvas className={styles.canvas} isPlaying={boolean} theme="dark" | "light" />
```

关键行为：

- **鼠标视差**：星场和星云层随鼠标位置产生微小位移（`u_mouse` uniform）
- **播放响应**：播放时星场亮度增强（`u_energy` uniform）
- **时间驱动**：星体闪烁、彗星移动、轨道旋转由 `u_time` 驱动，保持稳定帧率动画
- **深色场景**：深空渐变、三层星斑闪烁、太阳光晕与透镜耀斑、星云 FBM 噪声、地球剪影
- **浅色场景**：暖色羊皮纸颗粒、日光晕与光环、旋转轨道弧线、星座连线网络、行星凌日与土星环、双彗星拖尾、脉冲辐射环、等距蓝图网格

当向着色器引入新的视觉元素时，必须：

1. 同时提供深色（`darkTheme()`）和浅色（`lightTheme()`）两分支
2. 在 `main()` 中通过 `mix(dark, light, u_theme)` 混合
3. 新元素不得影响核心界面可读性

CSS 装饰叠加层（`.backgroundBloom`、`.noise`、`.scanlines`）作为着色器之上的轻量静态层，通过 `var(--decorative-*)` token 保持主题感知。

### 5.6 组件规范

首阶段不引入 Storybook，组件规范直接写入代码和文档。

组件要求：

1. 组件必须可复用，不绑定单页业务。
2. 组件必须支持主题切换。
3. 所有按钮、卡片、输入框、弹层、播放器控件统一设计语言。
4. 复杂业务组件允许放在 feature 内，基础组件必须沉淀到 `packages/ui`。

## 6. 编码风格与实现规范

### 6.1 TypeScript 规范

1. 全仓使用 TypeScript 严格模式。
2. 优先显式类型，不依赖隐式 any。
3. DTO、接口和实体命名要能体现业务语义。
4. 不重复定义共享类型。

### 6.2 前端规范

1. 按 feature 组织代码，而不是按页面零散摆放。
2. 页面组件负责展示和组合，不承载复杂业务规则。
3. 服务端状态统一走 TanStack Query。
4. 播放器、AI 会话等本地状态统一走 Zustand。
5. 不默认滥用 `useMemo`、`useCallback`。

### 6.3 后端规范

1. 按领域模块组织，如 `ContentModule`、`AIDJModule`、`RecommendationModule`。
2. 业务层不得直接依赖具体 Provider SDK。
3. Controller 只负责请求入口，复杂逻辑必须进入 Service。
4. 长耗时任务必须进入队列，不阻塞请求线程。

### 6.4 日志与错误处理规范

所有核心模块记录结构化日志，至少包含：

1. `requestId`
2. `userId`
3. `module`
4. `action`
5. `provider`
6. `latencyMs`
7. `result`

错误处理要求：

1. 对外返回用户可理解的错误信息。
2. 对内记录完整错误上下文。
3. 对第三方 Provider 错误保留 source 信息和重试策略。

## 7. 测试策略与质量门槛

首版采用最小测试集，不做重型测试体系，但必须守住主链路。

### 7.1 必须覆盖的最小范围

1. 搜索主链路
2. 播放器基础控制
3. AI DJ 单轮对话接口
4. 此刻推荐接口
5. 歌单导入主链路

### 7.2 合并前质量门槛

所有 PR 合并前至少通过：

1. `lint`
2. `typecheck`
3. 冒烟测试
4. 构建检查

### 7.3 测试层级

首版默认三层：

1. 单元测试：工具函数、规则过滤、数据转换
2. 集成测试：模块接口、推荐与 AI 编排主链路
3. 冒烟测试：关键页面和 API 是否可工作

## 8. 部署、服务器与环境管理

### 8.1 服务器角色

当前服务器 `10.132.166.83` 在首阶段同时承担：

1. 开发环境
2. 测试环境
3. 预发布/生产用途

因此必须做逻辑隔离，而不是混在同一组进程中。

### 8.2 部署方式

统一采用 `Docker Compose`。

基础服务建议：

1. `web`
2. `api`
3. `worker`
4. `postgres`
5. `redis`
6. `nginx`

要求：

1. 每个服务独立容器。
2. 环境变量通过 Compose 和 `.env` 注入。
3. 端口、卷、网络必须有明确命名。
4. 不直接在宿主机裸跑 Node 服务。

### 8.3 环境划分

在单机上至少划分：

1. `dev`
2. `staging`
3. `prod-single`

即便首阶段都在同一台机器，也应通过：

1. 不同 Compose 文件
2. 不同环境变量
3. 不同端口
4. 不同数据卷

来实现隔离。

### 8.4 服务器基础要求

部署前需确认：

1. Docker 与 Docker Compose 已安装
2. 时区与系统时间正确
3. 防火墙和内网访问策略已确认
4. 数据目录和日志目录已规划
5. 关键配置文件已备份

## 9. 日志、备份与恢复基线

### 9.1 日志基线

首阶段采用：

1. 应用日志
2. Nginx 访问日志
3. Docker 容器日志

要求：

1. 日志按服务分类。
2. 日志保留最近可排障周期。
3. 关键错误必须可按 `requestId` 检索。

### 9.2 备份策略

当前按“日志 + 手工备份”基线执行。

至少要求：

1. PostgreSQL 定期导出
2. 关键 `.env` 与 Compose 文件离机备份
3. 上传或导入的关键数据定期归档

### 9.3 恢复策略

文档中必须明确记录：

1. 如何恢复数据库备份
2. 如何恢复 Compose 配置
3. 如何切回上一版镜像
4. 如何验证恢复成功

## 10. 交付流程与阶段产物

正式开发前，必须依次完成以下产物：

1. `RPD` 产品需求文档
2. `arch` 架构设计文档
3. 开发总规范文档
4. 数据库设计文档
5. API 设计文档
6. Monorepo 初始化
7. 基础设计 token 与 UI 骨架

推荐开发顺序：

1. 初始化 Monorepo 和共享配置
2. 建立 `web/api/worker` 三个应用骨架
3. 建立设计 token 和页面原型
4. 建立数据库 schema
5. 定义核心 API
6. 打通搜索、播放、AI DJ 最小闭环

## 11. 第二阶段补强项

以下内容不作为首阶段强制项，但要作为后续补强计划保留：

1. Storybook 或组件文档站
2. 更完整的监控体系
3. 自动化数据库备份
4. 灰度发布和回滚脚本
5. 更完整的 E2E 测试
6. 公网发布安全加固

## 12. 当前默认假设

1. 当前服务器先以内网可用为目标，不按公网正式发布标准约束。
2. 服务器发行版和具体系统包版本暂未锁定，后续运维文档再补充命令级细节。
3. 首阶段优先统一规范和开发节奏，不追求一次性搭建完整平台工程体系。
4. 所有新增规范如果与 `RPD` 或 `arch` 冲突，以更新后的专项文档为准，并回写到关联文档。
