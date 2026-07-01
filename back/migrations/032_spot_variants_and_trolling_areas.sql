ALTER TABLE spot
    ADD COLUMN IF NOT EXISTS geometry_type VARCHAR(20) NOT NULL DEFAULT 'point',
    ADD COLUMN IF NOT EXISTS trolling_area JSONB;

ALTER TABLE spot DROP CONSTRAINT IF EXISTS spot_geometry_type_check;
ALTER TABLE spot ADD CONSTRAINT spot_geometry_type_check CHECK (geometry_type IN ('point', 'trolling'));

ALTER TABLE spot DROP CONSTRAINT IF EXISTS spot_trolling_area_check;
ALTER TABLE spot ADD CONSTRAINT spot_trolling_area_check CHECK (
    (geometry_type = 'point' AND trolling_area IS NULL)
    OR
    (geometry_type = 'trolling'
        AND jsonb_typeof(trolling_area) = 'array'
        AND jsonb_array_length(trolling_area) BETWEEN 3 AND 30)
);

CREATE TABLE IF NOT EXISTS spot_variant (
    id BIGSERIAL PRIMARY KEY,
    spot_id BIGINT NOT NULL REFERENCES spot(id) ON DELETE CASCADE,
    name VARCHAR(100),
    fishing_method VARCHAR(20) CHECK (fishing_method IS NULL OR fishing_method IN ('Поплавок', 'Донка', 'Спиннинг', 'Морская', 'Троллинг')),
    description TEXT,
    depth NUMERIC(6, 2) CHECK (depth IS NULL OR depth >= 0),
    clip_distance INT CHECK (clip_distance IS NULL OR clip_distance >= 0),
    order_index INT NOT NULL DEFAULT 0 CHECK (order_index >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (spot_id, order_index)
);

CREATE TABLE IF NOT EXISTS spot_variant_fish (
    variant_id BIGINT NOT NULL REFERENCES spot_variant(id) ON DELETE CASCADE,
    fish_id INT NOT NULL REFERENCES fish(id) ON DELETE RESTRICT,
    PRIMARY KEY (variant_id, fish_id)
);

CREATE TABLE IF NOT EXISTS spot_variant_bait (
    variant_id BIGINT NOT NULL REFERENCES spot_variant(id) ON DELETE CASCADE,
    bait_id INT NOT NULL REFERENCES bait(id) ON DELETE RESTRICT,
    PRIMARY KEY (variant_id, bait_id)
);

CREATE INDEX IF NOT EXISTS spot_variant_spot_idx ON spot_variant (spot_id, order_index);
CREATE INDEX IF NOT EXISTS spot_variant_fish_fish_idx ON spot_variant_fish (fish_id);
CREATE INDEX IF NOT EXISTS spot_variant_bait_bait_idx ON spot_variant_bait (bait_id);

-- Every existing spot becomes a point with one legacy variant. No existing data is discarded.
INSERT INTO spot_variant (spot_id, depth, clip_distance, order_index)
SELECT s.id, s.depth, s.clip_distance, 0
FROM spot s
WHERE NOT EXISTS (SELECT 1 FROM spot_variant sv WHERE sv.spot_id = s.id);

INSERT INTO spot_variant_fish (variant_id, fish_id)
SELECT sv.id, sf.fish_id
FROM spot_fish sf
JOIN spot_variant sv ON sv.spot_id = sf.spot_id AND sv.order_index = 0
ON CONFLICT DO NOTHING;

INSERT INTO spot_variant_bait (variant_id, bait_id)
SELECT sv.id, sb.bait_id
FROM spot_bait sb
JOIN spot_variant sv ON sv.spot_id = sb.spot_id AND sv.order_index = 0
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.enforce_spot_variant_fish_habitat()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM public.spot_variant sv
        JOIN public.spot s ON s.id = sv.spot_id
        JOIN public.waterbody_fish wf ON wf.waterbody_id = s.waterbody_id
        WHERE sv.id = NEW.variant_id
          AND wf.fish_id = NEW.fish_id
    ) THEN
        RAISE EXCEPTION 'Fish does not inhabit the spot waterbody' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS spot_variant_fish_habitat_guard ON spot_variant_fish;
CREATE TRIGGER spot_variant_fish_habitat_guard
BEFORE INSERT OR UPDATE OF variant_id, fish_id ON spot_variant_fish
FOR EACH ROW EXECUTE FUNCTION public.enforce_spot_variant_fish_habitat();

CREATE OR REPLACE FUNCTION public.remove_spot_fish_after_habitat_delete()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM public.spot_fish sf
    USING public.spot s
    WHERE sf.spot_id = s.id
      AND s.waterbody_id = OLD.waterbody_id
      AND sf.fish_id = OLD.fish_id;

    DELETE FROM public.spot_variant_fish svf
    USING public.spot_variant sv, public.spot s
    WHERE svf.variant_id = sv.id
      AND sv.spot_id = s.id
      AND s.waterbody_id = OLD.waterbody_id
      AND svf.fish_id = OLD.fish_id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;
