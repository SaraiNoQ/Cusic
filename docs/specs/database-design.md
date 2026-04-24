# 音乐 AI App 数据库设计文档

- 文档版本：v0.1
- 文档状态：初版
- 更新时间：2026-04-23
- 关联文档：`docs/RPD.md`、`docs/arch.md`、`docs/specs/engineering-playbook.md`

## 1. 设计目标与约束

本数据库设计用于支撑以下能力：

1. 用户注册登录与 JWT 会话管理
2. 第三方内容聚合与统一内容对象
3. 音乐库、歌单、收藏、播放历史
4. 听歌画像、上下文快照、推荐结果追踪
5. AI DJ 对话、知识讲解、导入任务

设计约束：

1. 数据库使用 `PostgreSQL`
2. ORM 使用 `Prisma`
3. 向量检索使用 `pgvector`
4. 主键统一采用 `UUID/ULID` 字符串
5. 核心业务数据采用软删除
6. 表名统一使用 `snake_case`

## 2. 设计原则

### 2.1 主键与审计字段

所有核心业务表统一包含：

1. `id`
2. `created_at`
3. `updated_at`

软删除表额外包含：

1. `deleted_at`

### 2.2 枚举与状态字段

推荐将稳定枚举定义为数据库 enum 或 Prisma enum，例如：

1. `content_type`
2. `provider_type`
3. `job_status`
4. `feedback_type`
5. `chat_role`

### 2.3 向量字段原则

以下对象允许使用向量字段：

1. `content_items`
2. `taste_profiles`
3. `knowledge_sources`

向量列仅用于检索，不替代结构化业务字段。

## 3. 逻辑域拆分

### 3.1 认证与用户域

#### 3.1.1 `users`

用途：用户主表。

核心字段：

1. `id`
2. `email`
3. `display_name`
4. `avatar_url`
5. `status`
6. `last_login_at`
7. `created_at`
8. `updated_at`
9. `deleted_at`

索引建议：

1. `unique(email)`
2. `index(status, created_at)`

#### 3.1.2 `auth_identities`

用途：认证身份表，首版支持邮箱登录，为后续扩展手机号、微信登录预留。

核心字段：

1. `id`
2. `user_id`
3. `identity_type`
4. `identity_key`
5. `is_primary`
6. `verified_at`
7. `created_at`
8. `updated_at`

索引建议：

1. `unique(identity_type, identity_key)`
2. `index(user_id)`

#### 3.1.3 `user_sessions`

用途：保存用户登录会话元数据。

核心字段：

1. `id`
2. `user_id`
3. `device_label`
4. `client_ip`
5. `user_agent`
6. `last_active_at`
7. `expires_at`
8. `revoked_at`
9. `created_at`
10. `updated_at`

索引建议：

1. `index(user_id, expires_at)`
2. `index(revoked_at)`

#### 3.1.4 `refresh_tokens`

用途：可撤销 refresh token 存储。

核心字段：

1. `id`
2. `session_id`
3. `user_id`
4. `token_hash`
5. `expires_at`
6. `revoked_at`
7. `rotated_from_id`
8. `created_at`

索引建议：

1. `unique(token_hash)`
2. `index(user_id, expires_at)`
3. `index(session_id)`

#### 3.1.5 `email_verification_codes`

用途：保存邮箱验证码登录过程中的验证码 hash 与尝试状态。

核心字段：

1. `id`
2. `email`
3. `user_id`
4. `code_hash`
5. `expires_at`
6. `used_at`
7. `request_ip`
8. `user_agent`
9. `attempt_count`
10. `created_at`
11. `updated_at`

索引建议：

1. `index(email, expires_at)`
2. `index(user_id)`

实现约束：

1. 不存储明文验证码。
2. 验证码成功使用后写入 `used_at`。
3. 首次登录前 `user_id` 可以为空，登录成功后回填。

### 3.2 授权与外部接入域

#### 3.2.1 `user_authorizations`

用途：保存用户对外部服务的授权。

核心字段：

1. `id`
2. `user_id`
3. `provider_type`
4. `provider_name`
5. `scope`
6. `access_token_encrypted`
7. `refresh_token_encrypted`
8. `token_expires_at`
9. `authorized_at`
10. `revoked_at`
11. `metadata_json`
12. `created_at`
13. `updated_at`
14. `deleted_at`

索引建议：

1. `index(user_id, provider_type)`
2. `unique(user_id, provider_name, deleted_at)`

### 3.3 内容聚合域

#### 3.3.1 `content_items`

用途：统一内容对象主表，覆盖歌曲、播客单集、电台流、专辑入口等业务对象。

核心字段：

1. `id`
2. `content_type`
3. `canonical_title`
4. `subtitle`
5. `album_name`
6. `primary_artist_names`
7. `duration_ms`
8. `language`
9. `cover_url`
10. `playable`
11. `release_date`
12. `metadata_json`
13. `embedding`
14. `created_at`
15. `updated_at`

