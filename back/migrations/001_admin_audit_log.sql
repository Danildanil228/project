CREATE TABLE IF NOT EXISTS "adminAuditLog" (
    id TEXT PRIMARY KEY,
    "actorId" TEXT,
    "actorEmail" TEXT,
    "actorRole" TEXT,
    action TEXT NOT NULL,
    "targetUserId" TEXT,
    "targetEmail" TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "adminAuditLog_createdAt_idx"
ON "adminAuditLog" ("createdAt" DESC);

CREATE INDEX IF NOT EXISTS "adminAuditLog_actorId_idx"
ON "adminAuditLog" ("actorId");

CREATE INDEX IF NOT EXISTS "adminAuditLog_targetUserId_idx"
ON "adminAuditLog" ("targetUserId");

CREATE INDEX IF NOT EXISTS "adminAuditLog_action_idx"
ON "adminAuditLog" (action);
