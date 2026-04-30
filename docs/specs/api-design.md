# 音乐 AI App API 设计文档

- 文档版本：v0.4
- 文档状态：持续更新
- 更新时间：2026-04-30
- 关联文档：`docs/RPD.md`、`docs/arch.md`、`docs/specs/engineering-playbook.md`、`docs/specs/database-design.md`

## 1. 设计目标与约束

本 API 文档用于指导：

1. NestJS controller/service 设计
2. 前后端联调
3. Swagger/OpenAPI 产出
4. 后续 DTO 和 shared types 定义

约束如下：

1. API 基础路径为 `/api/v1`
2. 接口风格采用 `REST 为主 + SSE 补充`
3. 鉴权采用 `JWT Bearer Token`
4. 会话策略采用 `Access Token + Refresh Token`
5. 所有成功响应与错误响应使用统一 envelope

## 2. 通用协议规范

### 2.1 请求头

鉴权接口之外的受保护接口统一要求：

```http
Authorization: Bearer <access_token>
Content-Type: application/json
```

公网部署要求：

1. Web 域名为 `https://web.sarainoq.cn`。
2. API 域名为 `https://api.sarainoq.cn/api/v1`。
3. API CORS 通过 `API_CORS_ORIGINS` 配置，生产默认包含 `https://web.sarainoq.cn`。
4. 浏览器端不得通过 `web.sarainoq.cn:3001` 访问 API。

### 2.1.1 前端 API 代理策略

为消除跨域问题，前端采用了 Next.js rewrites 将同源 `/api/v1/*` 请求代理到 API 后端：

- `NEXT_PUBLIC_API_BASE_URL=/api/v1`：浏览器端 JS 使用相对路径发起请求，请求到达同源的 Next.js 服务器。
- `API_INTERNAL_URL`：Next.js 服务端将 `/api/v1/*` 代理转发的目标地址。Docker Compose 部署时设为 `http://api:3001`（Docker 网络内部地址），本地开发时默认 `http://localhost:3001`。
- 浏览器只与 Web 域通信，不再直接访问 API 域。这消除了对 CORS 配置的浏览器端依赖，也避免了将 API 内部地址暴露到前端 JS bundle 中。

### 2.2 成功响应结构

```json
{
  "success": true,
  "data": {},
  "meta": {}
}
```

### 2.3 失败响应结构

```json
{
  "success": false,
  "error": {
    "code": "AUTH_INVALID_TOKEN",
    "message": "Access token is invalid or expired"
  },
  "meta": {}
}
```

### 2.4 分页规范

列表接口统一采用：

1. `page`
2. `pageSize`
3. `total`
4. `hasMore`

### 2.5 时间与 ID 规范

1. 时间字段统一使用 ISO 8601 字符串
2. 资源 ID 统一为 UUID/ULID 字符串

## 3. 认证接口

### 3.1 `POST /auth/email/request-code`

用途：请求邮箱验证码。

首版实现约束：

1. 验证码为 6 位数字，通过 SMTP 发送到用户邮箱。
2. 服务端只保存验证码 hash，不在响应中返回明文验证码。
3. 验证码有效期为 10 分钟，重复请求返回 `cooldownSeconds` 供前端控制重发节奏。
4. SMTP 未配置时返回 `AUTH_SMTP_NOT_CONFIGURED`。

请求 DTO：

```json
{
  "email": "user@example.com"
}
```

响应 DTO：

```json
{
  "success": true,
  "data": {
    "cooldownSeconds": 60
  }
}
```

错误码：

1. `AUTH_EMAIL_INVALID`
2. `AUTH_CODE_RATE_LIMITED`
3. `AUTH_SMTP_NOT_CONFIGURED`

### 3.2 `POST /auth/login`

用途：通过邮箱验证码登录。

首版实现约束：

1. 首次登录自动创建用户，`displayName` 默认使用邮箱前缀。
2. 登录成功后创建 `user_sessions` 和可撤销 `refresh_tokens` 记录。
3. 同一验证码最多允许 5 次尝试，成功后立即标记为已使用。

请求 DTO：

```json
{
  "email": "user@example.com",
  "code": "123456"
}
```

响应 DTO：

```json
{
  "success": true,
  "data": {
    "accessToken": "jwt",
    "refreshToken": "refresh-token",
    "expiresIn": 1800,
    "user": {
      "id": "usr_01",
      "email": "user@example.com",
      "displayName": "Sara"
    }
  }
}
```

错误码：

1. `AUTH_CODE_INVALID`
2. `AUTH_CODE_EXPIRED`

