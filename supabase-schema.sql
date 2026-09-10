-- ============================================
-- FreightWizard Database Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- Clean up existing tables (optional - comment out if you want to keep data)
DROP TABLE IF EXISTS email_analysis CASCADE;
DROP TABLE IF EXISTS user_preferences CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- ============================================
-- PROFILES TABLE
-- ============================================
CREATE TABLE profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  theme TEXT DEFAULT 'dark',
  language TEXT DEFAULT 'en',
  gmail_connected BOOLEAN DEFAULT false,
  gmail_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- USER PREFERENCES TABLE
-- ============================================
CREATE TABLE user_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  theme TEXT DEFAULT 'dark',
  language TEXT DEFAULT 'en',
  auto_analyze BOOLEAN DEFAULT true,
  email_notifications BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ============================================
-- EMAIL ANALYSIS TABLE
-- ============================================
CREATE TABLE email_analysis (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email_id TEXT NOT NULL UNIQUE,
  user_id TEXT,
  intent TEXT,
  priority TEXT,
  mode TEXT,
  pol TEXT,
  pod TEXT,
  incoterm TEXT,
  cargo_type TEXT,
  container_type TEXT,
  container_count INTEGER,
  weight_kg DECIMAL,
  booking_number TEXT,
  container_number TEXT,
  vessel_name TEXT,
  eta TIMESTAMPTZ,
  missing_info JSONB DEFAULT '[]',
  summary TEXT,
  suggested_reply TEXT,
  confidence_score DECIMAL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SHIPMENTS TABLE
-- Pending AI suggestions are rows with approved=false.
-- update_target_id set = suggested status/field update to an existing
-- shipment; update_target_id null = suggested brand-new shipment.
-- ============================================
CREATE TABLE IF NOT EXISTS shipments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'inquiry',
  reference TEXT,
  customer TEXT,
  origin TEXT,
  destination TEXT,
  mode TEXT,
  commodity TEXT,
  weight TEXT,
  container TEXT,
  incoterm TEXT,
  eta TEXT,
  etd TEXT,
  carrier TEXT,
  notes TEXT,
  booking_number TEXT,
  bl_number TEXT,
  email_id TEXT,
  email_subject TEXT,
  ai_generated BOOLEAN DEFAULT false,
  approved BOOLEAN DEFAULT true,
  update_target_id UUID REFERENCES shipments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- QUOTES TABLE
-- `charges` (JSONB array of {name, amount}) is not part of the originally
-- requested column list, but is required to persist the per-line charges
-- breakdown so a saved/sent quote can be reopened and edited later instead
-- of only keeping the summed sell_rate.
-- ============================================
CREATE TABLE IF NOT EXISTS quotes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT,
  email_id TEXT,
  email_subject TEXT,
  customer_name TEXT,
  customer_email TEXT,
  origin TEXT,
  destination TEXT,
  mode TEXT,
  commodity TEXT,
  container_type TEXT,
  weight TEXT,
  incoterm TEXT,
  carrier TEXT,
  sell_rate NUMERIC,
  currency TEXT DEFAULT 'USD',
  transit_time TEXT,
  validity_date DATE,
  notes TEXT,
  charges JSONB DEFAULT '[]',
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- quotes already existed before `carrier` was added — ALTER covers existing installs:
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS carrier TEXT;

-- ============================================
-- CUSTOMER PORTALS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS customer_portals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token TEXT UNIQUE NOT NULL,
  shipment_id UUID REFERENCES shipments(id) ON DELETE CASCADE,
  session_id TEXT,
  title TEXT,
  show_carrier BOOLEAN DEFAULT false,
  show_rate BOOLEAN DEFAULT false,
  show_documents BOOLEAN DEFAULT false,
  message TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- ============================================
-- TERMINAL49 CONTAINER TRACKING
-- Adds live-tracking columns to the existing `shipments` table (ALTER, not
-- CREATE, since shipments already exists) plus a `container_number` column —
-- not in the original shipments schema, where `container` stores the
-- container TYPE (e.g. "1x40HC"), not the actual container NUMBER Terminal49
-- tracks by (e.g. "MSCU1234567"). Needed so the tracked number persists.
-- ============================================
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS container_number TEXT;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS t49_tracking_request_id TEXT;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS t49_shipment_id TEXT;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS t49_status TEXT;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS t49_vessel TEXT;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS t49_voyage TEXT;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS t49_pol_eta TIMESTAMPTZ;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS t49_pod_eta TIMESTAMPTZ;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS t49_last_event TEXT;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS t49_last_event_at TIMESTAMPTZ;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS t49_tracking_active BOOLEAN DEFAULT false;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS t49_raw JSONB;

-- ============================================
-- SHIPMENT EVENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS shipment_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shipment_id UUID REFERENCES shipments(id) ON DELETE CASCADE,
  source TEXT,
  event_type TEXT,
  description TEXT,
  location TEXT,
  event_at TIMESTAMPTZ,
  raw JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TENANT INTEGRATIONS (Brazil / SERPRO) — table predates this schema file
-- and already exists live; this CREATE is a documented reconstruction for
-- fresh installs (IF NOT EXISTS is a no-op against the existing database).
-- The three ALTERs below add the new RADAR/MAPA compliance fields requested
-- for the Country Integrations feature, alongside the existing SERPRO ones.
-- ============================================
CREATE TABLE IF NOT EXISTS tenant_integrations (
  tenant_id UUID PRIMARY KEY,
  cnpj TEXT, company_name TEXT, trade_name TEXT, country TEXT DEFAULT 'Brazil',
  contact_name TEXT, contact_email TEXT, contact_phone TEXT,
  serpro_client_id TEXT, serpro_client_secret TEXT, serpro_certificate TEXT, serpro_cert_password TEXT,
  serpro_cert_cnpj TEXT, serpro_environment TEXT DEFAULT 'sandbox', serpro_status TEXT DEFAULT 'unconfigured',
  serpro_cert_expiry TIMESTAMPTZ,
  auto_request_missing BOOLEAN DEFAULT false, missing_data_template TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE tenant_integrations ADD COLUMN IF NOT EXISTS radar_status TEXT;
ALTER TABLE tenant_integrations ADD COLUMN IF NOT EXISTS mapa_enabled BOOLEAN DEFAULT false;
ALTER TABLE tenant_integrations ADD COLUMN IF NOT EXISTS mapa_registration_number TEXT;

-- ============================================
-- COUNTRY INTEGRATIONS (Netherlands / USA / EU — BYOC credentials)
-- Brazil/SERPRO deliberately stays on tenant_integrations above (existing,
-- untouched) rather than being migrated here, per "do not remove or replace
-- the existing Brazil section."
-- ============================================
CREATE TABLE IF NOT EXISTS country_integrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT,
  country_code TEXT,
  integration_key TEXT,
  api_key TEXT,
  api_secret TEXT,
  extra_fields JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, country_code, integration_key)
);

