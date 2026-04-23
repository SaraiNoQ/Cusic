CREATE EXTENSION IF NOT EXISTS vector;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "IdentityType" AS ENUM ('EMAIL', 'PHONE', 'WECHAT');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED', 'PENDING');

-- CreateEnum
CREATE TYPE "ProviderType" AS ENUM ('MUSIC', 'PODCAST', 'RADIO', 'CALENDAR', 'WEATHER', 'LLM', 'VOICE', 'SEARCH');

-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('TRACK', 'PODCAST_EPISODE', 'RADIO_STREAM', 'ALBUM');

-- CreateEnum
CREATE TYPE "PlaylistType" AS ENUM ('USER_CREATED', 'AI_GENERATED', 'DAILY', 'IMPORTED');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('USER', 'AI', 'IMPORT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('PLAY_STARTED', 'PLAY_PAUSED', 'PLAY_COMPLETED', 'SKIPPED', 'SEEKED');

-- CreateEnum
CREATE TYPE "FeedbackType" AS ENUM ('LIKE', 'DISLIKE', 'MORE_LIKE_THIS', 'LESS_LIKE_THIS');

-- CreateEnum
CREATE TYPE "RecommendationType" AS ENUM ('NOW', 'DAILY', 'SEARCH_ASSIST', 'AI_DJ');

-- CreateEnum
CREATE TYPE "ChatRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM', 'TOOL');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'TTS', 'ACTION', 'TRACE');

-- CreateEnum
CREATE TYPE "SessionMode" AS ENUM ('TEXT', 'VOICE', 'MIXED');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('PLAYLIST_IMPORT', 'HISTORY_IMPORT', 'DAILY_PLAYLIST', 'PROFILE_REFRESH', 'KNOWLEDGE_SUMMARY');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "display_name" TEXT,
    "avatar_url" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING',
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_identities" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "identity_type" "IdentityType" NOT NULL,
    "identity_key" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "auth_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "device_label" TEXT,
    "client_ip" TEXT,
    "user_agent" TEXT,
    "last_active_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "rotated_from_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_authorizations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider_type" "ProviderType" NOT NULL,
    "provider_name" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "access_token_encrypted" TEXT,
    "refresh_token_encrypted" TEXT,
    "token_expires_at" TIMESTAMPTZ(6),
    "authorized_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(6),
    "metadata_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "user_authorizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_items" (
    "id" TEXT NOT NULL,
    "content_type" "ContentType" NOT NULL,
    "canonical_title" TEXT NOT NULL,
    "subtitle" TEXT,
    "album_name" TEXT,
    "primary_artist_names" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "duration_ms" INTEGER,
    "language" TEXT,
    "cover_url" TEXT,
    "playable" BOOLEAN NOT NULL DEFAULT true,
    "release_date" DATE,
    "metadata_json" JSONB,
    "embedding" vector,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "content_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_provider_mappings" (
    "id" TEXT NOT NULL,
    "content_item_id" TEXT NOT NULL,
    "provider_name" TEXT NOT NULL,
    "provider_content_id" TEXT NOT NULL,
    "provider_content_type" TEXT NOT NULL,
    "provider_url" TEXT,
    "raw_payload_json" JSONB,
    "sync_status" TEXT NOT NULL DEFAULT 'READY',
    "last_synced_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "content_provider_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "playlists" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "playlist_type" "PlaylistType" NOT NULL,
    "source_type" "SourceType" NOT NULL,
    "cover_url" TEXT,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "generated_context_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "playlists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "playlist_items" (
    "id" TEXT NOT NULL,
    "playlist_id" TEXT NOT NULL,
    "content_item_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "added_by_type" "SourceType" NOT NULL,
    "reason_text" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "playlist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favorites" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "content_item_id" TEXT NOT NULL,
    "favorite_type" "ContentType" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "playback_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "content_item_id" TEXT NOT NULL,
    "event_type" "EventType" NOT NULL,
    "position_ms" INTEGER,
    "session_id" TEXT,
    "context_snapshot_id" TEXT,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "metadata_json" JSONB,

    CONSTRAINT "playback_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "preference_feedback" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "feedback_type" "FeedbackType" NOT NULL,
    "reason_text" TEXT,
    "recommendation_result_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "preference_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "taste_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "summary_text" TEXT NOT NULL,
    "exploration_level" TEXT NOT NULL,
    "familiarity_level" TEXT NOT NULL,
    "embedding" vector,
    "version" INTEGER NOT NULL DEFAULT 1,
    "generated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "taste_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "taste_profile_tags" (
    "id" TEXT NOT NULL,
    "taste_profile_id" TEXT NOT NULL,
    "tag_type" TEXT NOT NULL,
    "tag_value" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "source_type" "SourceType" NOT NULL,
    "is_negative" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "taste_profile_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "taste_profile_snapshots" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "taste_profile_id" TEXT NOT NULL,
    "snapshot_json" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "taste_profile_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "context_snapshots" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "local_time" TIMESTAMPTZ(6) NOT NULL,
    "location_text" TEXT,
    "weather_json" JSONB,
    "calendar_summary_json" JSONB,
    "task_label" TEXT,
    "mood_label" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "context_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendation_results" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "recommendation_type" "RecommendationType" NOT NULL,
    "context_snapshot_id" TEXT,
    "taste_profile_id" TEXT,
    "explanation_text" TEXT NOT NULL,
    "trace_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendation_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendation_items" (
    "id" TEXT NOT NULL,
    "recommendation_result_id" TEXT NOT NULL,
    "content_item_id" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "reason_text" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendation_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT,
    "session_mode" "SessionMode" NOT NULL,
    "last_message_at" TIMESTAMPTZ(6),
    "context_snapshot_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "chat_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "chat_session_id" TEXT NOT NULL,
    "role" "ChatRole" NOT NULL,
    "message_type" "MessageType" NOT NULL,
    "content_text" TEXT,
    "content_json" JSONB,
    "trace_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_traces" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "chat_session_id" TEXT,
    "query_text" TEXT NOT NULL,
    "summary_text" TEXT NOT NULL,
    "source_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_traces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_sources" (
    "id" TEXT NOT NULL,
    "knowledge_trace_id" TEXT NOT NULL,
    "source_url" TEXT NOT NULL,
    "source_title" TEXT NOT NULL,
    "snippet_text" TEXT,
    "embedding" vector,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_jobs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider_name" TEXT NOT NULL,
    "job_status" "JobStatus" NOT NULL,
    "job_type" "JobType" NOT NULL,
    "input_payload_json" JSONB,
    "result_summary_json" JSONB,
    "error_text" TEXT,
    "started_at" TIMESTAMPTZ(6),
    "finished_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_playlist_jobs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "for_date" DATE NOT NULL,
    "job_status" "JobStatus" NOT NULL,
    "playlist_id" TEXT,
    "error_text" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "daily_playlist_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_status_created_at_idx" ON "users"("status", "created_at");

-- CreateIndex
CREATE INDEX "auth_identities_user_id_idx" ON "auth_identities"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "auth_identities_identity_type_identity_key_key" ON "auth_identities"("identity_type", "identity_key");

-- CreateIndex
CREATE INDEX "user_sessions_user_id_expires_at_idx" ON "user_sessions"("user_id", "expires_at");

-- CreateIndex
CREATE INDEX "user_sessions_revoked_at_idx" ON "user_sessions"("revoked_at");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_expires_at_idx" ON "refresh_tokens"("user_id", "expires_at");

-- CreateIndex
CREATE INDEX "refresh_tokens_session_id_idx" ON "refresh_tokens"("session_id");

-- CreateIndex
CREATE INDEX "user_authorizations_user_id_provider_type_idx" ON "user_authorizations"("user_id", "provider_type");

-- CreateIndex
CREATE INDEX "content_items_content_type_playable_idx" ON "content_items"("content_type", "playable");

-- CreateIndex
CREATE INDEX "content_items_language_release_date_idx" ON "content_items"("language", "release_date");

-- CreateIndex
CREATE INDEX "content_provider_mappings_content_item_id_idx" ON "content_provider_mappings"("content_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "content_provider_mappings_provider_name_provider_content_id_key" ON "content_provider_mappings"("provider_name", "provider_content_id");

-- CreateIndex
CREATE INDEX "playlists_user_id_playlist_type_created_at_idx" ON "playlists"("user_id", "playlist_type", "created_at");

-- CreateIndex
CREATE INDEX "playlists_source_type_idx" ON "playlists"("source_type");

-- CreateIndex
CREATE INDEX "playlist_items_playlist_id_content_item_id_idx" ON "playlist_items"("playlist_id", "content_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "playlist_items_playlist_id_position_key" ON "playlist_items"("playlist_id", "position");

-- CreateIndex
CREATE INDEX "favorites_user_id_created_at_idx" ON "favorites"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "playback_events_user_id_occurred_at_idx" ON "playback_events"("user_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "playback_events_content_item_id_occurred_at_idx" ON "playback_events"("content_item_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "playback_events_session_id_idx" ON "playback_events"("session_id");

-- CreateIndex
CREATE INDEX "preference_feedback_user_id_created_at_idx" ON "preference_feedback"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "preference_feedback_target_type_target_id_idx" ON "preference_feedback"("target_type", "target_id");

-- CreateIndex
CREATE UNIQUE INDEX "taste_profiles_user_id_key" ON "taste_profiles"("user_id");

-- CreateIndex
CREATE INDEX "taste_profile_tags_taste_profile_id_tag_type_idx" ON "taste_profile_tags"("taste_profile_id", "tag_type");

-- CreateIndex
CREATE INDEX "taste_profile_tags_tag_value_idx" ON "taste_profile_tags"("tag_value");

-- CreateIndex
CREATE INDEX "taste_profile_snapshots_user_id_created_at_idx" ON "taste_profile_snapshots"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "context_snapshots_user_id_created_at_idx" ON "context_snapshots"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "recommendation_results_user_id_recommendation_type_created__idx" ON "recommendation_results"("user_id", "recommendation_type", "created_at" DESC);

-- CreateIndex
CREATE INDEX "recommendation_results_context_snapshot_id_idx" ON "recommendation_results"("context_snapshot_id");

-- CreateIndex
CREATE INDEX "recommendation_items_recommendation_result_id_content_item__idx" ON "recommendation_items"("recommendation_result_id", "content_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "recommendation_items_recommendation_result_id_rank_key" ON "recommendation_items"("recommendation_result_id", "rank");

-- CreateIndex
CREATE INDEX "chat_sessions_user_id_last_message_at_idx" ON "chat_sessions"("user_id", "last_message_at" DESC);

-- CreateIndex
CREATE INDEX "chat_messages_chat_session_id_created_at_idx" ON "chat_messages"("chat_session_id", "created_at");

-- CreateIndex
CREATE INDEX "knowledge_traces_user_id_created_at_idx" ON "knowledge_traces"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "knowledge_traces_chat_session_id_idx" ON "knowledge_traces"("chat_session_id");

-- CreateIndex
CREATE INDEX "knowledge_sources_knowledge_trace_id_idx" ON "knowledge_sources"("knowledge_trace_id");

-- CreateIndex
CREATE INDEX "import_jobs_user_id_created_at_idx" ON "import_jobs"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "import_jobs_job_status_created_at_idx" ON "import_jobs"("job_status", "created_at");

-- CreateIndex
CREATE INDEX "daily_playlist_jobs_job_status_idx" ON "daily_playlist_jobs"("job_status");

-- CreateIndex
CREATE UNIQUE INDEX "daily_playlist_jobs_user_id_for_date_key" ON "daily_playlist_jobs"("user_id", "for_date");

-- AddForeignKey
ALTER TABLE "auth_identities" ADD CONSTRAINT "auth_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "user_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_authorizations" ADD CONSTRAINT "user_authorizations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_provider_mappings" ADD CONSTRAINT "content_provider_mappings_content_item_id_fkey" FOREIGN KEY ("content_item_id") REFERENCES "content_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playlists" ADD CONSTRAINT "playlists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playlist_items" ADD CONSTRAINT "playlist_items_playlist_id_fkey" FOREIGN KEY ("playlist_id") REFERENCES "playlists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playlist_items" ADD CONSTRAINT "playlist_items_content_item_id_fkey" FOREIGN KEY ("content_item_id") REFERENCES "content_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_content_item_id_fkey" FOREIGN KEY ("content_item_id") REFERENCES "content_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playback_events" ADD CONSTRAINT "playback_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playback_events" ADD CONSTRAINT "playback_events_content_item_id_fkey" FOREIGN KEY ("content_item_id") REFERENCES "content_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playback_events" ADD CONSTRAINT "playback_events_context_snapshot_id_fkey" FOREIGN KEY ("context_snapshot_id") REFERENCES "context_snapshots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preference_feedback" ADD CONSTRAINT "preference_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preference_feedback" ADD CONSTRAINT "preference_feedback_recommendation_result_id_fkey" FOREIGN KEY ("recommendation_result_id") REFERENCES "recommendation_results"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "taste_profiles" ADD CONSTRAINT "taste_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "taste_profile_tags" ADD CONSTRAINT "taste_profile_tags_taste_profile_id_fkey" FOREIGN KEY ("taste_profile_id") REFERENCES "taste_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "taste_profile_snapshots" ADD CONSTRAINT "taste_profile_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "taste_profile_snapshots" ADD CONSTRAINT "taste_profile_snapshots_taste_profile_id_fkey" FOREIGN KEY ("taste_profile_id") REFERENCES "taste_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "context_snapshots" ADD CONSTRAINT "context_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_results" ADD CONSTRAINT "recommendation_results_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_results" ADD CONSTRAINT "recommendation_results_context_snapshot_id_fkey" FOREIGN KEY ("context_snapshot_id") REFERENCES "context_snapshots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_results" ADD CONSTRAINT "recommendation_results_taste_profile_id_fkey" FOREIGN KEY ("taste_profile_id") REFERENCES "taste_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_items" ADD CONSTRAINT "recommendation_items_recommendation_result_id_fkey" FOREIGN KEY ("recommendation_result_id") REFERENCES "recommendation_results"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_items" ADD CONSTRAINT "recommendation_items_content_item_id_fkey" FOREIGN KEY ("content_item_id") REFERENCES "content_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_context_snapshot_id_fkey" FOREIGN KEY ("context_snapshot_id") REFERENCES "context_snapshots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_chat_session_id_fkey" FOREIGN KEY ("chat_session_id") REFERENCES "chat_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_traces" ADD CONSTRAINT "knowledge_traces_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_traces" ADD CONSTRAINT "knowledge_traces_chat_session_id_fkey" FOREIGN KEY ("chat_session_id") REFERENCES "chat_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_sources" ADD CONSTRAINT "knowledge_sources_knowledge_trace_id_fkey" FOREIGN KEY ("knowledge_trace_id") REFERENCES "knowledge_traces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_playlist_jobs" ADD CONSTRAINT "daily_playlist_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_playlist_jobs" ADD CONSTRAINT "daily_playlist_jobs_playlist_id_fkey" FOREIGN KEY ("playlist_id") REFERENCES "playlists"("id") ON DELETE SET NULL ON UPDATE CASCADE;

