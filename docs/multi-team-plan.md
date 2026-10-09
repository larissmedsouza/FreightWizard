# Multi-team plan: organizations, teams, roles, seats

Status: **planned, not built**. Decisions recorded 2026-10-09.

## Order of work

1. Current deploy (app-restyle + analysis-fixes).
2. **Phase 0, security backlog** (see `BACKLOG.md`): encrypt OAuth tokens at rest, baseline RLS, auth on `/api/analysis-result` and `/api/translate`, store token counts per analysis, prompt caching for the analysis instructions.
3. **Phases 1–3**: organizations and data model, roles and enforcement, multiple teams in the UI.
4. **Phase 4** (organization billing and seats) when the first multi-seat customer arrives.
5. **Phase 5** (RLS defense in depth) after phase 4.
6. **Phase 6** (shared inboxes) when a customer asks for it.

## Decisions

| # | Decision |
|---|---|
| 1 | Managers see **counts and response times only**, never the content of members' personal-mailbox analyses. |
| 2 | Rate cards: **Members read-only**; Owners and Managers edit. |
| 3 | **Pending invites hold a seat.** Invites expire after **7 days**. |
| 4 | Starter: **no extra seats**; adding people requires upgrading. |
| 5 | **One organization per user** in v1. |
| 6 | Trial: **3 seats**. Professional: 5 seats included, **extra seat $39/month**. Enterprise: **"from $399/month, 10 users included, extra seats by contract"**, sold through Contact sales (no self-serve checkout). Unlimited plans: **fair use 1,500 analyses per seat per month**, a soft cap (notify, never hard-block). |

## Where we start from (2026-10-09)

- `profiles.team_id` links a user to one team; roles are `manager` / `employee`. 13 teams exist, only 1 profile is in one (the rest are empty test teams). 3 profiles in total.
- `subscriptions` has one row per **email address**.
- Shipments, email analysis, documents and activity are keyed by `user_id`. **Quotes, rate cards, portals and country integrations are keyed by login `session_id`** (fragile: tied to one login). Brazil settings (`tenant_integrations`) are keyed by `tenant_id`.
- The API uses the Supabase service-role key; every permission check happens in the API.
- No paying customers yet (Stripe in test mode), so migration is cheapest now.

## Database changes

| Change | Purpose |
|---|---|
| **`organizations`** (`id`, `name`, `owner_id`, `plan`, `status`, `stripe_customer_id`, `stripe_subscription_id`, `seat_limit`, trial and period fields) | The company. Owns plan and billing; replaces per-email `subscriptions`. |
| **`org_members`** (`org_id`, `user_id` unique, `role` owner/manager/member, `status` active/invited/removed, `invited_by`, `joined_at`) | One row per person (one org per user in v1). Seats = active + invited rows. |
| **`teams`**: add `org_id`, `created_by`, `archived_at`; later drop `manager_id`, `invite_code` | Several teams per organization. |
| **`team_members`** (`team_id`, `user_id`, `added_by`) | A user can be in several teams; replaces `profiles.team_id`. |
| **`invites`** (`org_id`, `email`, `role`, `team_ids[]`, `token`, `expires_at` = +7 days, `accepted_at`) | Email invites with role and teams; replaces the shared invite code. Counts toward seats until accepted or expired. |
| **Scoping columns** on `shipments`, `quotes`, `rate_cards`, `customer_portals`, `email_analysis`, `document_analysis`, `email_activity`, `analytics_daily`: `org_id` (required), `team_id` (optional), `created_by` (replaces `session_id` keys) | One scoping rule for every table. |
| **`tenant_integrations`, `country_integrations`** keyed by `org_id` | Credentials belong to the company. |
| **`mailboxes`** (phase 6): `org_id`, `team_id`, `address`, `provider`, encrypted tokens, `connected_by` | Shared inboxes. |
| **`audit_log`** (`org_id`, `actor_id`, `action`, `target`, `at`) | Invites, removals, role and billing changes, mailbox connections. |

Indexes on `org_id` and `team_id` everywhere. Old columns stay (read as a fallback) until the end of phase 1.

