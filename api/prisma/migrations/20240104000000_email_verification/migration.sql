ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "email_verified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "verification_token" TEXT;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "token_expires_at" TIMESTAMP(3);

-- Mark existing tenants as verified
UPDATE "tenants" SET "email_verified" = true WHERE "email_verified" = false;