-- Phase A: simplify catch (no weight, no quantity) and track post views.

ALTER TABLE catch DROP COLUMN IF EXISTS weight;
ALTER TABLE catch DROP COLUMN IF EXISTS quantity;

ALTER TABLE post ADD COLUMN IF NOT EXISTS view_count INT NOT NULL DEFAULT 0;
