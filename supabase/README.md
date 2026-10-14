# Database (Supabase)

Two projects:

| Project | Used by | Data |
|---|---|---|
| **Production** (`gctiartkhikyjgdrrfgt`, eu-central-2) | Vercel (`freightwizard-api`), through its environment variables | Real accounts |
| **Development** (`freightwizard-dev`, eu-central-2) | Localhost, through `.env.development` | Fake `.test` accounts from `seed.sql`, plus whatever you sign in with locally |

The local API refuses to start against production (`apps/api/db-guard.ts`).

## Files

- `migrations/00000000000000_baseline.sql`: every production table (types, defaults, NOT NULL, keys, enums, indexes, RLS on). Generated from production's table definitions by `tools/baseline-from-openapi.mjs`.
- `migrations/<date>_*.sql`: later changes, in date order. A new schema change gets its own dated file; run it on development first, then production.
- `seed.sql`: development data. Refuses to run on a database with real (non-`.test`) accounts.
- `tools/compare-schema.mjs`: lists differences between two projects' table definitions.

## Set up the development project

1. Create a project: name `freightwizard-dev`, region Central EU (Zurich), same organization.
2. SQL Editor: run `migrations/00000000000000_baseline.sql`, then each dated migration in order, then `seed.sql`.
3. Project Settings → API Keys: copy the project URL, the anon (or publishable) key and the service_role (or secret) key into `.env.development` at the repo root (template: `.env.development.example`).
4. Remove the production `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` from `.env`; production keys live only in Vercel.

## Signing in locally

- Fake accounts, no OAuth: `http://localhost:3000/overview?session=dev-owner` (also `dev-agent`, `dev-solo`). They have no mailbox: the live Inbox shows "Reconnect Gmail"; everything else works.
- Real test mailboxes: sign in with Google or Outlook on localhost as usual. Sessions and analyses are stored in the development project only.
