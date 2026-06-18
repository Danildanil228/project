-- Pinned ("featured") posts: moderators star up to N posts that float to the top of the feed.
ALTER TABLE post ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ;
-- Most recently pinned should appear first within the pinned tier.
CREATE INDEX IF NOT EXISTS post_pinned_idx ON post (pinned_at DESC) WHERE pinned_at IS NOT NULL;
