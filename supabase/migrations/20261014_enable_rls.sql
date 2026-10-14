-- Phase 0: row level security on every table in the public schema.
-- No policies: the public (anon) and signed-in (authenticated) keys see and
-- change nothing; the API uses the service-role key, which bypasses RLS.
-- Before running on production, check the live API reports "dbKey":"service_role"
-- at https://api.freightwizard.app/ (otherwise it would lose access to its data).
-- Idempotent: tables that already have RLS are left as they are.
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND NOT rowsecurity LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
    RAISE NOTICE 'RLS enabled on %', t.tablename;
  END LOOP;
END $$;

-- Check: every row should say true.
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY rowsecurity, tablename;
