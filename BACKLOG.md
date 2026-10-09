# Backlog

Order agreed 2026-10-09: current deploy → **Security (phase 0)** below → multi-team phases 1–3 (`docs/multi-team-plan.md`) → phase 4 when the first multi-seat customer arrives → phase 5 → phase 6 when a customer asks for shared inboxes.

## Security (phase 0, before multi-team phase 1)

- **Encrypt Gmail/Outlook OAuth tokens at rest.** `gmail_sessions.access_token` and `refresh_token` are stored in plain text. Use the same AES-256-GCM helpers as integration secrets (`encryptField` / `decryptField` in `apps/api/server.ts`), with a one-off migration for existing rows.
- **Enable RLS on all Supabase tables.** The API uses the service-role key, so RLS mainly protects against direct access with the anon key; add policies before any client-side Supabase access.
- **Require auth on `GET /api/analysis-result`.** It returns any email's analysis (summary, suggested reply) by email ID with no session check. The Gmail add-on polls it, so the add-on needs to send its identity. Until fixed, the landing page keeps "Strict access controls" rather than "every request is authenticated" (claims 5.5).
- **Require auth on `POST /api/translate`.** No session check; anyone can use it to spend Claude credits.
- **Store token counts with every analysis.** Record `input_tokens`, `output_tokens` (and cache read/write tokens once caching is on) from each Claude response in `email_activity`, for analyses, documents and translations. Gives real cost per user and per plan instead of estimates (current estimate: ~$0.011–0.015 per email analysis on Claude Sonnet 5).
- **Prompt caching for the fixed analysis instructions.** Move the ~1,500-token instruction block of `/api/analyze` (and the add-on queue) into a cached system prompt; only the email itself stays uncached. Expected ~25% lower cost per analysis. **Done when** the analysis output (intent, priority, mode, route, identifiers, missing info) is unchanged on the test emails in freightzard@gmail.com, compared before and after, and cache reads show up in the stored token counts.

## Legal and site

- **Privacy page.** The footer Privacy link was removed until it exists; add it back when it does (claims 5.6).
- **Footer links to `#`:** Terms, Blog, Careers.
- **/pricing FAQ not reviewed:** "7-day refund on your first payment" and "cancel anytime, no questions asked".
