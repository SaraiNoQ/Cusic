# 音乐 AI App 架构设计文档

- 文档版本：v0.2
- 文档状态：初版
- 更新时间：2026-04-30
- 对齐文档：`docs/RPD.md`

## 1. 架构目标与约束

### 1.1 架构目标

本系统不是传统意义上的“音乐播放器”，而是一个围绕用户听歌需求、上下文状态与 AI 对话能力构建的智能音频产品。架构设计目标如下：

1. 支撑音乐、播客、电台与 AI DJ 的统一产品体验。
2. 支撑用户长期听歌画像与短期上下文驱动的推荐闭环。
3. 允许通过统一抽象接入不同内容源、模型、语音和外部数据服务。
4. 适配 `Web 首发 + 中国大陆优先 + 1-3 人团队 + 可上线 MVP` 的现实约束。
5. 在不过度设计的前提下，为后续拆分服务、切换供应商和扩展 AI 能力保留清晰边界。

### 1.2 关键约束

1. 首版应采用 `模块化单体`，而不是微服务优先。
2. 首版核心闭环是 `音乐播放 + AI DJ 推荐`，其余能力围绕这一闭环增强。
3. 音乐/播客/电台内容优先对接第三方平台，不自建版权库。
4. AI 能力优先使用托管模型 API，降低模型部署和运维成本。
5. 中国大陆优先，因此默认采用国内云、国内可访问服务和可替换的 Provider 抽象。
6. 首版语音交互为 `按键式语音对话`，不做实时双工语音助手。

## 2. 总体架构总览

系统采用四层架构：

1. 应用层：面向用户的 Web 应用，承载页面、播放器、对话 UI、授权管理与状态展示。
2. 领域服务与编排层：核心业务后端，负责内容聚合、播放会话、画像、上下文、推荐、AI DJ 和知识讲解。
3. AI 与 Provider 抽象层：统一封装模型、语音、搜索、天气、日历、内容源等外部能力。
4. 数据与基础设施层：数据库、缓存、队列、对象存储、日志与部署环境。

推荐的首版部署拓扑：

1. 一个 `Next.js` Web 应用。
2. 一个 `NestJS` 主后端 API 服务。
3. 一个 `BullMQ Worker` 异步任务进程。
4. 一个 `PostgreSQL` 主库。
5. 一个 `Redis` 实例。
6. 一个 `OSS/CDN` 存储层。

这一拓扑对 1-3 人团队足够可控，同时能覆盖：

1. 前端页面与交互。
2. 同步 API 请求。
3. 异步任务，例如歌单导入、画像重算、每日歌单生成、知识摘要。

## 3. 顶层应用层设计

### 3.1 技术选型

应用层采用：

1. `Next.js + React + TypeScript`
2. `App Router`
3. `TanStack Query` 管理服务端状态
4. `Zustand` 管理播放器和对话会话级状态
5. `SSE` 或 `WebSocket` 传输 AI 流式回复
6. `HTMLAudioElement` 承载首版播放能力

### 3.2 前端模块划分

#### 3.2.1 Discovery 模块

负责首页、搜索、今日歌单、此刻推荐、主题入口和探索入口。

主要职责：

1. 展示推荐卡片和搜索结果。
2. 触发播放、保存歌单、打开 AI DJ。
3. 将复杂自然语言需求转交 AI DJ。

#### 3.2.2 Playback 模块

负责统一播放器体验。

主要职责：

1. 管理当前播放内容、队列、模式和进度。
2. 支持音乐、播客和电台的统一播放控制。
3. 上报播放、暂停、跳过、完播等事件。

#### 3.2.3 AI DJ 模块

负责文本会话、语音入口、流式回复、TTS 回播和推荐动作。

主要职责：

1. 接收用户文本或语音输入。
2. 展示 AI DJ 对话回复。
3. 支持一键将推荐结果加入播放队列。
4. 在知识讲解时播放 TTS 音频。

#### 3.2.4 Profile 模块

负责用户画像、授权状态、歌单导入和品味报告。

主要职责：

