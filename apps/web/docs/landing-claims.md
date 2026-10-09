# Landing page claims inventory

## Decisions applied (2026-10-09)

Reviewed against the code and decided by the product owner. Applied in EN, PT and NL in `app/page.tsx`; Enterprise plan data also updated in `app/lib/plans.ts` (used by /pricing, Billing and the upgrade modal). The inventory below is kept as the record of what was claimed before; its line numbers refer to commit `80a8440`.

| # | Decision | Now reads (EN) |
|---|---|---|
| All built claims | Keep | unchanged |
| 1.3 | Reword (no time claim) | "Generates professional reply drafts that your team can review, edit and send." |
| 1.4 | Reword (no value scoring exists) | "Highlights urgent emails and new quote requests so nothing slips through." |
| 2.4 | Reword (timeline is per email thread) | "Activity timeline for each email thread: received, analyzed, replied, notes." |
| 2.5 | Remove (not built) | Smart Notifications card removed |
| 2.11 | MAPA kept; SERPRO / CE Mercante and Portbase **coming soon** (SERPRO auth is mocked; Portbase untested with real credentials); EORI and ACE / CBP removed | "Brazil MAPA compliance alerts built in. SERPRO / CE Mercante (Brazil) and Portbase (Netherlands) coming soon." Compliance pills: MAPA alerts only; SERPRO, CE Mercante, Portbase moved to Coming soon |
| 3.1e | Remove | "FreightWizard integrates with major email platforms." |
| 3.3a | Keep "Coming soon" (live tracking needs the paid Terminal49 plan) | unchanged |
| 4.1 | Reword (no live monitoring; analysis runs on click) | "New messages load every time you open or refresh your inbox, and you analyze them with one click" |
| 5.3 | Keep | "Encrypted in transit and at rest" (HTTPS + Supabase disk encryption); PT/NL FAQ aligned |
| 5.4 | Keep, reworded | "We don't use your emails to train AI models" |
| 5.5 | **Pending**: /api/analysis-result is unauthenticated, so "every request is authenticated" is not true yet | "Strict access controls" (unchanged until decided) |
| 5.6 | Remove GDPR / LGPD / AVG in all languages; footer Privacy link removed until a privacy page exists | — |
| 5.8 | Remove the 95% accuracy FAQ | — |
| 6.1 | Reword Trial | "14 days free: 30 analyses, 5 shipments, 5 quotes. No credit card." ("Full Professional access" removed) |
| 6.2 | Remove "Starter is free forever" (FAQ) | "Yes. Start with a 14-day free trial: 30 analyses, 5 shipments and 5 quotes, no credit card. After that, Starter is $79/month." |
| 6.3 | Reword | "Brazil MAPA compliance alerts" (was "Compliance layer") |
| 6.4 | Container tracking **coming soon**; custom portal branding and API access removed | Enterprise: Everything in Professional · Container tracking (coming soon) · Dedicated support |
| 7.x | Keep, without unmeasured numbers or times | Hero: "respond to freight inquiries faster" (was "in minutes, not hours") |

Not reviewed yet: the /pricing page FAQ promises a 7-day refund and "cancel anytime, no questions asked".

---

## Original inventory (before the decisions)

Every feature, integration, compliance and security claim on the public landing page (`app/page.tsx`), with where it appears. Nothing has been changed yet; this is the list for deciding what stays, what moves to **Coming soon**, and what gets removed.

- **Section** is where it shows on the page.
- **Lines** are `app/page.tsx` line numbers for EN · PT · NL (as of commit `80a8440`). All three languages make the same claim unless the notes say otherwise.
- **⚠** marks a conflict with another claim on the same page, or a difference between languages.

## 1. Product features ("What we Do" cards)

| # | Claim (EN) | Lines EN · PT · NL | Notes |
|---|---|---|---|
| 1.1 | **AI Email Understanding**: reads freight emails and extracts ports, container types, cargo information, delivery dates | 31 · 149 · 256 | |
| 1.2 | **Smart Workflow Suggestions**: classifies quote request / booking update / documentation request / status inquiry and suggests next step | 32 · 150 · 257 | |
| 1.3 | **AI Drafted Responses**: reply drafts your team can review and send "in seconds" | 33 · 151 · 258 | |
| 1.4 | **Inbox Prioritization**: highlights urgent requests and high-value quote opportunities | 34 · 152 · 259 | |

