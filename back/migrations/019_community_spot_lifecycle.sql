ALTER TABLE spot
    ADD COLUMN IF NOT EXISTS is_community BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS spot_community_active_idx ON spot(is_community, is_active);