1. 展示听歌画像标签和偏好摘要。
2. 支持用户修正偏好标签。
3. 管理外部歌单导入和上下文授权。

#### 3.2.5 Atmosphere 模块

负责全屏氛围背景渲染，提升 NASA 朋克式视觉沉浸感。

主要职责：

1. 通过 WebGL 片段着色器渲染实时星空、星云、行星、日晕等全屏背景元素。
2. 响应鼠标视差和播放状态（`u_mouse`、`u_energy` uniform）。
3. 深色/浅色主题各自拥有独立渲染分支，通过 `u_theme` uniform 切换。
4. 作为 `PlayerScreen` 的底层 canvas 子组件，不参与 DOM 布局流。

#### 3.2.6 Voice Module

负责语音输入/输出层，支持按键式语音对话。

主要职责：

1. 通过 MediaRecorder API 实现按键式语音录制与上传。
2. 接收并播放 TTS 音频回放。
3. 多 Provider 支持：MiMo TTS（mimo-v2.5-tts，支持 VoiceDesign 与 VoiceClone）、阿里云 ASR/TTS、stub 降级。
4. 在设置页提供语音选择器，内置 8 款 MiMo 预设音色。

#### 3.2.7 Knowledge Module

负责音乐知识问答，以 KnowledgeCard 形式在对话中展示。

主要职责：

1. 接收用户音乐知识问题，通过 LLM 结合内容目录检索生成回答。
2. 以 KnowledgeCard 组件在前端对话中渲染知识内容。
3. 展示信息来源引用。

### 3.3 前端状态分层

前端状态应分为三层：

1. 页面数据状态：使用 TanStack Query 获取并缓存，如搜索结果、歌单、画像、推荐。
2. 会话状态：使用 Zustand 保存播放器队列、当前曲目、AI 会话窗口状态。
3. 本地持久状态：保存轻量设置，如语言、TTS 开关、最近一次选中的 DJ 风格。

## 4. 中层领域服务与交互编排

后端采用 `NestJS` 模块化单体，按照领域模块拆分，不按“页面接口”堆叠。

### 4.1 模块划分

#### 4.1.1 AuthModule

职责：

1. 邮箱登录与验证码流程。
2. 会话管理。
3. 用户基础信息和权限状态管理。

#### 4.1.2 ContentModule

职责：

1. 聚合第三方音乐、播客、电台内容源。
2. 统一内容对象结构。
3. 屏蔽内容源差异，向上层提供统一搜索、详情、播放地址和元数据访问。

#### 4.1.3 LibraryModule

职责：

1. 管理收藏、歌单、最近播放、导入记录。
2. 接收 AI DJ 生成歌单并落库。
3. 保存用户站内内容资产。

#### 4.1.4 ProfileModule

职责：

1. 构建长期听歌画像。
2. 保存风格、语言、情绪、年代、场景、艺人等标签。
3. 生成用户可见的自然语言品味摘要。
4. 处理用户手动修正标签。

#### 4.1.5 ContextModule

职责：

1. 汇聚系统时间、时区、位置、天气、日历和飞书日程。
2. 生成推荐与 AI DJ 可用的“当前上下文快照”。
3. 区分强上下文信号和缺省上下文信号。

#### 4.1.6 RecommendationModule

职责：

1. 输出“此刻推荐”和“今日歌单”。
2. 执行规则召回、向量召回、过滤和重排。
3. 调用模型生成用户可读的推荐解释。

#### 4.1.7 AIDJModule

职责：

1. 识别用户意图。
2. 编排内容搜索、推荐、知识讲解和播放控制能力。
3. 输出文本回复、推荐动作和可选 TTS 回复。

#### 4.1.8 KnowledgeModule

职责：

KnowledgeService with content catalog search + LLM explanation, KnowledgeController with /knowledge/query and /knowledge/traces endpoints, knowledge_query intent integration with AI DJ

#### 4.1.9 VoiceModule

职责：

VoiceService with pluggable VoiceProvider (MiMo, Aliyun, Stub), VoiceController with /voice/asr, /voice/tts, /voice/voices, voice-enabled AI DJ chat endpoint

