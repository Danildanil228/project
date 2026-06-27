CREATE TABLE IF NOT EXISTS "notificationSoundPreference" (
    "userId"      TEXT PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
    "enabled"     BOOLEAN NOT NULL DEFAULT TRUE,
    "sound"       VARCHAR(20) NOT NULL DEFAULT 'default',
    "volume"      NUMERIC(3,2) NOT NULL DEFAULT 0.65,
    "customUrl"   TEXT,
    "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "notificationSoundPreference_sound_check"
        CHECK ("sound" IN ('default', 'soft', 'chime', 'double', 'custom')),
    CONSTRAINT "notificationSoundPreference_volume_check"
        CHECK ("volume" >= 0 AND "volume" <= 1),
    CONSTRAINT "notificationSoundPreference_custom_check"
        CHECK ("sound" <> 'custom' OR "customUrl" IS NOT NULL)
);
