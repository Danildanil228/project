-- Bring the rods table in line with what we import from potryasovgame.ru:
--  * fix the existing typo in the category check ("Спининговые" → "Спиннинговые");
--  * allow missing per-category fields (e.g. floats have no power, feeders have no sensitivity);
--  * add the game catalogue link, source URL, and a slot for the 3D model;
--  * widen `photo` so it can hold a full /uploads/rods/... URL.

UPDATE rods SET category = 'Спиннинговые' WHERE category = 'Спининговые';

ALTER TABLE rods DROP CONSTRAINT IF EXISTS rods_category_check;
ALTER TABLE rods ADD CONSTRAINT rods_category_check
    CHECK (category IN ('Спиннинговые', 'Доночные', 'Поплавочные', 'Морские'));

ALTER TABLE rods DROP CONSTRAINT IF EXISTS rods_stroy_check;
-- "Строй" sometimes has values like "Очень быстрый" or empty — relax to a free-form string.

ALTER TABLE rods ALTER COLUMN brend DROP NOT NULL;
ALTER TABLE rods ALTER COLUMN test_down DROP NOT NULL;
ALTER TABLE rods ALTER COLUMN test_up DROP NOT NULL;
ALTER TABLE rods ALTER COLUMN length DROP NOT NULL;
ALTER TABLE rods ALTER COLUMN sensi DROP NOT NULL;
ALTER TABLE rods ALTER COLUMN rig DROP NOT NULL;
ALTER TABLE rods ALTER COLUMN stroy DROP NOT NULL;
ALTER TABLE rods ALTER COLUMN stren DROP NOT NULL;
ALTER TABLE rods ALTER COLUMN lvl DROP NOT NULL;

-- Source data uses combined values like "10-30" or longer formula text — widen narrow columns.
ALTER TABLE rods
    ALTER COLUMN test_down TYPE VARCHAR(50),
    ALTER COLUMN test_up TYPE VARCHAR(50),
    ALTER COLUMN length TYPE VARCHAR(50),
    ALTER COLUMN sensi TYPE VARCHAR(50),
    ALTER COLUMN rig TYPE VARCHAR(50),
    ALTER COLUMN stren TYPE VARCHAR(50),
    ALTER COLUMN stroy TYPE VARCHAR(80),
    ALTER COLUMN bonus_opit TYPE VARCHAR(50),
    ALTER COLUMN bonus_snast TYPE VARCHAR(200),
    ALTER COLUMN bonus_nav TYPE VARCHAR(50),
    ALTER COLUMN bonus_zabros TYPE VARCHAR(50),
    ALTER COLUMN price_ser TYPE VARCHAR(50),
    ALTER COLUMN price_gold TYPE VARCHAR(50),
    ALTER COLUMN photo TYPE VARCHAR(500);

ALTER TABLE rods
    ADD COLUMN IF NOT EXISTS system_id VARCHAR(150),
    ADD COLUMN IF NOT EXISTS source_url TEXT,
    ADD COLUMN IF NOT EXISTS model VARCHAR(500);

CREATE UNIQUE INDEX IF NOT EXISTS rods_system_id_unique
    ON rods (system_id)
    WHERE system_id IS NOT NULL;
