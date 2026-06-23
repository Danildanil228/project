-- Reels store 3D model URLs (with host) now, so the legacy VARCHAR(100) limit is too tight.
ALTER TABLE reels ALTER COLUMN model TYPE VARCHAR(500);
