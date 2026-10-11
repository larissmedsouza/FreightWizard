# Backlog

Order agreed 2026-10-09: current deploy → **Security (phase 0)** below → multi-team phases 1–3 (`docs/multi-team-plan.md`) → phase 4 when the first multi-seat customer arrives → phase 5 → phase 6 when a customer asks for shared inboxes.

## Security (phase 0, before multi-team phase 1)

- **Encrypt Gmail/Outlook OAuth tokens at rest.** `gmail_sessions.access_token` and `refresh_token` are stored in plain text. Use the same AES-256-GCM helpers as integration secrets (`encryptField` / `decryptField` in `apps/api/server.ts`), with a one-off migration for existing rows.
- **Enable RLS on all Supabase tables.** The API uses the service-role key, so RLS mainly protects against direct access with the anon key; add policies before any client-side Supabase access.
- **Store token counts with every analysis.** Record `input_tokens`, `output_tokens` (and cache read/write tokens once caching is on) from each Claude response in `email_activity`, for analyses, documents and translations. Gives real cost per user and per plan instead of estimates (current estimate: ~$0.011–0.015 per email analysis on Claude Sonnet 5).
- **Prompt caching for the fixed analysis instructions.** Move the ~1,500-token instruction block of `/api/analyze` (and the add-on queue) into a cached system prompt; only the email itself stays uncached. Expected ~25% lower cost per analysis. **Done when** the analysis output (intent, priority, mode, route, identifiers, missing info) is unchanged on the test emails in freightzard@gmail.com, compared before and after, and cache reads show up in the stored token counts.

## After phase 0: EU lookup tools (branch eu-integrations)

Approved 2026-10-09; start after the deploy and phase 0. Build: EORI (EU, SOAP), VAT (VIES REST), AEO (EU, SOAP), UN/LOCODE (full UN/CEFACT list), EU sanctions (consolidated list), ECB rates, plus **GB EORI (HMRC)**. Skip REX for now. Three-state badges (Valid / Not valid / Couldn't check); AEO shows "Listed as AEO" / "Not in the public AEO list" (never "Not AEO"); sanctions shows "Possible match, verify"; ECB conversions labelled "Indicative, ECB reference rate of <date>". Caching, downtime handling, failure logging, team scoping and tests per the original brief. No website or pricing claims until each is built and tested against the real service.

## Add-ons

- **Gmail add-on: done 2026-10-10.** Pulled into `apps/gmail-addon` (clasp), sends a Google ID token; `GOOGLE_ADDON_CLIENT_IDS` set on the API project. Re-push with `clasp push` from `apps/gmail-addon` after any change.
- **Outlook add-in: real sign-in.** `outlook-addin/taskpane.html` still sends a claimed `userEmail` and now gets 401. Needs Office SSO (token verified by the API) or a Freightwizard session. Dev-only today (links to localhost).

## Hosting

- **API on Vercel Hobby** (`apps/api`, project separate from the web app, domain `api.freightwizard.app` via Cloudflare DNS, region `fra1` next to Supabase eu-central-2). Hobby is non-commercial-only and keeps 1 hour of logs: move to Vercel Pro with the first paying customer (Stripe stays in test mode until then). Consider logging failures to a Supabase table.

## Legal and site

- **Privacy page.** The footer Privacy link was removed until it exists; add it back when it does (claims 5.6).
- **Footer links to `#`:** Terms, Blog, Careers.
- **/pricing FAQ not reviewed:** "7-day refund on your first payment" and "cancel anytime, no questions asked".
