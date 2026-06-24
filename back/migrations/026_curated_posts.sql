-- Curated/community posts: a moderator+ can publish a post that lives in the public feed
-- but renders without a clickable author. The original constraint cascaded post deletion
-- on user removal, which would also wipe curated posts when the moderator leaves; we
-- weaken it to SET NULL so curated content survives staff turnover.

ALTER TABLE post
    ADD COLUMN IF NOT EXISTS is_curated BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS curated_label VARCHAR(60);

ALTER TABLE post ALTER COLUMN author_id DROP NOT NULL;

ALTER TABLE post DROP CONSTRAINT IF EXISTS post_author_id_fkey;
ALTER TABLE post
    ADD CONSTRAINT post_author_id_fkey
    FOREIGN KEY (author_id) REFERENCES "user"(id) ON DELETE SET NULL;

-- A curated post must NEVER lose its identity — if the moderator gets deleted we want
-- the post to remain (author becomes NULL). A non-curated post without an author would
-- be confusing in the user feed, so the API will hide author-less non-curated posts.
-- This check prevents writing a non-curated post with author_id NULL via the service layer.
ALTER TABLE post
    DROP CONSTRAINT IF EXISTS post_author_presence;
ALTER TABLE post
    ADD CONSTRAINT post_author_presence
    CHECK (is_curated OR author_id IS NOT NULL);

-- Partial index — curated posts are rare relative to total posts, so this stays tiny.
CREATE INDEX IF NOT EXISTS post_is_curated_idx ON post (is_curated) WHERE is_curated;
