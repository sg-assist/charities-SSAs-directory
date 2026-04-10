-- Clinical source tracking for mobile knowledge base
-- Maps to the ClinicalSource model in prisma/schema.prisma

CREATE TABLE IF NOT EXISTS clinical_sources (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                text UNIQUE NOT NULL,       -- e.g. "who-pcpnc-2023"
  title               text NOT NULL,              -- "WHO PCPNC 2023"
  edition             text NOT NULL,
  pub_year            int NOT NULL,
  sha256              text NOT NULL,              -- SHA-256 of source PDF
  redistribution_ok   boolean NOT NULL DEFAULT false,
  redistribution_notes text,
  clinical_reviewer   text,
  reviewed_at         timestamptz,
  expiry_date         date,
  source_url          text,
  vertical            text NOT NULL,              -- CLINICAL | MISP | CHW | FORMULARY | MOH_ISO
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE clinical_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read clinical sources"
  ON clinical_sources FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can write clinical sources"
  ON clinical_sources FOR ALL
  TO service_role
  USING (true);
