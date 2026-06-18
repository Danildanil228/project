ALTER TABLE "adminAuditLog"
    ADD COLUMN IF NOT EXISTS outcome TEXT NOT NULL DEFAULT 'success',
    ADD COLUMN IF NOT EXISTS "requestId" TEXT,
    ADD COLUMN IF NOT EXISTS "ipAddress" TEXT,
    ADD COLUMN IF NOT EXISTS "userAgent" TEXT,
    ADD COLUMN IF NOT EXISTS method TEXT,
    ADD COLUMN IF NOT EXISTS path TEXT;

CREATE INDEX IF NOT EXISTS "adminAuditLog_requestId_idx"
ON "adminAuditLog" ("requestId");

CREATE INDEX IF NOT EXISTS "adminAuditLog_outcome_createdAt_idx"
ON "adminAuditLog" (outcome, "createdAt" DESC);
