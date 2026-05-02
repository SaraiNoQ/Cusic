# Cusic 开发路线图

- 文档版本：v0.6
- 文档状态：持续更新
- 更新时间：2026-04-30
- 关联文档：`docs/RPD.md`、`docs/arch.md`、`docs/specs/engineering-playbook.md`

## 1. 目标与当前状态

本路线图用于指导 `Cusic` 从当前 Demo 原型逐步推进到可持续开发、可联调、可上线的产品状态。

当前已完成基础：

1. 产品需求文档、架构文档、工程规范文档。
2. 数据库设计文档与 API 设计文档。
3. Monorepo、Prisma baseline、Swagger 骨架、Docker Compose 运行环境。
4. Web/API/Worker 基础骨架。
5. 第一轮播放器 Demo 闭环。
6. Phase 2 产品级播放器视觉基线。
7. 首页信息架构首轮减负：推荐模块从主屏常驻区调整为 Queue 区域入口触发的浮窗，首页继续聚焦播放与 AI DJ 主任务。
8. 语音与知识模块（VoiceModule: MiMo/阿里云 TTS/ASR, KnowledgeModule: LLM + 内容目录音乐知识问答, ContextModule: 播放事件情绪推导）。
9. 向量搜索服务（pgvector cosine similarity 候选召回，Taste Profile embedding 生成）。
10. 设置页面（settings page）、品牌 CusicLogo、语音选择器 UI（voice selector）、知识卡片组件（knowledge cards）。
11. Phase 7 加固与上线准备：安全加固、结构化日志、性能优化、CI/CD、Docker HEALTHCHECK、备份恢复、发布流程、测试。

当前未完成重点：

1. MVP 主链路的真实用户态验收：登录、token refresh、用户队列、收藏、歌单、播放事件和推荐结果需要以登录用户为主路径持续回归。
2. 真实 Provider 能力验收：Jamendo、LLM、Voice 等 Provider 已有抽象和降级实现，但需要明确区分真实接入、stub fallback 与公开 demo 模式。
3. AI DJ 工具编排稳定性验收：聊天意图、推荐解释、队列替换/追加、主题歌单保存、知识问答需要作为同一条主路径验证。

当前推进中：

MVP 闭环校准与真实可用性加固。Phase 7 的工程加固能力已落地，但“可演示”仍需推进到“可上线 MVP”的连续验收标准。

## 2. 阶段规划总览

### Phase 0：文档与技术基线

目标：完成产品、架构、工程、数据库、API 和部署基线。

核心工作：

1. 输出 RPD、架构、工程规范。
2. 固化数据库与 API 设计。
3. 初始化 monorepo、Prisma、OpenAPI、Compose。

交付产物：

1. `docs/RPD.md`
2. `docs/arch.md`
3. `docs/specs/*`
4. Monorepo 工程骨架

完成标准：

1. 仓库可安装、可构建、可运行。
2. 服务可在远程服务器启动健康检查。

### Phase 1：Player Demo

目标：先打通最小可演示闭环，而不是一开始就接入全部真实能力。

核心工作：

1. 内容搜索、播放、队列、收藏、歌单、播放事件。
2. mock content provider。
3. 首页播放器主屏 Demo。

交付产物：

1. 可运行的 Web 播放器 Demo。
2. 对应 API mock/service 闭环。

完成标准：

1. 用户可搜索、播放、切歌、收藏、建歌单。
2. API 与前端联调稳定。

### Phase 2：Mobile UI System

目标：把工程 Demo 升级为产品级界面原型，建立移动端优先的设计系统。

核心工作：

1. 重做首页为智能播放器主屏。
2. 引入 AI chat bottom sheet。
3. 引入 search bottom sheet。
4. 建立氛围层、动画层和视觉 token。

交付产物：

1. 移动端优先首页原型。
2. 视觉语言基线。
3. 播放器、sheet、输入条等可复用组件。

完成标准：

1. 首页视觉与交互达到产品原型级别。
2. 播放器、聊天、搜索三者形成统一体验。

### Phase 3：Auth + Persistence

目标：从 demo user 过渡到真实用户和真实数据。

当前状态：已启动。已完成邮箱验证码登录、JWT access token、refresh token 轮换、session 持久化与前端登录入口；用户歌单、收藏、播放事件、播放队列、当前播放状态与内容搜索 catalog 已落到 Prisma，歌单管理闭环已补齐，当前正在补齐 profile/recommendation 持久化基线。

核心工作：

1. 邮箱验证码登录。
2. Access/Refresh Token 流程。
3. content/search、library、events、player session 等落到 Prisma。

交付产物：

1. 可用账号体系。
2. 真实持久化数据链路。

完成标准：

1. 登录、登出、刷新 token 可用。
2. 用户歌单、收藏、播放事件重启后可保留。

### Phase 4：AI DJ First Loop

目标：让 AI 助手真正进入播放器主流程。

当前状态：已完成首轮闭环。当前已完成 AI DJ 精简主页入口与完整聊天浮窗、文本同步对话、会话持久化、规则意图识别、播放器动作编排、`GET /dj/chat/stream` 流式回复，以及把主题预览一键保存为 `ai_generated` 歌单。

核心工作：

