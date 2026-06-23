ALTER TABLE post_version
    ADD COLUMN IF NOT EXISTS proposed_spot_id BIGINT REFERENCES spot(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS map_x NUMERIC(7,4),
    ADD COLUMN IF NOT EXISTS map_y NUMERIC(7,4),
    ADD COLUMN IF NOT EXISTS game_coordinate_x NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS game_coordinate_y NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS bait_mode VARCHAR(20) NOT NULL DEFAULT 'common';

ALTER TABLE post_version DROP CONSTRAINT IF EXISTS post_version_bait_mode_check;
ALTER TABLE post_version ADD CONSTRAINT post_version_bait_mode_check CHECK (bait_mode IN ('common', 'per_fish'));
ALTER TABLE post_version DROP CONSTRAINT IF EXISTS post_version_map_coordinates_check;
ALTER TABLE post_version ADD CONSTRAINT post_version_map_coordinates_check CHECK (
    (map_x IS NULL AND map_y IS NULL AND game_coordinate_x IS NULL AND game_coordinate_y IS NULL)
    OR (map_x BETWEEN 0 AND 100 AND map_y BETWEEN 0 AND 100 AND game_coordinate_x IS NOT NULL AND game_coordinate_y IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS post_version_bait (
    id BIGSERIAL PRIMARY KEY,
    post_version_id BIGINT NOT NULL REFERENCES post_version(id) ON DELETE CASCADE,
    fish_id INTEGER REFERENCES fish(id) ON DELETE CASCADE,
    bait_id INTEGER NOT NULL REFERENCES bait(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS post_version_bait_common_unique ON post_version_bait(post_version_id, bait_id) WHERE fish_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS post_version_bait_fish_unique ON post_version_bait(post_version_id, fish_id, bait_id) WHERE fish_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS map_submission (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL UNIQUE REFERENCES post(id) ON DELETE CASCADE,
    post_version_id BIGINT NOT NULL REFERENCES post_version(id) ON DELETE CASCADE,
    proposed_spot_id BIGINT REFERENCES spot(id) ON DELETE SET NULL,
    waterbody_id INTEGER NOT NULL REFERENCES waterbody(id) ON DELETE CASCADE,
    map_x NUMERIC(7,4) NOT NULL CHECK (map_x BETWEEN 0 AND 100),
    map_y NUMERIC(7,4) NOT NULL CHECK (map_y BETWEEN 0 AND 100),
    game_coordinate_x NUMERIC(10,2) NOT NULL,
    game_coordinate_y NUMERIC(10,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    resolved_spot_id BIGINT REFERENCES spot(id) ON DELETE SET NULL,
    reviewed_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
    rejection_reason VARCHAR(1000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS map_submission_target (
    id BIGSERIAL PRIMARY KEY,
    submission_id BIGINT NOT NULL REFERENCES map_submission(id) ON DELETE CASCADE,
    fish_id INTEGER NOT NULL REFERENCES fish(id) ON DELETE CASCADE,
    UNIQUE(submission_id, fish_id)
);
CREATE TABLE IF NOT EXISTS map_submission_target_bait (
    target_id BIGINT NOT NULL REFERENCES map_submission_target(id) ON DELETE CASCADE,
    bait_id INTEGER NOT NULL REFERENCES bait(id) ON DELETE CASCADE,
    PRIMARY KEY(target_id, bait_id)
);

CREATE TABLE IF NOT EXISTS spot_post (
    spot_id BIGINT NOT NULL REFERENCES spot(id) ON DELETE CASCADE,
    post_id BIGINT NOT NULL UNIQUE REFERENCES post(id) ON DELETE CASCADE,
    submission_id BIGINT NOT NULL UNIQUE REFERENCES map_submission(id) ON DELETE CASCADE,
    approved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY(spot_id, post_id)
);

CREATE INDEX IF NOT EXISTS map_submission_status_idx ON map_submission(status, created_at);
CREATE INDEX IF NOT EXISTS spot_post_spot_idx ON spot_post(spot_id, approved_at DESC);
