-- Engagement: comments, reactions (like/dislike), reports, and in-app notifications.

CREATE TABLE IF NOT EXISTS comment (
    id SERIAL PRIMARY KEY,
    post_id INT NOT NULL REFERENCES post(id) ON DELETE CASCADE,
    author_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One reaction per (post, user); value 1 = like, -1 = dislike. Toggling/switching updates the row.
CREATE TABLE IF NOT EXISTS reaction (
    post_id INT NOT NULL REFERENCES post(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    value SMALLINT NOT NULL CHECK (value IN (1, -1)),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (post_id, user_id)
);

-- One report per (post, reporter) to limit spam; status tracks moderator handling.
CREATE TABLE IF NOT EXISTS report (
    id SERIAL PRIMARY KEY,
    post_id INT NOT NULL REFERENCES post(id) ON DELETE CASCADE,
    reporter_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    UNIQUE (post_id, reporter_id)
);

CREATE TABLE IF NOT EXISTS notification (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    type VARCHAR(30) NOT NULL,
    post_id INT REFERENCES post(id) ON DELETE CASCADE,
    actor_id TEXT REFERENCES "user"(id) ON DELETE SET NULL,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS comment_post_idx ON comment (post_id, created_at);
CREATE INDEX IF NOT EXISTS comment_author_idx ON comment (author_id);
CREATE INDEX IF NOT EXISTS reaction_post_idx ON reaction (post_id);
CREATE INDEX IF NOT EXISTS report_post_idx ON report (post_id);
CREATE INDEX IF NOT EXISTS report_status_idx ON report (status);
CREATE INDEX IF NOT EXISTS notification_user_idx ON notification (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notification_unread_idx ON notification (user_id) WHERE read_at IS NULL;
