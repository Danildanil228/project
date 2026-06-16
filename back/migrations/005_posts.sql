-- Posts: aggregate + immutable versions, media, and catches (разнорыбица).

CREATE TABLE IF NOT EXISTS post (
    id SERIAL PRIMARY KEY,
    author_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'pending', 'in_review', 'approved', 'rejected', 'deleted')),
    claimed_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
    claimed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    resubmit_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS post_version (
    id SERIAL PRIMARY KEY,
    post_id INT NOT NULL REFERENCES post(id) ON DELETE CASCADE,
    version_number INT NOT NULL,
    description TEXT,
    waterbody_id INT REFERENCES waterbody(id) ON DELETE SET NULL,
    point VARCHAR(50),
    fishing_method VARCHAR(20) CHECK (fishing_method IN ('Поплавок', 'Донка', 'Спиннинг', 'Морская')),
    income INT CHECK (income IS NULL OR income >= 0),
    fishing_minutes INT CHECK (fishing_minutes IS NULL OR fishing_minutes > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (post_id, version_number)
);

-- current_version_id points at the version shown publicly; added after post_version exists.
ALTER TABLE post ADD COLUMN IF NOT EXISTS current_version_id INT REFERENCES post_version(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS post_media (
    id SERIAL PRIMARY KEY,
    post_version_id INT NOT NULL REFERENCES post_version(id) ON DELETE CASCADE,
    type VARCHAR(10) NOT NULL DEFAULT 'image' CHECK (type IN ('image', 'video')),
    url VARCHAR(255) NOT NULL,
    order_index INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS catch (
    id SERIAL PRIMARY KEY,
    post_version_id INT NOT NULL REFERENCES post_version(id) ON DELETE CASCADE,
    fish_id INT NOT NULL REFERENCES fish(id),
    weight NUMERIC(10, 3) CHECK (weight IS NULL OR weight >= 0),
    quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0)
);

CREATE INDEX IF NOT EXISTS post_author_idx ON post (author_id);
CREATE INDEX IF NOT EXISTS post_status_idx ON post (status);
CREATE INDEX IF NOT EXISTS post_version_post_idx ON post_version (post_id);
CREATE INDEX IF NOT EXISTS post_media_version_idx ON post_media (post_version_id);
CREATE INDEX IF NOT EXISTS catch_version_idx ON catch (post_version_id);
CREATE INDEX IF NOT EXISTS catch_fish_idx ON catch (fish_id);
