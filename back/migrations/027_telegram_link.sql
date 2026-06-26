-- Maps an internal user (moderator+) to a Telegram chat for push notifications.
-- One Telegram account per user (PRIMARY KEY userId) and one user per chat (UNIQUE chatId),
-- so /start <code> in another tab can't accidentally hijack a different operator's chat.

CREATE TABLE IF NOT EXISTS "telegramLink" (
    "userId"    TEXT PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
    "chatId"    BIGINT NOT NULL,
    "username"  TEXT,
    "linkedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE ("chatId")
);

CREATE INDEX IF NOT EXISTS "telegramLink_chatId_idx" ON "telegramLink" ("chatId");