#### 4.1.10 EventModule

职责：

1. 记录播放、完播、跳过、收藏、分享、保存歌单等事件。
2. 接收显式反馈，如喜欢、不喜欢、少推一点。
3. 为画像和推荐模块提供反馈数据。

### 4.2 同步接口与异步任务的边界

同步接口应只做用户可感知的即时交互，例如：

1. 搜索
2. 播放控制
3. 此刻推荐
4. AI DJ 单轮回复

异步任务应承担高耗时或可延迟工作，例如：

1. 外部歌单导入
2. 历史数据标准化
3. 画像重算
4. 每日歌单生成
5. 知识资料抓取与摘要
6. Embedding 计算

## 5. AI 层抽象、实现逻辑与方法包装

### 5.1 抽象原则

业务层不得直接绑定某个模型厂商 SDK，统一通过 Provider 接口访问。

建议定义以下抽象接口：

1. `LLMProvider`
2. `EmbeddingProvider`
3. `ASRProvider`
4. `TTSProvider`
5. `VoiceProvider`
6. `SearchProvider`
7. `ContentProvider`
8. `CalendarProvider`
9. `WeatherProvider`

这样做的目标：

1. 更换厂商时不影响上层业务流程。
2. 可以按场景选择不同模型。
3. 可对不同 Provider 做超时、熔断和降级。

### 5.2 AI DJ 的实现逻辑

AI DJ 不应被实现为“直接把用户输入丢给大模型”，而应采用“意图识别 + 工具编排 + 结果组织”的结构。

首版建议流程：

1. 接收用户输入。
2. 判断输入类型：
   - 点歌/搜索
   - 推荐请求
   - 主题歌单生成
   - 音乐知识问答
   - 播放控制
3. 构造当前上下文：
   - 用户长期画像
   - 当前时间/天气/位置/日程
   - 最近播放和最近对话
4. 选择需要调用的工具：
   - 内容搜索
   - 推荐引擎
   - 知识检索
   - 播放器动作
5. 汇总结果后生成自然语言回复。
6. 如果用户开启语音播报，则调用 TTS 生成音频。

### 5.3 推荐系统实现策略

首版采用混合方案，而不是纯规则或纯模型：

1. 规则层：
   根据时间段、天气、日程类型、语言偏好、时长限制等做显式过滤。
2. 画像层：
   根据长期偏好标签控制候选集方向。
3. 向量层：
   使用 embedding 进行相似内容召回，增强探索场景和模糊语义场景。
4. 模型层：
   使用 LLM 进行推荐理由生成、轻量重排和主题歌单组织。

首版不建议：

1. 一开始就做复杂在线学习系统。
2. 依赖 LLM 单独决定最终推荐列表。

### 5.4 长期记忆策略

AI DJ 的长期记忆只保留结构化偏好，不保留无限增长的闲聊全文。

长期保留内容：

1. 画像标签
2. 喜欢/不喜欢反馈
3. 内容偏好摘要
4. 探索倾向与熟悉度

短期保留内容：

1. 最近若干轮对话摘要
2. 当前会话意图状态
3. 当前推荐链路的中间上下文

### 5.5 知识讲解策略

知识讲解需采用 `搜索 -> 摘要 -> 播报` 的流程，而不是完全依赖模型内知识。

流程：

1. 根据问题检索外部资料。
2. 将资料切片并提取结构化事实。
3. 用模型生成适合口播的讲解文本。
4. 输出文字版和可选 TTS 版。
5. 保存内部 source trace，供后续审计和增强前台来源展示能力。

## 6. 中层交互逻辑与关键数据流

### 6.1 即时推荐链路

1. 前端请求 `/recommend/now`
2. RecommendationModule 调用 ContextModule 获取当前上下文快照
3. RecommendationModule 调用 ProfileModule 获取长期画像
4. ContentModule 取内容候选
5. 向量召回服务补充相似候选
6. 规则过滤与排序
7. LLM 生成推荐解释
8. 返回 3-5 首推荐及解释文本

### 6.2 今日歌单链路

