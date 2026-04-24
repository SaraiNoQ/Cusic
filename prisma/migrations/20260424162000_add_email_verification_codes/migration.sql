CREATE TABLE "email_verification_codes" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "user_id" TEXT,
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "request_ip" TEXT,
    "user_agent" TEXT,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "email_verification_codes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "email_verification_codes_email_expires_at_idx" ON "email_verification_codes"("email", "expires_at");
CREATE INDEX "email_verification_codes_user_id_idx" ON "email_verification_codes"("user_id");

ALTER TABLE "email_verification_codes" ADD CONSTRAINT "email_verification_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
