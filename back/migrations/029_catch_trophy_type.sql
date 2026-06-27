ALTER TABLE catch
    ADD COLUMN IF NOT EXISTS trophy_type VARCHAR(20) NOT NULL DEFAULT 'normal';

ALTER TABLE catch DROP CONSTRAINT IF EXISTS catch_trophy_type_valid;
ALTER TABLE catch ADD CONSTRAINT catch_trophy_type_valid
    CHECK (trophy_type IN ('normal', 'trophy', 'rare_trophy'));

CREATE INDEX IF NOT EXISTS catch_trophy_type_idx ON catch (trophy_type, post_version_id);
