-- Rename blob_url → image_url in generations table.
-- The column stored Vercel Blob URLs; now stores Cloudflare R2 URLs.
ALTER TABLE generations RENAME COLUMN blob_url TO image_url;