1. 定时任务或首次访问触发“今日歌单”生成
2. 读取用户画像、日程、天气和近期反馈
3. 构造候选池
4. 排序并生成歌单
5. 保存到数据库
6. 返回给首页和 AI DJ

### 6.3 AI DJ 对话链路

1. 用户发送文本或语音
2. VoiceModule 在需要时先执行 ASR
3. AIDJModule 识别意图
4. 选择调用 RecommendationModule、ContentModule、KnowledgeModule 或播放器动作
5. 组织结构化结果
6. 调用 LLM 生成自然语言回复
7. 如果需要则调用 TTS
8. 前端展示文本并播放语音

### 6.4 画像更新链路

1. EventModule 接收用户行为事件
2. 异步任务聚合近期事件
3. ProfileModule 更新标签权重和偏好摘要
4. RecommendationModule 在下一轮请求中使用最新画像

## 7. 数据模型与外部集成

### 7.1 核心数据对象

首版至少定义以下核心对象：

1. `User`
2. `UserAuthSession`
3. `UserAuthorization`
4. `ContentItem`
5. `Playlist`
6. `PlaybackEvent`
7. `PreferenceFeedback`
8. `TasteProfile`
9. `ContextSnapshot`
10. `RecommendationResult`
11. `ChatSession`
12. `ChatMessage`
13. `KnowledgeTrace`

### 7.2 标准化内容对象

ContentProvider 对外统一返回如下最小字段：

1. `contentId`
2. `source`
3. `type`
4. `title`
5. `artists`
6. `album`
7. `duration`
8. `language`
9. `tags`
10. `coverUrl`
11. `playable`
12. `externalRef`

### 7.3 数据存储职责

#### 7.3.1 PostgreSQL

用于保存：

1. 用户与授权
2. 歌单与收藏
3. 画像标签与摘要
4. 推荐结果日志
5. 对话会话元数据
6. 上下文快照
7. 知识检索链路记录

#### 7.3.2 pgvector

用于保存：

1. 内容 embedding
2. 用户 taste embedding
3. 知识片段 embedding

#### 7.3.3 Redis

用于保存：

1. 热门推荐缓存
2. 会话级缓存
3. 限流键
4. 队列中间状态

#### 7.3.4 BullMQ

用于处理：

1. 导入任务
2. 画像重算
3. 每日歌单生成
4. Embedding 写入
5. 知识摘要任务

#### 7.3.5 OSS/CDN

用于保存：

1. 临时音频文件
2. 讲解 TTS 音频
3. 封面与媒体缓存资源

### 7.4 外部集成清单

1. 内容源 Provider：音乐、播客、电台
2. Calendar Provider：系统日历、飞书 API
3. Weather Provider：OpenWeather
4. Search Provider：外部网页搜索或资讯检索
5. LLM/TTS/ASR Provider：默认国内托管模型服务

## 8. 具体技术栈

### 8.1 前端

1. `Next.js`
2. `React`
3. `TypeScript`
4. `CSS Modules + CSS Custom Properties`
5. `TanStack Query`
6. `Zustand`
7. Settings page (/settings)
8. CusicLogo (SVG with gold metallic effect)

### 8.2 后端

1. `NestJS`
2. `TypeScript`
3. `Prisma` 作为 ORM
4. `Swagger / OpenAPI` 生成接口文档

### 8.3 数据与任务

1. `PostgreSQL`
2. `pgvector`
3. `Redis`
4. `BullMQ`

### 8.4 AI 与语音

首版默认建议：

1. `阿里云 Model Studio / Qwen` 作为 LLM 主接入
2. 使用 OpenAI-compatible 接口封装模型调用
3. `阿里云 ASR` 处理语音转文本（备用降级通道）
4. `小米 MiMo TTS (mimo-v2.5-tts 系列)` 作为主 TTS，备用 `阿里云 TTS`

原因：

1. 中国大陆优先，更便于访问与合规。
2. 支持中英文和部分方言。
3. 能减少首版自建模型与语音服务的复杂度。
4. MiMo TTS 提供更自然的语音合成效果与音色定制能力。

