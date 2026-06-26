ALTER TABLE waterbody
    ADD COLUMN IF NOT EXISTS coordinate_min_x NUMERIC(8, 2),
    ADD COLUMN IF NOT EXISTS coordinate_min_y NUMERIC(8, 2),
    ADD COLUMN IF NOT EXISTS coordinate_max_x NUMERIC(8, 2),
    ADD COLUMN IF NOT EXISTS coordinate_max_y NUMERIC(8, 2);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'waterbody_coordinate_bounds_check') THEN
        ALTER TABLE waterbody ADD CONSTRAINT waterbody_coordinate_bounds_check CHECK (
            (coordinate_min_x IS NULL AND coordinate_min_y IS NULL AND coordinate_max_x IS NULL AND coordinate_max_y IS NULL)
            OR
            (coordinate_min_x IS NOT NULL AND coordinate_min_y IS NOT NULL AND coordinate_max_x IS NOT NULL AND coordinate_max_y IS NOT NULL
             AND coordinate_max_x > coordinate_min_x AND coordinate_max_y > coordinate_min_y)
        );
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS spot (
    id BIGSERIAL PRIMARY KEY,
    waterbody_id INT NOT NULL REFERENCES waterbody(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    map_x NUMERIC(5, 2) NOT NULL CHECK (map_x BETWEEN 0 AND 100),
    map_y NUMERIC(5, 2) NOT NULL CHECK (map_y BETWEEN 0 AND 100),
    game_coordinate_x NUMERIC(8, 2),
    game_coordinate_y NUMERIC(8, 2),
    depth NUMERIC(6, 2) CHECK (depth IS NULL OR depth >= 0),
    clip_distance INT CHECK (clip_distance IS NULL OR clip_distance >= 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS spot_fish (
    spot_id BIGINT NOT NULL REFERENCES spot(id) ON DELETE CASCADE,
    fish_id INT NOT NULL REFERENCES fish(id) ON DELETE RESTRICT,
    PRIMARY KEY (spot_id, fish_id)
);

CREATE TABLE IF NOT EXISTS spot_bait (
    spot_id BIGINT NOT NULL REFERENCES spot(id) ON DELETE CASCADE,
    bait_id INT NOT NULL REFERENCES bait(id) ON DELETE RESTRICT,
    PRIMARY KEY (spot_id, bait_id)
);

CREATE INDEX IF NOT EXISTS spot_waterbody_active_idx ON spot (waterbody_id, is_active);
CREATE INDEX IF NOT EXISTS spot_fish_fish_idx ON spot_fish (fish_id);
CREATE INDEX IF NOT EXISTS spot_bait_bait_idx ON spot_bait (bait_id);