## Permission matrix

Enforced in the API by one `requireRole(action)` check per endpoint, with a test for every row.

| Action | Owner | Manager | Member |
|---|:-:|:-:|:-:|
| View and change plan, payment method, invoices | ✅ | ❌ | ❌ |
| Add or remove paid seats | ✅ | ❌ | ❌ |
| Delete organization | ✅ | ❌ | ❌ |
| Transfer ownership | ✅ | ❌ | ❌ |
| Rename organization | ✅ | ✅ | ❌ |
| Create, rename or archive teams | ✅ | ✅ | ❌ |
| Invite members and set their teams | ✅ | ✅ | ❌ |
| Remove members, change roles (not the Owner's) | ✅ | ✅ (Members only) | ❌ |
| Make someone a Manager | ✅ | ❌ | ❌ |
| Integrations and credentials (SERPRO, Portbase, ACE, EU) | ✅ | ✅ | ❌ |
| Org settings (company profile, automation, templates) | ✅ | ✅ | ❌ |
| Connect or disconnect a shared mailbox | ✅ | ✅ | ❌ |
| See all teams' shipments, quotes, rates, Overview | ✅ | ✅ | ❌ (own teams only) |
| Team leaderboard | All teams | All teams | Own teams |
| Members' personal-mailbox analyses | Counts and response times only | Counts and response times only | Own only |
| Inbox, analysis, replies (own mailbox, own teams' shared mailboxes) | ✅ | ✅ | ✅ |
| Create and edit shipments, quotes, portals in own teams | ✅ | ✅ | ✅ |
| Rate cards | Edit | Edit | **Read only** |
| Leave the organization | ❌ (transfer first) | ✅ | ✅ |

The last Owner can't be removed. A removed member loses access immediately; what they created stays with the team.

## Data scoping

Every record has an organization, an optional team, and a creator.

- **Member**: records in their teams, plus their own records without a team.
- **Manager, Owner**: every record in the organization, except the **content** of other users' personal-mailbox analyses (decision 1).

| Data | Owned by | Notes |
|---|---|---|
| Shipments, quotes, portals | A team (default: creator's primary team) | Managers can move them between teams. |
| Rate cards | The organization, optionally limited to a team | Members read-only (decision 2). |
| Email analysis, personal mailbox | The user | Others see aggregates only (counts, response times). |
| Email analysis, shared mailbox | The mailbox's team | One analysis per email for the whole team (saves quota, one shared status). |
| Documents | The creator, optionally shared to a team | |
| Integrations and credentials | The organization | Members never see secrets. |

**Overview**: the Me/Team switch becomes **Me / [each of my teams] / All teams** (All teams for Managers and Owners). Every list page accepts the same `?scope=` filter, so cards stay clickable in team views. Count logic generalizes `apps/api/overview.ts`, keeping the per-scope tests (including a second organization seeing only its own data).

**RLS**:
1. Phase 0: enable RLS on every table with no policies for the anon role (blocks direct access with the public key; the API's service role is unaffected).
2. Phase 5: the API mints a short-lived database token per request with `user_id` and `org_id`; RLS policies enforce the same rule as the API, so even an API bug can't return another organization's rows. Needs `org_id` on every table, hence after phase 1.

## Billing and seats

- One Stripe customer and subscription per **organization**, paid by the Owner. Members never pay or see checkout.
- A seat = an active or invited member (decision 3); a person in several teams uses one seat.
- Plan limits apply per organization:

| Plan | Seats included | Extra seats | Analyses | Shipments | Quotes |
|---|---|---|---|---|---|
| Trial (14 days) | **3** | ❌ | 30 total per org | 5 | 5 |
| Starter ($79/month) | 1 | ❌ upgrade required (decision 4) | 200/month per org | 10 | 20/month |
| Professional ($179/month) | 5 | ✅ **$39/month per seat** | Unlimited, fair use 1,500/seat/month | Unlimited | Unlimited |
| Enterprise (**from $399/month**) | **10** | By contract | Unlimited, fair use 1,500/seat/month | Unlimited | Unlimited |
| Internal | Unlimited | — | Unlimited | Unlimited | Unlimited |

- **Professional extra seats in Stripe**: two subscription items, the base price (quantity 1) and a per-seat price ($39) with `quantity = max(0, seats − 5)`. Seat changes update the quantity with proration; the webhook keeps `organizations.seat_limit` in sync. Managers inviting past the limit see "ask the Owner to add seats"; the Owner gets an "Add seat" confirmation showing the new monthly total.
- **Enterprise** is sales-led: Contact sales, contract terms set manually on the organization (no self-serve checkout).
- **Fair use** (unlimited plans): when an organization passes 1,500 analyses per seat in a month, notify the Owner (and us); never block. Cost basis: about $0.015 per analysis on Claude Sonnet 5, so 1,500 analyses ≈ $22 per seat per month.
- Code: the plan checks in `apps/api/billing.ts` (already tested) move from per-email subscriptions to the organization; monthly counts sum across the organization; upgrade prompts show only to Owners (Members see "Ask your account owner").

## Migration

All in one transaction, re-runnable, rehearsed on a copy of production first.

1. **Organizations**: a user already in a team → the team's manager becomes **Owner** of an organization named after the team, its members become **Members**. Every other user → **Owner** of their own organization (named from the company profile or email domain). Empty teams are archived, not deleted.
2. **Subscriptions** move to their user's organization; the Owner's subscription becomes the organization's. Individual paid subscriptions of team members (none today) are flagged for manual handling.
3. **Roles**: `manager` → Owner; `employee` → Member.
4. **Backfill** `org_id`, `team_id`, `created_by` everywhere. Session-keyed rows (quotes, rate cards, portals, country integrations) map session → user (via `gmail_sessions`) → organization, which also fixes "quotes tied to one login". `tenant_integrations` maps by tenant ID.
5. Ship code that reads the new columns with the old ones as fallback; verify row counts per organization.
6. Drop the old columns (`profiles.team_id`, `teams.manager_id`/`invite_code`, `session_id` keys) once verified. Rollback is trivial before this step.

## Shared inboxes (phase 6)

- **Microsoft 365 first**: each member connects their own account; Graph reads the shared mailbox with delegated `Mail.Read.Shared` / `Mail.Send.Shared`, granted by the company's Exchange admin. No shared token stored; access ends when the admin removes it.
- **Gmail**: no native equivalent. Offer option (a): a Manager connects the shared account once and its token is stored for the team. Alternatives: Workspace domain-wide delegation (b, needs the customer's admin) or per-member Gmail delegation (c, limited API support).
- **Safeguards**: tokens encrypted at rest and never sent to the browser; only Managers connect or disconnect; team membership checked on every request (removing a member cuts access immediately); every read, send and assignment audit-logged with the acting member; least-privilege scopes; a visible banner when acting as the shared address; disconnect revokes the token with the provider.
- **Product**: mailbox switcher, assignment and "being handled by" status, one analysis per message shared by the team.

## Phases and effort (developer-days, including review)

| Phase | Scope | Effort |
|---|---|---|
| 0. Security backlog (prerequisite) | See `BACKLOG.md` | not counted |
| 1. Organizations and data model | New tables, migration script, backfill, every endpoint scoped by organization, migration tests on a production copy | 5–7 |
| 2. Roles and enforcement | `requireRole` everywhere, a test per matrix row, ownership transfer, member removal, audit log | 3–4 |
| 3. Multiple teams in the UI | "Create team" next to Invite, team membership, email invites with role and teams (7-day expiry), team switcher, Overview Me / team / All teams, `?scope=` on list pages | 5–7 |
| 4. Organization billing and seats | Stripe per organization, base + seat items, webhooks, seat checks on invite, Owner-only billing, organization-level limits, fair-use notices | 4–6 |
| 5. RLS defense in depth | Per-request database tokens, policies matching the scoping rule, direct-to-database cross-organization tests | 3–4 |
| 6. Shared inboxes | Microsoft 365 delegated mailboxes, then the Gmail shared-account option, assignment, audit, one analysis per message | 7–10 |
| **Total** | | **27–38** |
