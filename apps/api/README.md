# Freightwizard API

Express API (`server.ts`) for the web app, the Gmail add-on and webhooks. Data lives in Supabase.

## Hosting

- **Vercel** project `freightwizard-api`, root directory `apps/api`, Hobby plan (move to Pro with the first paying customer).
- Domain **https://api.freightwizard.app** (Cloudflare DNS, CNAME to Vercel, DNS only).
- Region **fra1** (`vercel.json`), next to Supabase in eu-central-2 (Zurich). Max duration 300 s.
- Vercel runs the exported Express app as one function; `app.listen` only runs locally.
- Vercel type-checks without a tsconfig.json: TypeScript from a fresh install, target ES2021, NodeNext, **strict: false**. A type error fails the deploy; `npm run check:vercel` runs the same check.

## Environment variables

`ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`,
`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_STARTER_PRICE_ID`, `STRIPE_PROFESSIONAL_PRICE_ID`, `STRIPE_ENTERPRISE_PRICE_ID`,
`TERMINAL49_API_KEY`, `TERMINAL49_WEBHOOK_SECRET`, `INTEGRATION_ENCRYPTION_KEY`,
`GOOGLE_ADDON_CLIENT_IDS`, `API_URL` (https://api.freightwizard.app), `FRONTEND_URL` (https://freightwizard.app).
Optional: `PORTBASE_TOKEN_URL`, `PORTBASE_CARGO_API_URL`.

In production the Stripe and Terminal49 webhooks refuse events if their secret is missing.
`INTEGRATION_ENCRYPTION_KEY` must never change once secrets are stored with it.

## Local development

Locally the API uses the **development** Supabase project from `.env.development` at the repo root (template `.env.development.example`; setup in `supabase/README.md`), loaded before `.env`. It refuses to start when `SUPABASE_URL` points at production (`db-guard.ts`).

```
npm run dev     # http://localhost:3001, reads ../../.env.development, then ../../.env
npm test        # unit tests
npm run check:vercel  # type check exactly as the Vercel build runs it; run before every push
```