### 3.3 `POST /auth/refresh`

用途：刷新 access token。

首版实现约束：

1. Refresh token 只在服务端保存 hash。
2. 每次刷新都会轮换 refresh token，旧 refresh token 立即撤销。
3. session 被撤销或过期时刷新失败，返回 `AUTH_REFRESH_INVALID`。

请求 DTO：

```json
{
  "refreshToken": "refresh-token"
}
```

响应 DTO：

```json
{
  "success": true,
  "data": {
    "accessToken": "new-jwt",
    "refreshToken": "new-refresh-token",
    "expiresIn": 1800
  }
}
```

错误码：

1. `AUTH_REFRESH_INVALID`
2. `AUTH_REFRESH_REVOKED`

### 3.4 `POST /auth/logout`

用途：注销当前会话。

首版实现约束：

1. 登出会撤销当前 refresh token 与对应 session。
2. 重复登出已失效 token 时仍返回幂等成功。

请求 DTO：

```json
{
  "refreshToken": "refresh-token"
}
```

响应 DTO：

```json
{
  "success": true,
  "data": {
    "loggedOut": true
  }
}
```

### 3.5 `GET /auth/me`

用途：获取当前用户信息。

首版实现约束：

1. 必须携带 `Authorization: Bearer <access_token>`。
2. Access token 失效或 session 被撤销时返回 `AUTH_INVALID_TOKEN`。

响应 DTO：

```json
{
  "success": true,
  "data": {
    "id": "usr_01",
    "email": "user@example.com",
    "displayName": "Sara",
    "avatarUrl": null
  }
}
```

## 4. 搜索与内容接口

### 4.1 `GET /search`

用途：统一搜索音乐、播客、电台等内容。

实现记录：

1. Phase 3 起搜索读取 Prisma `content_items`，不再直接从内存 mock catalog 返回。
2. 若 `JAMENDO_CLIENT_ID` 已配置，API 启动时会从 Jamendo API 同步 ~100 首热门曲目作为内容目录种子数据（`provider_name=jamendo`）。未配置时回退到 `cusic_demo` 的 8 首 demo 曲目。
3. Jamendo 曲目携带真实 MP3 音频地址与封面图，`playable=true`。内容 ID 格式为 `jamendo_track_{jamendoId}`。
4. `q` 会匹配标题、专辑、语言与艺人名；`type` 与 `language` 用于结构化筛选。
5. 首版仍使用普通字段过滤与应用层艺人匹配，全文搜索和向量检索留到后续推荐阶段。

查询参数：

1. `q`
2. `type`
3. `language`
4. `page`
5. `pageSize`

