-- Formulary entries table (mirrors FormularyEntry in prisma/schema.prisma)
-- Source of truth for drug dosing data. NEVER editable by end-users.

CREATE TABLE IF NOT EXISTS formulary_entries (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drug                text UNIQUE NOT NULL,       -- lowercase generic name
  generic_name        text NOT NULL,
  local_names         jsonb NOT NULL DEFAULT '{}',  -- {"my": "…", "id": "…", …}
  indication          text NOT NULL,
  dose                text NOT NULL,
  route               text NOT NULL,              -- IM | IV | oral | sublingual | rectal
  timing              text NOT NULL,
  alternative_dose    text,
  contraindications   jsonb NOT NULL DEFAULT '[]',
  warnings            jsonb NOT NULL DEFAULT '[]',
  source              text NOT NULL,              -- "WHO PCPNC 2023, Section 3.2, Page 47"
  source_chunk_id     text NOT NULL,
  source_url          text NOT NULL,
  who_eml_listed      boolean NOT NULL DEFAULT false,
  clinical_status     text NOT NULL DEFAULT 'UNVERIFIED-SCAFFOLD',
  reviewed_by         text,
  reviewed_at         timestamptz,
  expiry_date         date,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE formulary_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read formulary"
  ON formulary_entries FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can write formulary"
  ON formulary_entries FOR ALL
  TO service_role
  USING (true);

-- Trigger to keep updated_at current
CREATE OR REPLACE FUNCTION update_formulary_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER formulary_updated_at
  BEFORE UPDATE ON formulary_entries
  FOR EACH ROW EXECUTE FUNCTION update_formulary_updated_at();
