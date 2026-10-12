-- Company profile, one per company (Settings → Company Profile).
-- Until organizations exist (docs/multi-team-plan.md, phase 1) the company is
-- keyed by owner_user_id: the team manager, or the user without a team.
-- Phase 1 fills org_id (organizations.id) and makes it the key.
CREATE TABLE IF NOT EXISTS company_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL UNIQUE,
  org_id UUID UNIQUE,
  country TEXT NOT NULL CHECK (country ~ '^[A-Z]{2}$'),   -- ISO 3166-1 alpha-2
  legal_name TEXT,
  trade_name TEXT,
  -- Per country, so switching country never deletes values:
  -- {"NL": {"vat": "NL123456789B01", "eori": "NL123456789", "reg": "12345678"}, "BR": {"cnpj": "..."}}
  identifiers JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Register checks written by the EU tools (VIES, EORI), keyed "NL.vat"
  verifications JSONB NOT NULL DEFAULT '{}'::jsonb,
  address JSONB NOT NULL DEFAULT '{}'::jsonb,              -- line1, line2, postal_code, city, region
  contact_name TEXT,
  contact_email TEXT,
  phone_country TEXT,                                      -- ISO code of the dialling code
  phone_number TEXT,                                       -- national number
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only the API (service role) reads and writes this table.
ALTER TABLE company_profiles ENABLE ROW LEVEL SECURITY;
