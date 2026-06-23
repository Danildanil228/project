-- Trolling posts span a range from point A to point B on the waterbody map.
-- The original point columns become "point A"; we add a second set for "point B".
-- Both pairs must be NULL together or set together; "single point" mode = only A.

ALTER TABLE post_version
    ADD COLUMN IF NOT EXISTS map_x2 NUMERIC(7,4),
    ADD COLUMN IF NOT EXISTS map_y2 NUMERIC(7,4),
    ADD COLUMN IF NOT EXISTS game_coordinate_x2 NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS game_coordinate_y2 NUMERIC(10,2);

ALTER TABLE post_version DROP CONSTRAINT IF EXISTS post_version_map_coordinates2_check;
ALTER TABLE post_version ADD CONSTRAINT post_version_map_coordinates2_check CHECK (
    (map_x2 IS NULL AND map_y2 IS NULL AND game_coordinate_x2 IS NULL AND game_coordinate_y2 IS NULL)
    OR (map_x2 BETWEEN 0 AND 100 AND map_y2 BETWEEN 0 AND 100 AND game_coordinate_x2 IS NOT NULL AND game_coordinate_y2 IS NOT NULL)
);

-- A trolling-end point only makes sense if a start point is also set.
ALTER TABLE post_version DROP CONSTRAINT IF EXISTS post_version_trolling_requires_start_check;
ALTER TABLE post_version ADD CONSTRAINT post_version_trolling_requires_start_check CHECK (
    map_x2 IS NULL OR map_x IS NOT NULL
);