### 8.5 部署

首版部署建议：

1. 前端：单独部署 Next.js
2. 后端：单独部署 NestJS API
3. Worker：单独进程部署
4. 数据库：阿里云 RDS PostgreSQL
5. Redis：阿里云 Redis
6. 对象存储：阿里云 OSS
7. 入口层：Nginx 或云负载均衡

首版不默认采用 Kubernetes。待流量与团队规模上升后，再评估容器编排平台。

## 9. API 与接口形态

首版接口风格采用 `REST + SSE/WebSocket`。

推荐的核心接口：

1. `POST /auth/login`
2. `GET /search`
3. `POST /player/queue`
4. `GET /recommend/now`
5. `GET /playlist/daily`
6. `POST /imports/playlists`
7. `GET /profile/taste-report`
8. `POST /dj/chat`
9. `POST /dj/voice/asr`
10. `POST /dj/voice/tts`
11. `POST /feedback`

推荐的内部服务方法：

1. `RecommendationService.getNowPlayingRecommendations(userId, context)`
2. `AIDJService.handleTurn(sessionId, input)`
3. `KnowledgeService.explainTopic(userId, topic)`
4. `ProfileService.refreshTasteProfile(userId)`
5. `ContentAggregator.search(query, filters)`

## 10. 安全、监控与容错

### 10.1 安全

1. 所有外部授权都必须记录 scope 和授权时间。
2. 用户可撤回日历、飞书、定位和麦克风权限。
3. 会话令牌与第三方 access token 分离存储。
4. 不把完整原始第三方响应长期暴露给前端。

### 10.2 监控

首版至少具备：

1. 结构化日志
2. 请求链路 ID
3. AI 调用耗时、失败率、重试统计
4. 推荐点击率、完播率、跳过率
5. Provider 健康检查

### 10.3 容错与降级

1. 内容源异常时，允许跨源降级或返回明确不可播放提示。
2. LLM 异常时，基础搜索与播放能力不能受影响。
3. TTS 异常时，允许只返回文字回复。
4. 天气、定位、日程缺失时，回退到长期画像推荐。

## 11. 首版边界与后续演进

### 11.1 首版必须实现

1. Web 端基础页面和播放器
2. 内容聚合搜索与统一播放
3. 外部歌单导入
4. 长期画像基础版
5. 此刻推荐
6. 今日歌单
7. AI DJ 文本对话
8. 按键式语音输入和 TTS 播报

### 11.2 首版不做深

1. 微服务拆分
2. 实时双工语音对话
3. 复杂运营后台
4. 自建推荐训练平台
5. 社交体系

### 11.3 后续演进方向

1. 将 RecommendationModule 拆为独立服务
2. 增加 A/B 实验能力和运营配置后台
3. 增加车载、移动端、桌面端适配
4. 增加更细粒度的人设化 AI DJ
5. 支持来源展示和知识可信度分级

## 12. 参考资料

1. Next.js App Router 文档：<https://nextjs.org/docs/app>
2. Next.js 安装与运行要求：<https://nextjs.org/docs/app/getting-started/installation>
3. NestJS 文档：<https://docs.nestjs.com/>
4. NestJS OpenAPI 文档：<https://docs.nestjs.com/openapi/introduction>
5. BullMQ 文档：<https://docs.bullmq.io/>
6. BullMQ Queue 指南：<https://docs.bullmq.io/guide/queues>
7. 阿里云 Model Studio 概览：<https://www.alibabacloud.com/help/en/model-studio/what-is-model-studio>
8. 阿里云 Qwen 语音识别：<https://www.alibabacloud.com/help/en/model-studio/qwen-speech-recognition>
9. 阿里云实时语音识别：<https://www.alibabacloud.com/help/en/model-studio/real-time-speech-recognition>
10. 阿里云 Qwen TTS：<https://www.alibabacloud.com/help/en/model-studio/qwen-tts>
11. 阿里云 PostgreSQL pgvector：<https://www.alibabacloud.com/help/en/rds/apsaradb-rds-for-postgresql/pgvector-use-guide>