响应 DTO：

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "cnt_01",
        "type": "track",
        "title": "Song Title",
        "artists": ["Artist A"],
        "album": "Album A",
        "durationMs": 210000,
        "language": "zh",
        "coverUrl": "https://..."
      }
    ]
  },
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 120,
    "hasMore": true
  }
}
```

错误码：

1. `SEARCH_QUERY_INVALID`
2. `CONTENT_PROVIDER_UNAVAILABLE`

### 4.2 `GET /content/:id`

用途：获取统一内容对象详情。

实现记录：

1. 详情读取 Prisma `content_items`。
2. 当前 demo provider 的可播放 URL 保存在 `metadata_json.audioUrl`，响应时映射为 `audioUrl`。

响应字段建议：

1. 基础信息
2. 可播放状态
3. 可用 provider 列表
4. 相关推荐摘要

### 4.3 `GET /content/:id/related`

用途：获取相关推荐。

实现记录：

1. 首版从 Prisma 内容库中返回同类型内容，排除当前内容。
2. 相关性排序暂按内容库稳定顺序返回，后续推荐阶段再升级为画像或向量排序。

## 5. 播放器与音乐库接口

### 5.1 `GET /player/queue`

用途：获取当前播放队列与活跃播放状态。

认证行为：

1. 携带 Bearer token 时读取当前用户的 Prisma player session。
2. 未登录时返回 demo 内存队列，保持公开播放器演示可用。

响应 DTO：

```json
{
  "success": true,
  "data": {
    "queueId": "que_01",
    "count": 1,
    "items": [],
    "activeIndex": 0,
    "currentTrack": null,
    "positionMs": 42000
  }
}
```

### 5.2 `POST /player/queue`

用途：替换或追加播放队列。

认证行为：

1. 携带 Bearer token 时写入当前用户的 `player_sessions` 与 `player_queue_items`。
2. 未登录时保留 demo 内存队列。

请求 DTO：

```json
{
  "mode": "replace",
  "items": [
    {
      "contentId": "cnt_01"
    }
  ],
  "activeIndex": 0,
  "currentContentId": "cnt_01",
  "positionMs": 42000
}
```

响应 DTO：

```json
{
  "success": true,
  "data": {
    "queueId": "que_01",
    "count": 1,
    "items": [],
    "activeIndex": 0,
    "currentTrack": null,
    "positionMs": 42000
  }
}
```

### 5.3 `POST /player/events`

用途：上报播放事件。

认证行为：

1. 携带 Bearer token 时写入当前用户的 `playback_events`。
2. 未登录时保留 demo telemetry fallback，不影响公开播放器演示。

请求 DTO：

```json
{
  "contentId": "cnt_01",
  "eventType": "play_started",
  "positionMs": 0,
  "occurredAt": "2026-04-23T12:00:00Z"
}
```

### 5.4 `GET /library/playlists`

用途：获取用户歌单列表。

认证行为：

1. 携带 Bearer token 时读取当前用户的 Prisma 歌单；首次访问会创建一个默认 `Cusic` daily playlist。
2. 未登录时返回 demo playlist，保持公开页面可用。

### 5.5 `GET /library/playlists/:id`

用途：获取单个歌单详情。

认证行为：

1. 携带 Bearer token 时读取当前用户名下歌单及其 `playlist_items` 明细。
2. 未登录时读取 demo playlist 明细。
3. 歌单不存在时返回 `null` 数据，不抛出额外 envelope 结构变化。

响应数据：

```json
{
  "id": "pl_01",
  "title": "深夜工作歌单",
  "description": "写方案时听",
  "playlistType": "user_created",
  "itemCount": 2,
  "items": [
    {
      "position": 1,
      "content": {
        "id": "cnt_01",
        "type": "track",
        "title": "Midnight Tramlines",
        "artists": ["南岛女声"]
      }
    }
  ]
}
```

### 5.6 `POST /library/playlists`

用途：创建歌单。

请求 DTO：

```json
{
  "title": "深夜工作歌单",
  "description": "写方案时听"
}
```

### 5.7 `PATCH /library/playlists/:id`

用途：更新歌单标题或描述。

实现约束：

1. 仅更新传入字段。
2. 当前阶段返回 `{ updated, playlist }`，便于前端直接回写详情。

### 5.8 `DELETE /library/playlists/:id`

用途：删除歌单。

实现约束：

1. 登录用户歌单采用软删除。
2. 未登录 demo playlist 采用内存删除。

### 5.9 `POST /library/playlists/:id/items`

用途：向歌单中追加内容。

实现约束：

1. 重复内容不会重复写入同一歌单。
2. 响应会返回 `addedCount` 与 `skippedCount`，前端可区分“已在歌单内”和“本次新增”。

### 5.10 `DELETE /library/playlists/:id/items/:contentId`

用途：从歌单中移除一个内容项。

实现约束：

1. 删除后会重排剩余内容的 `position`。
2. 若目标内容不存在于歌单中，返回 `removed: false`。

### 5.11 `GET /library/favorites`

用途：获取当前用户收藏列表，用于前端刷新后恢复收藏状态。

响应数据：

```json
{
  "items": [
    {
      "contentId": "cnt_01",
      "favoriteType": "track"
    }
  ]
}
```

### 5.12 `POST /library/favorites`

用途：收藏内容。

请求 DTO：

```json
{
  "contentId": "cnt_01",
  "favoriteType": "track"
}
```

### 5.13 `DELETE /library/favorites/:contentId`

用途：取消收藏。

## 6. 画像、推荐与反馈接口

### 6.1 `GET /profile/taste-report`

用途：获取用户画像报告。

实现记录：

1. 该接口需要 Bearer token。
2. 若当前用户尚无 `taste_profiles` 记录，服务端会基于 `playback_events`、`favorites`、`playlists` 同步生成一份 baseline profile。
3. 首版标签主要覆盖 `artist`、`language`、`type`、`album`，不依赖外部导入或 LLM。

响应 DTO：

```json
{
  "success": true,
  "data": {
    "summary": "你偏好粤语流行、抒情女声和夜间写作场景。",
    "explorationLevel": "medium",
    "tags": [
      {
        "type": "genre",
        "value": "cantopop",
        "weight": 0.94,
        "isNegative": false
      }
    ]
  }
}
```

### 6.2 `PATCH /profile/tags`

用途：修正画像标签。

实现记录：

1. 该接口需要 Bearer token。
2. `action` 首版支持：
   - `increase`
   - `decrease`
   - `remove`
3. `increase` 会提升正向标签权重，`decrease` 会提升负向标签权重，`remove` 会移除对应标签。
4. 每次 patch 后都会重算 `summary`，并写入一条 `taste_profile_snapshots`。

请求 DTO：

```json
{
  "updates": [
    {
      "type": "genre",
      "value": "edm",
      "action": "decrease"
    }
  ]
}
```

响应 DTO：

```json
{
  "success": true,
  "data": {
    "updated": 1,
    "profile": {
      "summary": "You currently lean toward zh listening and track-leaning sessions.",
      "explorationLevel": "medium",
      "tags": []
    }
  }
}
```

### 6.3 `GET /recommend/now`

用途：获取此刻推荐。

实现记录：

1. 该接口允许匿名访问。
2. 已登录用户会创建一条 `context_snapshots`，随后把推荐结果写入 `recommendation_results` 与 `recommendation_items`。
3. 未登录用户返回 demo fallback，不写数据库。
4. 浏览器端可通过 `X-Cusic-Timezone` 传入时区；首版上下文只保证 `timezone` 与 `local_time` 真实。
5. 首版排序采用规则排序，不接天气、日历、外部导入，也不做向量召回。

响应 DTO：

```json
{
  "success": true,
  "data": {
    "recommendationId": "rec_01",
    "explanation": "结合你当前的晚间工作状态和近期偏好，推荐以下内容。",
    "items": [
      {
        "contentId": "cnt_01",
        "title": "Song A",
        "reason": "适合夜间专注",
        "content": {
          "id": "cnt_01",
          "type": "track",
          "title": "Song A",
          "artists": ["Artist A"]
        }
      }
    ]
  }
}
```

### 6.4 `GET /playlist/daily`

用途：获取今日歌单。

实现记录：

1. 该接口允许匿名访问。
2. 已登录用户按“每用户每天一份”同步生成或复用 daily playlist，并写入 `daily_playlist_jobs`。
3. 首次生成时同时落一条 `DAILY` 类型 `recommendation_results`，并把 `recommendationResultId` 写入歌单 `generated_context_json`。
4. 未登录用户返回 demo fallback。

响应 DTO：

```json
{
  "success": true,
  "data": {
    "playlistId": "pl_daily_01",
    "title": "Today in Cusic",
    "description": "A daily evening sequence shaped around zh listening and track-leaning sessions.",
    "itemCount": 5,
    "recommendationResultId": "rec_daily_01",
    "items": []
  }
}
```

### 6.5 `POST /feedback`

用途：提交推荐或内容反馈。

实现记录：

1. 该接口需要 Bearer token。
2. 若传入 `recommendationResultId`，服务端会校验该结果属于当前用户。
3. 成功请求写入 `preference_feedback`。

请求 DTO：

```json
{
  "targetType": "content_item",
  "targetId": "cnt_01",
  "feedbackType": "less_like_this",
  "recommendationResultId": "rec_01",
  "reasonText": "现在不想听这么吵"
}
```

响应 DTO：

```json
{
  "success": true,
  "data": {
    "feedbackId": "fb_01",
    "recorded": true
  }
}
```

### 6.6 推荐实现备注

推荐系统首版实现采用向量召回 + LLM 精排的混合架构：

1. **向量召回**：基于 pgvector 余弦相似度进行第一阶段候选召回。用户画像向量（来自 `taste_profiles` 或实时行为嵌入）与内容向量（来自 `content_item_embeddings`）计算相似度，返回 Top-K 候选集。
2. **LLM 生成推荐理由**：对每个推荐结果，LLM 生成个性化推荐理由（per-item reason），融合用户画像、当前上下文与内容特征。
3. **反馈闭环**：用户反馈（`preference_feedback`）通过反馈嵌入（feedback-to-embedding）更新用户画像向量，形成持续优化的推荐闭环。
4. **traceJson 字段**：每条推荐结果（`recommendation_results`）的 `trace_json` 中包含：
   - `mode: 'vector_v1'`
   - `vectorCandidatesCount`：向量召回阶段的候选数量
   - `llmReasonsUsed`：是否使用了 LLM 生成的推荐理由

## 7. AI DJ 与语音接口

### 7.1 `POST /dj/chat`

用途：发起一轮 AI DJ 对话。

首版实现约束：

1. 当前支持 `responseMode=sync` 与 `responseMode=stream`。
2. `responseMode=stream` 仍先返回完整 `sessionId/messageId/replyText/actions`，随后前端再通过 `GET /dj/chat/stream` 消费增量 token。
3. 已登录用户会创建或续写 `chat_sessions/chat_messages`，匿名用户只返回临时 `sessionId`，不落库。
4. `surfaceContext` 由前端附带当前曲目和当前队列，用于解释当前播放和编排队列动作。
5. LLM 驱动的意图识别（`IntentClassifierService`），支持以下意图：
   - `conversation`：一般性对话、音乐知识提问、推荐咨询（不触发自动操作，仅文本回复）
   - `recommend_explain`：解释当前推荐的理由
   - `queue_append`：显式要求向当前队列追加曲目
   - `queue_replace`：显式要求替换整个播放队列
   - `theme_playlist_preview`：显式要求生成主题歌单
   - `knowledge_query`：用户询问音乐知识、艺人背景、流派历史、歌曲故事等
     意图分类器优先使用 LLM 分类（DeepSeek V4 Flash），LLM 不可用时回退到规则型关键词匹配。另设 `mapToValidIntent()` 方法将 LLM 可能产出的非标准意图名称（如 `play_music`）映射到以上 6 个标准枚举值，防止因 LLM 输出格式偏差导致所有请求落入 `conversation` 兜底。
6. 匿名用户也可获得 LLM 流式回复：`replyStreamMode()` 将 stream plan（intent、contentIds、trackDescriptions 等）缓存到 in-memory `StreamPayload`，`executeStreamReply()` 在 `buildStreamContext()` 返回 `null`（匿名用户无 DB 记录）时从缓存重建 `ReplyContext`，继续调用 LLM 流式生成。
7. 当前支持动作（仅 `queue_append` / `queue_replace` / `theme_playlist_preview` 意图触发）：
   - `queue_replace`
   - `queue_append`
8. 当 `intent=theme_playlist_preview` 且用户已登录时，前端可调用 `POST /dj/playlists` 把本轮主题预览保存为 `ai_generated` 歌单。

请求 DTO：

```json
{
  "sessionId": "chat_01",
  "message": "给我推荐三首适合晚上写代码的粤语歌",
  "responseMode": "sync",
  "surfaceContext": {
    "currentTrackId": "cnt_focus_fm",
    "queueContentIds": ["cnt_focus_fm", "cnt_afterhours_loop"]
  }
}
```

响应 DTO：

```json
{
  "success": true,
  "data": {
    "sessionId": "chat_01",
    "messageId": "msg_02",
    "intent": "theme_playlist_preview",
    "replyText": "可以，先给你三首偏夜间氛围的粤语歌。",
    "actions": [
      {
        "type": "queue_replace",
        "payload": {
          "contentIds": ["cnt_01", "cnt_02", "cnt_03"]
        }
      }
    ]
  }
}
```

### 7.2 `GET /dj/sessions/:sessionId/messages`

用途：读取已持久化的 AI DJ 会话消息，用于完整聊天浮窗恢复历史。

首版实现约束：

1. 必须登录。
2. 只允许读取当前用户自己的会话。
3. 返回可直接渲染的 `user/assistant` 文本消息，并携带 `intent/actions` 供前端恢复可继续执行的 UI 状态。

响应 DTO：

```json
{
  "success": true,
  "data": [
    {
      "id": "msg_01",
      "role": "user",
      "messageType": "text",
      "text": "来一组深夜写作的粤语歌",
      "createdAt": "2026-04-25T13:20:00.000Z"
    },
    {
      "id": "msg_02",
      "role": "assistant",
      "messageType": "action",
      "text": "收到。我把主频道切到更贴近你这句指令的航线。",
      "intent": "theme_playlist_preview",
      "actions": [
        {
          "type": "queue_replace",
          "payload": {
            "contentIds": ["cnt_01", "cnt_02", "cnt_03"]
          }
        }
      ],
      "createdAt": "2026-04-25T13:20:01.000Z"
    }
  ]
}
```

### 7.3 `POST /dj/playlists`

用途：将某条 AI DJ 的主题预览结果保存为个人音乐库中的 `ai_generated` 歌单。

首版实现约束：

1. 必须登录。
2. 只能保存当前登录用户自己会话中的助手消息。
3. 只有 `theme_playlist_preview` 类型回复允许保存。
4. 服务端会读取助手消息里的结构化 `actions + trace_json`，以对应内容项创建歌单。
5. 对同一条 `messageId` 重复保存时保持幂等，直接返回已存在歌单，不重复创建。

请求 DTO：

```json
{
  "sessionId": "chat_01",
  "messageId": "msg_02"
}
```

响应 DTO：

```json
{
  "success": true,
  "data": {
    "created": true,
    "playlist": {
      "id": "pl_ai_01",
      "title": "来几首粤语夜间听感 - AI DJ",
      "description": "A reusable playlist captured from an AI DJ theme preview inside the current player lane.",
      "playlistType": "ai_generated",
      "itemCount": 3
    }
  }
}
```

### 7.8 `GET /dj/chat/stream`

用途：以 SSE 接收 AI DJ 流式回复。

首版实现约束：

1. 由 `POST /dj/chat` 成功返回的 `sessionId` 与 `messageId` 驱动。
2. 已登录用户只能消费自己会话里的消息流；匿名用户只允许消费当前 API 进程里暂存的本轮回复。
3. 首版事件顺序固定为：
   - `chunk`
   - `actions`（仅有动作时发送）
   - `done`
4. `done` 事件会回传完整 `replyText` 与 `actions`，前端可用于流式失败后的最终兜底。

请求参数：

1. `sessionId`
2. `messageId`

事件 payload：

1. `chunk`

```json
{
  "sessionId": "chat_01",
  "messageId": "msg_02",
  "delta": "我先把这个主题"
}
```

2. `actions`

```json
{
  "sessionId": "chat_01",
  "messageId": "msg_02",
  "actions": [
    {
      "type": "queue_replace",
      "payload": {
        "contentIds": ["cnt_01", "cnt_02", "cnt_03"]
      }
    }
  ]
}
```

3. `done`

```json
{
  "sessionId": "chat_01",
  "messageId": "msg_02",
  "replyText": "我先把这个主题压成一组可直接上机的预览队列。",
  "actions": [
    {
      "type": "queue_replace",
      "payload": {
        "contentIds": ["cnt_01", "cnt_02", "cnt_03"]
      }
    }
  ]
}
```

### 7.4 `GET /voice/voices`

用途：列出可用的 TTS 语音列表。

首版实现约束：

1. 鉴权：`OptionalJwtAuthGuard`（允许匿名访问）。
2. 返回当前 TTS provider 支持的全部语音，包含 id、name、language、gender 字段。
3. 若未配置任何 TTS provider，返回空列表。

响应 DTO：

```json
{
  "success": true,
  "data": {
    "provider": "mimo",
    "voices": [
      {
        "id": "bingtang",
        "name": "冰糖",
        "language": "zh",
        "gender": "female"
      }
    ]
  }
}
```

### 7.5 `POST /voice/asr`

用途：语音转文本（ASR）。

首版实现约束：

1. 鉴权：`OptionalJwtAuthGuard`（允许匿名访问）。
2. 请求格式：`multipart/form-data`，文件字段为 `audio`。
3. 支持音频格式：WAV、MP3、PCM。
4. 返回转录文本与置信度。

响应 DTO：

```json
{
  "success": true,
  "data": {
    "text": "我想听披头士",
    "confidence": 0.95
  }
}
```

错误码：

1. `VOICE_ASR_FAILED`
2. `VOICE_UNSUPPORTED_FORMAT`

### 7.6 `POST /voice/tts`

用途：文本转语音（TTS）。

首版实现约束：

1. 鉴权：`JwtAuthGuard`（需登录）。
2. 请求格式：JSON，包含 `text`（必填）和可选 `voice` 参数。
3. MiMo TTS 为优先 provider，可选音色：`bingtang`、`molly`、`soda`、`baihua`、`mia`、`chloe`、`milo`、`dean`。
4. 阿里云 TTS 为备选 provider，可选音色：`qianxue`、`aizhen`、`aishuo`。
5. 两者均未配置时回退到 stub，返回模拟音频地址。

请求 DTO：

```json
{
  "text": "下面给你讲讲披头士。",
  "voice": "bingtang"
}
```

响应 DTO：

```json
{
  "success": true,
  "data": {
    "audioUrl": "https://...",
    "durationMs": 4200
  }
}
```

错误码：

1. `VOICE_TTS_FAILED`
2. `VOICE_INVALID_VOICE`

### 7.7 `POST /dj/voice/chat`

用途：语音 AI DJ 对话——上传音频后依次完成 ASR 转录、AI DJ 处理与 TTS 合成，返回完整语音对话结果。

首版实现约束：

1. 鉴权：`OptionalJwtAuthGuard`（允许匿名访问）。
2. 请求格式：`multipart/form-data`，文件字段为 `audio`。
3. 流程：音频上传 → ASR 转录（`/voice/asr`） → AI DJ 对话处理（`/dj/chat`） → TTS 合成（`/voice/tts`） → 返回语音结果。
4. 若 TTS provider 未配置或合成失败，`audioUrl` 返回 `null`，但 `reply` 与 `transcription` 仍然正常返回。

响应 DTO：

```json
{
  "success": true,
  "data": {
    "reply": "披头士是来自英国利物浦的传奇摇滚乐队……",
    "transcription": "给我讲讲披头士",
    "audioUrl": "https://..."
  }
}
```

错误码：

1. `VOICE_CHAT_ASR_FAILED`
2. `VOICE_CHAT_TTS_FAILED`

实现备注：MiMo TTS 为首选 provider，阿里云 TTS 为备选 fallback。当两者均未配置时，TTS 合成返回 stub 模拟结果。

## 8. 知识问答接口

### 8.1 `POST /knowledge/query`

用途：提交知识问答请求，基于内容目录进行回答。

首版实现约束：

1. 鉴权：`JwtAuthGuard`（需登录）。
2. 请求参数：
   - `question`（必填）：用户知识问答问题。
   - `chatSessionId`（可选）：关联的 AI DJ 会话 ID。
3. 服务端使用 LLM 结合内容目录上下文（content catalog context）生成回答，从内容库检索相关来源与关联内容。
4. 每次查询持久化一条 trace 记录（`knowledge_traces`）及其引用来源（`knowledge_sources`）。

请求 DTO：

```json
{
  "question": "披头士乐队有哪些经典专辑？",
  "chatSessionId": "chat_01"
}
```

响应 DTO：

```json
{
  "success": true,
  "data": {
    "traceId": "kt_01",
    "summaryText": "披头士（The Beatles）是来自英国利物浦的传奇摇滚乐队……",
    "sources": [
      {
        "contentId": "cnt_beatles_01",
        "title": "Abbey Road",
        "relevance": 0.95
      }
    ],
    "relatedContent": [
      {
        "contentId": "cnt_beatles_02",
        "title": "Let It Be",
        "type": "track"
      }
    ]
  }
}
```

### 8.2 `GET /knowledge/traces`

用途：列出当前用户的知识问答历史记录。

首版实现约束：

1. 鉴权：`JwtAuthGuard`（需登录）。
2. 按时间倒序返回知识查询记录。
3. 支持分页参数 `page`、`pageSize`。

### 8.3 `GET /knowledge/traces/:traceId`

用途：获取指定知识问答 trace 的完整详情，包含来源引用。

首版实现约束：

1. 鉴权：`JwtAuthGuard`（需登录）。
2. 只允许读取当前用户自己的 trace 记录。
3. 返回完整 `summaryText`、`sources[]` 与 `relatedContent[]`。

实现备注：知识问答使用 LLM 结合内容目录上下文生成回答，持久化 trace 与 source 记录用于历史回溯与来源溯源。

## 9. 导入、任务与系统接口

### 9.1 `GET /imports`

用途：列出当前登录用户最近的导入任务。

首版实现约束：

1. 必须登录。
2. 默认按 `createdAt desc` 返回最近 20 条。
3. 当前只返回任务摘要列表，不做分页参数开放。
4. `resultSummary` 会返回 worker 执行阶段的结构化摘要，便于前端列表和详情展示。

### 9.2 `POST /imports/playlists`

用途：提交歌单或历史导入任务。

实现记录：

1. 必须登录。
2. 请求会创建一条 `import_jobs` 记录，状态初始化为 `queued`，并同步入队到 BullMQ。
3. 若队列不可用或入队失败，接口必须直接返回错误，不能留下”已成功受理但未入队”的假状态。
4. 当前支持 `importType=playlist` 与 `importType=history`，分别映射到 `PLAYLIST_IMPORT` 与 `HISTORY_IMPORT`。
5. 已接入首个真实 provider（`jamendo`）：注册 provider 的请求会先经过 `ProviderRegistryService` 做 payload 校验，通过后再创建任务并入队；worker 执行时会调用 Jamendo API 拉取真实曲目并落库。
6. 未注册的 provider 仍走 stub 执行分支，返回模拟结果并附带 warning。

请求 DTO（Jamendo 示例）：

```json
{
  “providerName”: “jamendo”,
  “importType”: “playlist”,
  “payload”: {
    “playlistId”: 107113
  }
}
```

请求 DTO（历史/专辑导入）：

```json
{
  “providerName”: “jamendo”,
  “importType”: “history”,
  “payload”: {
    “albumId”: 789012
  }
}
```

响应 DTO（受理阶段）：

```json
{
  “success”: true,
  “data”: {
    “jobId”: “job_01”,
    “status”: “queued”,
    “providerName”: “jamendo”,
    “jobType”: “playlist_import”,
    “payload”: {
      “playlistId”: 107113
    },
    “resultSummary”: {
      “accepted”: true,
      “mode”: “provider_live”,
      “phase”: “accepted”,
      “importType”: “playlist”,
      “providerName”: “jamendo”,
      “summaryText”: “Queued a playlist import for jamendo.”
    },
    “errorText”: null,
    “createdAt”: “2026-04-27T10:12:00.000Z”,
    “updatedAt”: “2026-04-27T10:12:00.000Z”,
    “startedAt”: null,
    “finishedAt”: null
  }
}
```

响应 DTO（worker 完成后）：

```json
{
  “success”: true,
  “data”: {
    “jobId”: “job_01”,
    “status”: “succeeded”,
    “providerName”: “jamendo”,
    “jobType”: “playlist_import”,
    “payload”: {
      “playlistId”: 107113
    },
    “resultSummary”: {
      “mode”: “provider_live”,
      “phase”: “completed”,
      “importType”: “playlist”,
      “providerName”: “jamendo”,
      “importedItemCount”: 15,
      “playlistCount”: 1,
      “summaryText”: “Imported 15 tracks from Jamendo playlist #107113 and saved as the playlist \”Jamendo Import — Jamendo playlist #107113\”.”,
      “warnings”: []
    },
    “errorText”: null,
    “createdAt”: “2026-04-27T10:12:00.000Z”,
    “updatedAt”: “2026-04-27T10:12:05.000Z”,
    “startedAt”: “2026-04-27T10:12:01.000Z”,
    “finishedAt”: “2026-04-27T10:12:05.000Z”
  }
}
```

### 9.3 `GET /imports/:jobId`

用途：查询导入任务状态。

首版实现约束：

1. 必须登录。
2. 只允许读取当前用户自己的导入任务。
3. 若任务不存在，返回 `IMPORT_JOB_NOT_FOUND` 对应的 404。
4. worker 执行时，状态按 `queued -> running -> succeeded/failed` 流转；前端应轮询该接口直到任务进入终态。

### 9.4 `GET /system/health`

用途：开发与运维必需的健康检查接口。

返回内容建议：

1. API 状态
2. PostgreSQL 状态
3. Redis 状态
4. Queue 状态
5. Provider 简要状态

## 10. 通用错误码规范

错误码按模块分组，例如：

1. `AUTH_*`
2. `SEARCH_*`
3. `CONTENT_*`
4. `PLAYER_*`
5. `PROFILE_*`
6. `RECOMMEND_*`
7. `DJ_*`
8. `VOICE_*`
9. `IMPORT_*`
10. `SYSTEM_*`

首版推荐的高频错误码：

1. `AUTH_INVALID_TOKEN`
2. `AUTH_REFRESH_INVALID`
3. `CONTENT_NOT_FOUND`
4. `CONTENT_PROVIDER_UNAVAILABLE`
5. `RECOMMEND_CONTEXT_MISSING`
6. `DJ_SESSION_NOT_FOUND`
7. `VOICE_ASR_FAILED`
8. `IMPORT_JOB_NOT_FOUND`
9. `SYSTEM_DEPENDENCY_UNHEALTHY`

## 11. DTO 与共享类型约束

建议进入 `packages/shared` 的公共类型包括：

1. `ApiSuccessEnvelope<T>`
2. `ApiErrorEnvelope`
3. `PaginationMeta`
4. `ContentItemDto`
5. `TasteProfileDto`
6. `RecommendationCardDto`
7. `ChatTurnRequestDto`
8. `ChatTurnResponseDto`
9. `ImportJobDto`

约束：

1. API DTO 使用 `camelCase`
2. 不把数据库表结构直接暴露为 API DTO
3. Provider 原始字段不得直接透传给前端

## 12. 首版不纳入 API 细化范围

1. 后台管理接口
2. A/B 实验接口
3. 灰度发布接口
4. 公网开放平台接口

## 13. 当前默认假设

1. JWT 主要用于 Web 首发的前后端联调，不在首版同时支持 cookie session。
2. SSE 仅用于 AI DJ 流式文本回复，其他接口仍走普通 HTTP。
3. 歌曲、播客、电台统一通过 `ContentItemDto` 变体返回，不按 Provider 暴露差异。
4. 导入任务和推荐 trace 先提供查询能力，不额外设计复杂运营后台接口。
