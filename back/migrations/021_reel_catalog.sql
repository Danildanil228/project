-- Fields required by the complete RF4 reel catalog.
ALTER TABLE reels
    ADD COLUMN IF NOT EXISTS test_mod VARCHAR(20),
    ADD COLUMN IF NOT EXISTS capacity_mod VARCHAR(20),
    ADD COLUMN IF NOT EXISTS system_id VARCHAR(150),
    ADD COLUMN IF NOT EXISTS source_url TEXT;

ALTER TABLE reels ALTER COLUMN lvl DROP NOT NULL;
ALTER TABLE reels ALTER COLUMN photo TYPE VARCHAR(500);

CREATE UNIQUE INDEX IF NOT EXISTS reels_system_id_unique
    ON reels (system_id)
    WHERE system_id IS NOT NULL;
