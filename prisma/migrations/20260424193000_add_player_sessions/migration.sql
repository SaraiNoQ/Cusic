-- CreateTable
CREATE TABLE "player_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "current_content_item_id" TEXT,
    "active_index" INTEGER NOT NULL DEFAULT 0,
    "position_ms" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "player_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_queue_items" (
    "id" TEXT NOT NULL,
    "player_session_id" TEXT NOT NULL,
    "content_item_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_queue_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "player_sessions_user_id_key" ON "player_sessions"("user_id");

-- CreateIndex
CREATE INDEX "player_sessions_updated_at_idx" ON "player_sessions"("updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "player_queue_items_player_session_id_position_key" ON "player_queue_items"("player_session_id", "position");

-- CreateIndex
CREATE INDEX "player_queue_items_player_session_id_idx" ON "player_queue_items"("player_session_id");

-- CreateIndex
CREATE INDEX "player_queue_items_content_item_id_idx" ON "player_queue_items"("content_item_id");

-- AddForeignKey
ALTER TABLE "player_sessions" ADD CONSTRAINT "player_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_sessions" ADD CONSTRAINT "player_sessions_current_content_item_id_fkey" FOREIGN KEY ("current_content_item_id") REFERENCES "content_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_queue_items" ADD CONSTRAINT "player_queue_items_player_session_id_fkey" FOREIGN KEY ("player_session_id") REFERENCES "player_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_queue_items" ADD CONSTRAINT "player_queue_items_content_item_id_fkey" FOREIGN KEY ("content_item_id") REFERENCES "content_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