## 2. Key Features grid

| # | Claim (EN) | Lines EN · PT · NL | Notes |
|---|---|---|---|
| 2.1 | **Shipment Data Extraction**: ports, container types, cargo details, vessel names, shipment references | 40 · 158 · 265 | |
| 2.2 | **Email Intent Detection**: quotes, updates, documentation requests, tracking inquiries | 41 · 159 · 266 | |
| 2.3 | **Reply Assistant**: "accurate and professional responses" | 42 · 160 · 267 | |
| 2.4 | **Activity Timeline**: communication history per shipment conversation | 43 · 161 · 268 | |
| 2.5 | **Smart Notifications**: alerts for high-priority emails and approaching deadlines | 44 · 162 · 269 | |
| 2.6 | **Analytics Dashboard**: email volume, response times, team productivity | 45 · 163 · 270 | |
| 2.7 | **Quote Builder**: pre-fills quotes from extracted email data | 46 · 164 · 271 | Also a Starter plan line (6.2) |
| 2.8 | **Shipment Tracker**: Kanban board that auto-detects shipments from emails and keeps status current | 47 · 165 · 272 | ⚠ See 3.3 / 6.4: "live tracking" is listed as Coming soon |
| 2.9 | **Customer Portal**: shareable tracking link, no login required | 48 · 166 · 273 | Also a Starter plan line (6.2) |
| 2.10 | **Rate Card Storage**: carrier rates per lane, auto-suggested in quote builder | 49 · 167 · 274 | Also a Starter plan line ("Rate cards", 6.2) |
| 2.11 | **Country Compliance**: "Brazil MAPA/SERPRO, Netherlands Portbase/EORI, and USA ACE checks built in" | 50 · 168 · 275 | ⚠ Names **MAPA** and **EORI**, which aren't in the Compliance chip list (3.2); the chips name **CE Mercante** and **CBP**, which aren't here. ⚠ PT says "já integrados" ("already integrated"), stronger than EN "checks built in" |
| 2.12 | **Document Intelligence**: upload BL, AWB or invoice; AI extracts fields and flags risks | 51 · 169 · 276 | Also a Professional plan line (6.3) |

## 3. Integrations section

| # | Claim (EN) | Group on page | Lines EN · PT · NL | Notes |
|---|---|---|---|---|
| 3.1a | Gmail | Supported integrations | 77 · 195 · 302 | |
| 3.1b | Outlook | Supported integrations | 77 · 195 · 302 | |
| 3.1c | Microsoft 365 | Supported integrations | 77 · 195 · 302 | |
| 3.1d | Google Workspace | Supported integrations | 77 · 195 · 302 | |
| 3.1e | "can be extended to connect with freight management systems" | Section intro | 75 · 193 · 300 | **EN only**: PT/NL say just "integrates with major email platforms". Implies an extension path (API / connectors) |
| 3.2a | SERPRO Integra Comex (BR) | Compliance | 79 · 197 · 304 | |
| 3.2b | Portbase (NL) | Compliance | 79 · 197 · 304 | |
| 3.2c | CE Mercante (BR) | Compliance | 79 · 197 · 304 | ⚠ Not mentioned in feature 2.11 |
| 3.2d | ACE / CBP (US) | Compliance | 79 · 197 · 304 | |
| 3.3a | Terminal49 live tracking | Coming soon | 81 · 199 · 306 | ⚠ Enterprise lists "Container tracking" as included (6.4) |
| 3.3b | CargoWise | Coming soon | 81 · 199 · 306 | |
| 3.3c | Descartes | Coming soon | 81 · 199 · 306 | |

## 4. How it works

| # | Claim (EN) | Lines EN · PT · NL | Notes |
|---|---|---|---|
| 4.1 | Connect Gmail or Outlook; monitoring "in real time" | 57 · 175 · 282 | Names only Gmail/Outlook; the Integrations section also lists Microsoft 365 and Google Workspace |
| 4.2 | Identifies origin/destination ports, container type, shipment dates, customer intent | 58 · 176 · 283 | |
| 4.3 | Suggests next action: prepare a quote, request missing info, forward to operations | 59 · 177 · 284 | |
| 4.4 | Review, edit and send AI-generated reply | 60 · 178 · 285 | |

## 5. Security and data protection