-- ============================================
-- RATE CARDS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS rate_cards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT,
  origin TEXT,
  destination TEXT,
  mode TEXT,
  carrier TEXT,
  container_type TEXT,
  buy_rate NUMERIC,
  sell_rate NUMERIC,
  currency TEXT DEFAULT 'USD',
  transit_time TEXT,
  validity_start DATE,
  validity_end DATE,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SUBSCRIPTIONS TABLE (Stripe billing)
-- ============================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT,
  user_email TEXT UNIQUE NOT NULL,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  plan TEXT DEFAULT 'trial',
  status TEXT DEFAULT 'trialing',
  trial_analyses_used INT DEFAULT 0,
  trial_started_at TIMESTAMPTZ DEFAULT NOW(),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_email_analysis_email_id ON email_analysis(email_id);
CREATE INDEX idx_email_analysis_user_id ON email_analysis(user_id);
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_shipments_user_id ON shipments(user_id);
CREATE INDEX IF NOT EXISTS idx_shipments_reference ON shipments(reference);
CREATE INDEX IF NOT EXISTS idx_shipments_container ON shipments(container);
CREATE INDEX IF NOT EXISTS idx_quotes_session_id ON quotes(session_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
CREATE INDEX IF NOT EXISTS idx_customer_portals_token ON customer_portals(token);
CREATE INDEX IF NOT EXISTS idx_customer_portals_shipment_id ON customer_portals(shipment_id);
CREATE INDEX IF NOT EXISTS idx_customer_portals_session_id ON customer_portals(session_id);
CREATE INDEX IF NOT EXISTS idx_shipments_t49_tracking_request_id ON shipments(t49_tracking_request_id);
CREATE INDEX IF NOT EXISTS idx_shipments_t49_shipment_id ON shipments(t49_shipment_id);
CREATE INDEX IF NOT EXISTS idx_shipment_events_shipment_id ON shipment_events(shipment_id);
CREATE INDEX IF NOT EXISTS idx_rate_cards_session_id ON rate_cards(session_id);
CREATE INDEX IF NOT EXISTS idx_rate_cards_mode ON rate_cards(mode);
CREATE INDEX IF NOT EXISTS idx_country_integrations_session_id ON country_integrations(session_id);
CREATE INDEX IF NOT EXISTS idx_country_integrations_country_code ON country_integrations(country_code);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_email ON subscriptions(user_email);
CREATE INDEX IF NOT EXISTS idx_subscriptions_session_id ON subscriptions(session_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription_id ON subscriptions(stripe_subscription_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- For production, enable these:
-- ============================================
-- ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE email_analysis ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE customer_portals ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE shipment_events ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE rate_cards ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE country_integrations ENABLE ROW LEVEL SECURITY;

-- ============================================
-- DONE!
-- ============================================
SELECT 'FreightWizard schema created successfully!' as message;
