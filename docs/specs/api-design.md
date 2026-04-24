# 音乐 AI App API 设计文档

- 文档版本：v0.1
- 文档状态：初版
- 更新时间：2026-04-23
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

响应字段建议：

1. 基础信息
2. 可播放状态
3. 可用 provider 列表
4. 相关推荐摘要

### 4.3 `GET /content/:id/related`

用途：获取相关推荐。

## 5. 播放器与音乐库接口

### 5.1 `POST /player/queue`

用途：替换或追加播放队列。

请求 DTO：

```json
{
  "mode": "replace",
  "items": [
    {
      "contentId": "cnt_01"
    }
  ]
}
```

响应 DTO：

```json
{
  "success": true,
  "data": {
    "queueId": "que_01",
    "count": 1
  }
}
```

### 5.2 `POST /player/events`

用途：上报播放事件。

请求 DTO：

```json
{
  "contentId": "cnt_01",
  "eventType": "play_started",
  "positionMs": 0,
  "occurredAt": "2026-04-23T12:00:00Z"
}
```

### 5.3 `GET /library/playlists`

用途：获取用户歌单列表。

### 5.4 `POST /library/playlists`

用途：创建歌单。

请求 DTO：

```json
{
  "title": "深夜工作歌单",
  "description": "写方案时听"
}
```

### 5.5 `POST /library/playlists/:id/items`

用途：向歌单中追加内容。

### 5.6 `POST /library/favorites`

用途：收藏内容。

请求 DTO：

```json
{
  "contentId": "cnt_01",
  "favoriteType": "track"
}
```

### 5.7 `DELETE /library/favorites/:contentId`

用途：取消收藏。

## 6. 画像、推荐与反馈接口

### 6.1 `GET /profile/taste-report`

用途：获取用户画像报告。

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

### 6.3 `GET /recommend/now`

用途：获取此刻推荐。

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
        "reason": "适合夜间专注"
      }
    ]
  }
}
```

### 6.4 `GET /playlist/daily`

用途：获取今日歌单。

### 6.5 `POST /feedback`

用途：提交推荐或内容反馈。

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

错误码：

1. `FEEDBACK_TARGET_INVALID`

## 7. AI DJ 与语音接口

### 7.1 `POST /dj/chat`

用途：发起一轮 AI DJ 对话。

请求 DTO：

```json
{
  "sessionId": "chat_01",
  "message": "给我推荐三首适合晚上写代码的粤语歌",
  "responseMode": "sync"
}
```

响应 DTO：

```json
{
  "success": true,
  "data": {
    "sessionId": "chat_01",
    "messageId": "msg_02",
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

### 7.2 `GET /dj/chat/stream`

用途：以 SSE 接收 AI DJ 流式回复。

请求参数：

1. `sessionId`
2. `messageId`

事件类型建议：

1. `token`
2. `action`
3. `done`
4. `error`

### 7.3 `POST /dj/voice/asr`

用途：语音转文本。

请求：

1. `multipart/form-data`
2. 文件字段：`audio`

响应 DTO：

```json
{
  "success": true,
  "data": {
    "text": "我想听披头士"
  }
}
```

### 7.4 `POST /dj/voice/tts`

用途：文本转语音。

请求 DTO：

```json
{
  "text": "下面给你讲讲披头士。",
  "voice": "cn_female_editorial"
}
```

响应 DTO：

```json
{
  "success": true,
  "data": {
    "audioUrl": "https://..."
  }
}
```

## 8. 导入、任务与系统接口

### 8.1 `POST /imports/playlists`

用途：提交歌单或历史导入任务。

请求 DTO：

```json
{
  "providerName": "spotify",
  "importType": "playlist",
  "payload": {
    "playlistUrl": "https://..."
  }
}
```

响应 DTO：

```json
{
  "success": true,
  "data": {
    "jobId": "job_01",
    "status": "queued"
  }
}
```

### 8.2 `GET /imports/:jobId`

用途：查询导入任务状态。

### 8.3 `GET /system/health`

用途：开发与运维必需的健康检查接口。

返回内容建议：

1. API 状态
2. PostgreSQL 状态
3. Redis 状态
4. Queue 状态
5. Provider 简要状态

## 9. 通用错误码规范

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

## 10. DTO 与共享类型约束

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

## 11. 首版不纳入 API 细化范围

1. 后台管理接口
2. A/B 实验接口
3. 灰度发布接口
4. 公网开放平台接口

## 12. 当前默认假设

1. JWT 主要用于 Web 首发的前后端联调，不在首版同时支持 cookie session。
2. SSE 仅用于 AI DJ 流式文本回复，其他接口仍走普通 HTTP。
3. 歌曲、播客、电台统一通过 `ContentItemDto` 变体返回，不按 Provider 暴露差异。
4. 导入任务和推荐 trace 先提供查询能力，不额外设计复杂运营后台接口。
