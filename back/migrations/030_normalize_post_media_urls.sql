UPDATE post_media
SET url = SUBSTRING(url FROM '(/uploads/.*)$')
WHERE url ~* '^https?://(localhost|127\.0\.0\.1|\[::1\])(:[0-9]+)?/uploads/';