索引建议：

1. `index(content_type, playable)`
2. `index(language, release_date)`
3. `gin(metadata_json)`
4. `ivfflat/hnsw(embedding)` 视 pgvector 策略而定

#### 3.3.2 `content_provider_mappings`

用途：保存统一内容对象与第三方 Provider 的映射。

核心字段：

1. `id`
2. `content_item_id`
3. `provider_name`
4. `provider_content_id`
5. `provider_content_type`
6. `provider_url`
7. `raw_payload_json`
8. `sync_status`
9. `last_synced_at`
10. `created_at`
11. `updated_at`

索引建议：

1. `unique(provider_name, provider_content_id)`
2. `index(content_item_id)`

### 3.4 音乐库与歌单域

#### 3.4.1 `playlists`

用途：用户自建歌单、AI 生成歌单、今日歌单。

核心字段：

1. `id`
2. `user_id`
3. `title`
4. `description`
5. `playlist_type`
6. `source_type`
7. `cover_url`
8. `is_pinned`
9. `generated_context_json`
10. `created_at`
11. `updated_at`
12. `deleted_at`

索引建议：

1. `index(user_id, playlist_type, created_at)`
2. `index(source_type)`

#### 3.4.2 `playlist_items`

用途：歌单与内容项关系表。

核心字段：

1. `id`
2. `playlist_id`
3. `content_item_id`
4. `position`
5. `added_by_type`
6. `reason_text`
7. `created_at`

索引建议：

1. `unique(playlist_id, position)`
2. `index(playlist_id, content_item_id)`

#### 3.4.3 `favorites`

用途：收藏表。

核心字段：

1. `id`
2. `user_id`
3. `content_item_id`
4. `favorite_type`
5. `created_at`
6. `deleted_at`

索引建议：

1. `unique(user_id, content_item_id, favorite_type, deleted_at)`
2. `index(user_id, created_at)`

### 3.5 行为与反馈域

#### 3.5.1 `playback_events`

用途：记录播放行为。

核心字段：

1. `id`
2. `user_id`
3. `content_item_id`
4. `event_type`
5. `position_ms`
6. `session_id`
7. `context_snapshot_id`
8. `occurred_at`
9. `metadata_json`

索引建议：

1. `index(user_id, occurred_at desc)`
2. `index(content_item_id, occurred_at desc)`
3. `index(session_id)`

#### 3.5.2 `preference_feedback`

用途：保存显式反馈。

核心字段：

1. `id`
2. `user_id`
3. `target_type`
4. `target_id`
5. `feedback_type`
6. `reason_text`
7. `recommendation_result_id`
8. `created_at`

索引建议：

1. `index(user_id, created_at desc)`
2. `index(target_type, target_id)`

### 3.6 画像与上下文域

#### 3.6.1 `taste_profiles`

用途：用户当前长期画像主表。

核心字段：

1. `id`
2. `user_id`
3. `summary_text`
4. `exploration_level`
5. `familiarity_level`
6. `embedding`
7. `version`
8. `generated_at`
9. `created_at`
10. `updated_at`

索引建议：

1. `unique(user_id)`
2. `ivfflat/hnsw(embedding)`

#### 3.6.2 `taste_profile_tags`

用途：画像标签明细表。

核心字段：

1. `id`
2. `taste_profile_id`
3. `tag_type`
4. `tag_value`
5. `weight`
6. `source_type`
7. `is_negative`
8. `created_at`
9. `updated_at`

索引建议：

1. `index(taste_profile_id, tag_type)`
2. `index(tag_value)`

#### 3.6.3 `taste_profile_snapshots`

用途：保存画像版本快照，用于回溯。

核心字段：

1. `id`
2. `user_id`
3. `taste_profile_id`
4. `snapshot_json`
5. `created_at`

索引建议：

1. `index(user_id, created_at desc)`

#### 3.6.4 `context_snapshots`

用途：保存推荐与 AI DJ 使用的上下文快照。

核心字段：

1. `id`
2. `user_id`
3. `timezone`
4. `local_time`
5. `location_text`
6. `weather_json`
7. `calendar_summary_json`
8. `task_label`
9. `mood_label`
10. `created_at`

索引建议：

1. `index(user_id, created_at desc)`

### 3.7 推荐域

#### 3.7.1 `recommendation_results`

用途：记录一次推荐结果。

核心字段：

1. `id`
2. `user_id`
3. `recommendation_type`
4. `context_snapshot_id`
5. `taste_profile_id`
6. `explanation_text`
7. `trace_json`
8. `created_at`

索引建议：

1. `index(user_id, recommendation_type, created_at desc)`
2. `index(context_snapshot_id)`

