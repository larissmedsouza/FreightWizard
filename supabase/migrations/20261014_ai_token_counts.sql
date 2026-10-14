-- Phase 0: token counts of every Claude call, on its activity row.
-- Actions: analyzed (email analysis), ai_failed (paid for, no usable result),
-- document_analyzed, documents_compared, text_extracted, translated.
-- Idempotent. The API keeps working before this runs (it then stores the
-- activity without the counts).
ALTER TABLE public.email_activity ADD COLUMN IF NOT EXISTS model text;
ALTER TABLE public.email_activity ADD COLUMN IF NOT EXISTS input_tokens integer;
ALTER TABLE public.email_activity ADD COLUMN IF NOT EXISTS output_tokens integer;
ALTER TABLE public.email_activity ADD COLUMN IF NOT EXISTS cache_read_tokens integer;
ALTER TABLE public.email_activity ADD COLUMN IF NOT EXISTS cache_write_tokens integer;

-- Cost per user and month (Claude Sonnet 5: $2 / $10 per million input / output
-- tokens; cache reads 10% and cache writes 125% of the input price).
CREATE OR REPLACE VIEW public.ai_cost_monthly WITH (security_invoker = true) AS
SELECT
  user_id,
  date_trunc('month', created_at)::date AS month,
  action,
  count(*) AS calls,
  sum(input_tokens) AS input_tokens,
  sum(output_tokens) AS output_tokens,
  sum(cache_read_tokens) AS cache_read_tokens,
  sum(cache_write_tokens) AS cache_write_tokens,
  round((sum(input_tokens) * 2 + sum(cache_read_tokens) * 0.2 + sum(cache_write_tokens) * 2.5 + sum(output_tokens) * 10) / 1e6, 4) AS cost_usd
FROM public.email_activity
WHERE input_tokens IS NOT NULL
GROUP BY 1, 2, 3;
