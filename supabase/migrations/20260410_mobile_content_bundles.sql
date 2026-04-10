-- Mobile OTA content bundle tracking
-- Each row represents a published and signed content bundle that mobile apps can pull.

CREATE TABLE IF NOT EXISTS mobile_content_bundles (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version       text NOT NULL,           -- e.g. "2026.04.15"
  manifest      jsonb NOT NULL,          -- { docs: [{slug, sha256, url, vertical, title}], embeddings_sha256 }
  signature     text NOT NULL,           -- Ed25519 signature (Base64) of manifest JSON
  published_at  timestamptz NOT NULL DEFAULT now(),
  published_by  text,                    -- admin user who triggered publish
  notes         text
);

-- Only admins can insert/update; all authenticated users can read
ALTER TABLE mobile_content_bundles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read bundles"
  ON mobile_content_bundles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only service role can insert bundles"
  ON mobile_content_bundles FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Only service role can update bundles"
  ON mobile_content_bundles FOR UPDATE
  TO service_role
  USING (true);

-- Index for fast latest-bundle lookup
CREATE INDEX IF NOT EXISTS mobile_content_bundles_published_at_idx
  ON mobile_content_bundles (published_at DESC);
