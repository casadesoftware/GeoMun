-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- Add SUPERADMIN to Role enum
ALTER TYPE "Role" ADD VALUE 'SUPERADMIN';

-- Add tenant_id to users
ALTER TABLE "users" ADD COLUMN "tenant_id" UUID;
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add tenant_id to maps
ALTER TABLE "maps" ADD COLUMN "tenant_id" UUID;
ALTER TABLE "maps" ADD CONSTRAINT "maps_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add tenant_id to audit_logs
ALTER TABLE "audit_logs" ADD COLUMN "tenant_id" UUID;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create default tenant and assign existing data
DO $$
DECLARE
  default_tenant_id UUID;
BEGIN
  INSERT INTO "tenants" ("id", "name", "slug", "active", "updated_at")
  VALUES (gen_random_uuid(), 'Default', 'default', true, NOW())
  RETURNING "id" INTO default_tenant_id;

  UPDATE "users" SET "tenant_id" = default_tenant_id WHERE "tenant_id" IS NULL;
  UPDATE "maps" SET "tenant_id" = default_tenant_id WHERE "tenant_id" IS NULL;
  UPDATE "audit_logs" SET "tenant_id" = default_tenant_id WHERE "tenant_id" IS NULL;
END $$;

-- Make tenant_id NOT NULL on maps after backfill
ALTER TABLE "maps" ALTER COLUMN "tenant_id" SET NOT NULL;