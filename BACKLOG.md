# Backlog

Not scheduled yet. Newest first.

## Security

- **Encrypt Gmail/Outlook OAuth tokens at rest.** `gmail_sessions.access_token` and `refresh_token` are stored in plain text. Use the same AES-256-GCM helpers as integration secrets (`encryptField` / `decryptField` in `apps/api/server.ts`), with a one-off migration for existing rows.
- **Enable RLS on all Supabase tables.** The API uses the service-role key, so RLS mainly protects against direct access with the anon key; add policies before any client-side Supabase access.
- **Require auth on `GET /api/analysis-result`.** It returns any email's analysis (summary, suggested reply) by email ID with no session check. The Gmail add-on polls it, so the add-on needs to send its identity. Until fixed, the landing page keeps "Strict access controls" rather than "every request is authenticated" (claims 5.5).
- **Require auth on `POST /api/translate`.** No session check; anyone can use it to spend Claude credits.

## Legal and site

- **Privacy page.** The footer Privacy link was removed until it exists; add it back when it does (claims 5.6).
- **Footer links to `#`:** Terms, Blog, Careers.
- **/pricing FAQ not reviewed:** "7-day refund on your first payment" and "cancel anytime, no questions asked".