#### 3.7.2 `recommendation_items`

用途：记录单次推荐中的候选内容。

核心字段：

1. `id`
2. `recommendation_result_id`
3. `content_item_id`
4. `rank`
5. `score`
6. `reason_text`
7. `created_at`

索引建议：

1. `unique(recommendation_result_id, rank)`
2. `index(recommendation_result_id, content_item_id)`

### 3.8 AI 对话与知识域

#### 3.8.1 `chat_sessions`

用途：AI DJ 对话会话主表。

核心字段：

1. `id`
2. `user_id`
3. `title`
4. `session_mode`
5. `last_message_at`
6. `context_snapshot_id`
7. `created_at`
8. `updated_at`
9. `deleted_at`

索引建议：

1. `index(user_id, last_message_at desc)`

#### 3.8.2 `chat_messages`

用途：对话消息明细表。

核心字段：

1. `id`
2. `chat_session_id`
3. `role`
4. `message_type`
5. `content_text`
6. `content_json`
7. `trace_json`
8. `created_at`

索引建议：

1. `index(chat_session_id, created_at)`

#### 3.8.3 `knowledge_traces`

用途：保存知识讲解任务及其摘要结果。

核心字段：

1. `id`
2. `user_id`
3. `chat_session_id`
4. `query_text`
5. `summary_text`
6. `source_count`
7. `created_at`

索引建议：

1. `index(user_id, created_at desc)`
2. `index(chat_session_id)`

#### 3.8.4 `knowledge_sources`

用途：知识讲解使用的来源明细。

核心字段：

1. `id`
2. `knowledge_trace_id`
3. `source_url`
4. `source_title`
5. `snippet_text`
6. `embedding`
7. `created_at`

索引建议：

1. `index(knowledge_trace_id)`
2. `ivfflat/hnsw(embedding)`

### 3.9 任务域

#### 3.9.1 `import_jobs`

用途：歌单/历史导入任务。

核心字段：

1. `id`
2. `user_id`
3. `provider_name`
4. `job_status`
5. `job_type`
6. `input_payload_json`
7. `result_summary_json`
8. `error_text`
9. `started_at`
10. `finished_at`
11. `created_at`
12. `updated_at`

索引建议：

1. `index(user_id, created_at desc)`
2. `index(job_status, created_at)`

#### 3.9.2 `daily_playlist_jobs`

用途：每日歌单生成任务。

核心字段：

1. `id`
2. `user_id`
3. `for_date`
4. `job_status`
5. `playlist_id`
6. `error_text`
7. `created_at`
8. `updated_at`

索引建议：

1. `unique(user_id, for_date)`
2. `index(job_status)`

## 4. 关系总览

1. `users` 1:n `auth_identities`
2. `users` 1:n `user_sessions`
3. `user_sessions` 1:n `refresh_tokens`
4. `users` 1:n `user_authorizations`
5. `users` 1:n `playlists`
6. `playlists` 1:n `playlist_items`
7. `content_items` 1:n `content_provider_mappings`
8. `users` 1:1 `taste_profiles`
9. `taste_profiles` 1:n `taste_profile_tags`
10. `users` 1:n `recommendation_results`
11. `recommendation_results` 1:n `recommendation_items`
12. `users` 1:n `chat_sessions`
13. `chat_sessions` 1:n `chat_messages`
14. `knowledge_traces` 1:n `knowledge_sources`

## 5. Redis、队列与数据库边界

### 5.1 Redis

适合存储：

1. 短期推荐缓存
2. SSE 会话缓冲
3. 限流状态
4. 导入任务中间进度

### 5.2 BullMQ

任务类型建议：

1. 歌单导入
2. 历史记录导入
3. 画像重算
4. 每日歌单生成
5. 内容 embedding 计算
6. 知识摘要生成

### 5.3 PostgreSQL

保留最终业务事实，不把 Redis 当主存储。

## 6. Prisma 落地约束

1. 所有模型名使用 PascalCase，对应表名使用 `@@map("snake_case")`
2. JSON 字段统一命名为 `*_json`
3. 时间字段统一使用 `timestamptz`
4. 所有外键必须显式声明 relation name
5. 所有软删除查询必须在仓储层默认过滤 `deleted_at is null`

## 7. 首版不纳入数据库细化范围

1. 分库分表
2. 完整审计日志仓库
3. 多租户设计
4. 后台运营配置表
5. 实时消息总线持久化表

## 8. 当前默认假设

1. 首版只支持邮箱身份，但身份表预留多种登录方式。
2. `content_items` 采用统一主表，避免业务层绑定内容源差异。
3. 推荐解释、知识 trace、模型 trace 以 JSON 和文本形式先落库，不做复杂标准化拆分。
4. 向量索引的具体参数在实际数据量明确后再调优，但字段和表先预留。