1. 文本聊天。
2. 推荐解释。
3. 点歌与歌单生成。
4. SSE 流式回复。

交付产物：

1. AI DJ 可用首版。
2. 推荐结果可直接进入播放队列。

完成标准：

1. 用户可以通过聊天完成点歌、推荐、换风格等操作。

### Phase 5：Taste Profile + Recommendation

目标：让产品从"能聊天"升级到"懂用户"。

状态：**Done**。

核心工作：

1. 导入外部歌单与收听记录。
2. 构建用户听歌画像。
3. 生成此刻推荐与今日歌单。

完成内容：

1. Vector-based candidate recall via pgvector cosine similarity。
2. Taste profile embedding 生成。
3. LLM-driven per-item recommendation reasons（推荐解释生成）。
4. Feedback-to-embedding nudge loop（反馈驱动 embedding 微调循环）。
5. Mood-aware context scoring（energetic / focused / restless / neutral 情绪感知上下文评分）。
6. imports 已接入首个真实 provider（Jamendo API），可直接导入 Jamendo 歌单/专辑；内容目录已从 demo mock 升级为真实 Jamendo 曲目库。

交付产物：

1. 用户画像页面。
2. 场景化推荐与每日歌单。

完成标准：

1. 推荐结果明显依赖长期画像与上下文。

### Phase 6：Voice + Knowledge

目标：把 AI DJ 扩展到语音与音乐知识探索。

状态：**Done**。

核心工作：

1. ASR/TTS。
2. 艺人、专辑、流派知识讲解。
3. 主题探索与专题歌单。

完成内容：

1. **VoiceModule**：MiMo TTS provider（mimo-v2.5-tts, VoiceDesign, VoiceClone），Aliyun TTS/ASR provider，Stub fallback，`GET /voice/voices` endpoint。
2. **KnowledgeModule**：Music knowledge Q&A via LLM + content catalog，KnowledgeTrace / KnowledgeSource 持久化，AI DJ 中新增 `knowledge_query` intent。
3. **ContextModule**：Mood derivation from playback events（从播放事件推导用户情绪），enriched snapshots（上下文富化快照）。

交付产物：

1. 语音交互能力。
2. 知识讲解与探索体验。

完成标准：

1. 用户可通过语音与 AI DJ 交流并获取知识型内容。

### Phase 7：Hardening & Launch Prep

目标：从可用原型进入可稳定交付阶段。

状态：**Done**。

核心工作：

1. 性能优化。
2. 错误监控与日志完善。
3. 数据备份与恢复流程。
4. 发布流程、验收清单与灰度策略。

完成内容：

1. **安全加固**：Helmet 安全头、@nestjs/throttler 全局限流（100req/min，auth 端点 5req/min）、CSP 头、启动环境变量校验。
2. **结构化日志**：nestjs-pino JSON 日志、全局异常过滤器（GlobalExceptionFilter）、请求 ID 追踪（RequestIdInterceptor）。
3. **性能优化**：gzip/brotli 压缩、Next.js 静态资源缓存、Redis 健康检查。
4. **CI/CD**：GitHub Actions 工作流（lint / typecheck / test-api / build-api / build-web）。
5. **Docker HEALTHCHECK**：全部 5 个服务健康检查，service_healthy 依赖条件。
6. **备份恢复**：pg_dump 自动备份脚本（7 天轮转）、恢复脚本、Docker 卷备份、cron 自动安装。
7. **发布流程**：CHANGELOG.md、deploy.sh / rollback.sh、IMAGE_TAG 版本化。
8. **测试**：修复 imports.spec.ts、web smoke test。

交付产物：

1. 稳定运行版本。
2. 发布与回滚流程。

完成标准：

1. 关键链路可观测、可回滚、可验收。

## 3. 推荐开发顺序

当前阶段不再按早期 Phase 从头推进，推荐按 MVP 主链路收敛：

1. Baseline audit：先运行 typecheck、lint、API/Web test、build、Prisma validate，记录真实失败项。
2. Docs reconciliation：校准 roadmap、API/OpenAPI 和数据库文档中“Done / Demo / MVP-ready”的状态表述。
3. Main path hardening：以登录用户为主路径验证搜索/导入、播放、收藏/歌单、推荐、AI DJ 队列动作和知识/语音补充。
4. Provider validation：明确 Jamendo、LLM、Voice 的真实接入状态；缺配置时显示降级状态，不把 stub 当作真实能力验收。
5. Release readiness：本地检查通过后，再按 `development-flow.md` 进行 PR、远端构建、Docker 更新、健康检查和 Cloudflare 验证。

## 4. 每阶段的关键依赖

1. `Phase 2` 依赖现有播放器 Demo，不依赖真实登录。
2. `Phase 3` 依赖现有 Prisma schema 与 API 骨架。
3. `Phase 4` 依赖稳定的播放器、搜索、队列和聊天入口。
4. `Phase 5` 依赖用户体系、事件采集、外部导入和上下文输入。
5. `Phase 6` 依赖 AI DJ 工具链稳定。

## 5. 里程碑产出建议

每个阶段结束都应至少产出以下内容：

1. 代码实现。
2. 对应文档修订。
3. 截图或录屏。
4. 验收清单。
5. 可在 `10.132.166.83` 上运行的构建结果。