| # | Claim (EN) | Where | Lines EN · PT · NL | Notes |
|---|---|---|---|---|
| 5.1 | Secure OAuth connections ("provided by Google and Microsoft") | Security tags + FAQ 1 | 117, 106 · 235, 224 · 342, 331 | PT/NL FAQ drop "provided by Google and Microsoft" |
| 5.2 | Never store your email password; revoke access any time | FAQ 1 | 106 · 224 · 331 | NL drops "revoke access any time" |
| 5.3 | Encrypted data storage / "encrypted in transit and at rest" | Security tags + FAQ 2 | 117, 107 · 235, 225 · 342, 332 | PT/NL FAQ say only "encrypted" |
| 5.4 | **No AI training on your emails** | Security tags + FAQ 2 | 117, 107 · 235, 225 · 342, 332 | PT tag is shortened to "Sem treinamento de IA" ("No AI training"), NL to "on your data" |
| 5.5 | Strict access controls | Security tags | 117 · 235 · 342 | PT drops "strict" |
| 5.6 | **GDPR compliant** | Security tags | 117 · 235 · 342 | ⚠ PT says **"Compatível com LGPD"** (Brazil's law) instead of GDPR. NL "AVG compliant" = GDPR. The footer Privacy and Terms links currently point to `#` |
| 5.7 | Every AI suggestion can be reviewed, edited or rejected before sending | FAQ 3 | 108 · 226 · 333 | |
| 5.8 | **Over 95% accuracy** on intent and data extraction "for standard freight communications" | FAQ 5 | 110 · 228 · 335 | Quantified claim. PT/NL drop the "standard freight communications" qualifier |

## 6. Pricing cards

| # | Plan | Claims (EN) | Lines EN · PT · NL | Notes |
|---|---|---|---|---|
| 6.1 | Trial | Free · 14 days · no credit card · full Professional access · 30 analyses total · 5 shipments · 5 quotes | 91 · 209 · 316 | ⚠ "Full Professional access" vs. caps of 5 shipments / 5 quotes, while Professional is unlimited |
| 6.2 | Starter ($79/mo) | 1 user · 200 analyses/month · 10 shipments · 20 quotes · Quote builder · Customer portal · Rate cards · Email support | 92 · 210 · 317 | ⚠ FAQ 6 says "Starter plan is free forever" (all three languages) |
| 6.3 | Professional ($179/mo) | Up to 5 users · Unlimited analyses · Unlimited shipments · Unlimited quotes · Document intelligence · Team leaderboard · Compliance layer · Priority support | 93 · 211 · 318 | "Team leaderboard" appears nowhere else on the page. ⚠ FAQ 6 says Professional has a 14-day trial; the pricing shows a separate Trial plan |
| 6.4 | Enterprise ($399/mo) | Unlimited users · Everything in Professional · Custom portal branding · **Container tracking** · **API access** · Dedicated support | 94 · 212 · 319 | ⚠ Container tracking vs. "Terminal49 live tracking: Coming soon" (3.3a). API access is listed nowhere else |
| 6.5 | All paid plans | Annual billing = "2 months free" (price × 10) | 87 · 205 · 312 | |

## 7. Outcome claims (marketing copy, not features)

Listed for completeness; these are promises about results, not product capabilities.

| # | Claim (EN) | Where | Lines EN · PT · NL |
|---|---|---|---|
| 7.1 | Respond to freight inquiries "in minutes, not hours" | Hero | 23 · 141 · 248 |
| 7.2 | Handles inquiries, quotes, follow-ups and shipment classification "automatically" | Hero | 22 · 140 · 247 |
| 7.3 | "so nothing falls through the cracks" | Product 1.4 | 34 · 152 · 259 |
| 7.4 | "Scale operations without hiring additional staff" | Use cases | 70 · 188 · 295 |
| 7.5 | "Never miss a potential shipment opportunity" | Use cases | 69 · 187 · 294 |

## Conflicts to resolve first

1. **Starter "free forever"** (FAQ 6) vs. Starter at $79/month.
2. **Trial terms**: FAQ 6 says Professional has a 14-day trial; the cards show a separate 14-day Trial plan with Professional access but capped usage.
3. **Container tracking** included in Enterprise vs. live tracking listed as Coming soon.
4. **Compliance lists don't match**: the feature names MAPA and EORI, the chips name CE Mercante and CBP.
5. **GDPR (EN/NL) vs. LGPD (PT)**: different legal claims depending on language.
6. **95% accuracy**: a number someone may ask you to substantiate.
