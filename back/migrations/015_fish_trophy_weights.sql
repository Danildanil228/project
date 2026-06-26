ALTER TABLE fish
    ADD COLUMN IF NOT EXISTS trophy_weight_grams INTEGER,
    ADD COLUMN IF NOT EXISTS rare_trophy_weight_grams INTEGER;

ALTER TABLE fish DROP CONSTRAINT IF EXISTS fish_trophy_weight_positive;
ALTER TABLE fish ADD CONSTRAINT fish_trophy_weight_positive
    CHECK (trophy_weight_grams IS NULL OR trophy_weight_grams > 0);

ALTER TABLE fish DROP CONSTRAINT IF EXISTS fish_rare_trophy_weight_positive;
ALTER TABLE fish ADD CONSTRAINT fish_rare_trophy_weight_positive
    CHECK (rare_trophy_weight_grams IS NULL OR rare_trophy_weight_grams > 0);

ALTER TABLE fish DROP CONSTRAINT IF EXISTS fish_trophy_weight_order;
ALTER TABLE fish ADD CONSTRAINT fish_trophy_weight_order
    CHECK (
        trophy_weight_grams IS NULL
        OR rare_trophy_weight_grams IS NULL
        OR rare_trophy_weight_grams >= trophy_weight_grams
    );
