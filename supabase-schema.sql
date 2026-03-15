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
-- INDEXES
-- ============================================
CREATE INDEX idx_email_analysis_email_id ON email_analysis(email_id);
CREATE INDEX idx_email_analysis_user_id ON email_analysis(user_id);
CREATE INDEX idx_profiles_email ON profiles(email);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- For production, enable these:
-- ============================================
-- ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE email_analysis ENABLE ROW LEVEL SECURITY;

-- ============================================
-- DONE!
-- ============================================
SELECT 'FreightWizard schema created successfully!' as message;
