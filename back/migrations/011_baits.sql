-- Unified bait and lure reference data. Stable kind codes are translated by clients.

CREATE TABLE IF NOT EXISTS bait (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    kind VARCHAR(32) NOT NULL CHECK (kind IN (
        'natural',
        'prepared',
        'boilie',
        'pellet',
        'artificial_lure',
        'marine',
        'groundbait_component',
        'other'
    )),
    description TEXT,
    photo VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS bait_name_ci_unique ON bait (LOWER(name));
CREATE INDEX IF NOT EXISTS bait_kind_active_idx ON bait (kind, is_active);

