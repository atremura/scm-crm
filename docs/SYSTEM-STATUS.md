---
title: JMO GROUP Carpentry CRM — System Status
project: JMO CRM
owner: Andre Tremura
last_updated: 2026-04-22
phase: 1.5B-2 (Gmail OAuth + attachment capture) — complete
---

# JMO GROUP Carpentry CRM

Internal CRM for **JMO GROUP Carpentry** (Massachusetts construction company specializing in finish carpentry, siding, and sheet metal). Goal: replace the spreadsheets, the email threads, and the back-of-envelope math with a single source of truth, powered by AI.

**Repo:** [github.com/atremura/awg-crm](https://github.com/atremura/awg-crm)
**Branch:** `main`
**Local URL:** `http://localhost:3000`
**Login:** `andre.tremura@awgconstructions.com` / `Admin AWG 123!`

---

## Quick facts

| | |
|---|---|
| **Stack** | Next.js 16 · React 19 · TypeScript · Prisma 6 · PostgreSQL (Neon) · Tailwind v4 · shadcn/ui v4 (preset Nova) |
| **Auth** | NextAuth v5 (credentials, JWT sessions) |
| **AI** | Anthropic Claude Opus 4.7 via `@anthropic-ai/sdk` |
| **Email integration** | Gmail API via `googleapis` + OAuth 2.0 (Workspace **Internal** app) |
| **Geocoding** | OpenStreetMap Nominatim (free) |
| **Hosting** | Local dev now → Vercel (planned), Neon for Postgres |
| **Branding** | Originally AWG Construction → rebranded to JMO GROUP Carpentry |

---

## Architecture

```
Browser
  └─ Next.js App Router (Server Components + Client Components)
       │
       ├─ NextAuth (credentials)
       ├─ Prisma → PostgreSQL (Neon serverless)
       ├─ Anthropic SDK → Claude Opus 4.7 (extraction)
       ├─ googleapis → Gmail API (sync)
       └─ Local FS → public/uploads/bids/<id>/ (file storage; S3 later)
```

**Routes:**
- `app/(authenticated)/` — pages behind NextAuth session
- `app/api/` — REST endpoints
- `middleware.ts` — protects `(authenticated)` routes

**Files where things live:**
| What | Where |
|---|---|
| Prisma schema | `prisma/schema.prisma` |
| Migrations | `prisma/migrations/` |
| API routes | `src/app/api/**/route.ts` |
| Pages | `src/app/(authenticated)/**/page.tsx` |
| Components | `src/components/**/*.tsx` |
| Server libraries | `src/lib/*.ts` |
| Auth config | `src/auth.ts` |
| Brand assets | `public/brand/jmo-logo-{white,navy}.png` |
| Bid uploads | `public/uploads/bids/<bidId>/` (gitignored) |
| Design source | `AWG-CRM_v2/design_handoff_jmo_crm/` (gitignored, reference only) |

---

## Modules built (status overview)

| Module | Status | Phase |
|---|---|---|
| Authentication | ✅ working | 1.3 |
| Users & Roles + Permissions matrix | ✅ working | 1.4 |
| Clients (list / detail / contacts / archive) | ✅ working | 1.4 |
| Settings (company, base location, AI, Gmail) | ✅ working | Polish B |
| Dashboard (Overview KPIs + Project Map of NE) | ✅ working — KPIs/funnel/activity wired to Prisma | Polish B |
| **BIDs — manual creation** | ✅ working | 1.5A |
| **BIDs — Email AI extraction (paste)** | ✅ working | 1.5B-1 |
| **BIDs — Gmail OAuth + sync** | ✅ working | 1.5B-2 |
| **BIDs — Gmail attachment capture** | ✅ working | 1.5B-2 |
| Project Links extracted by AI | ✅ working | 1.5B-1 |
| Geocoding + distance from Boston | ✅ working | — |
| Ask AI side panel | ✅ UI shell (canned replies — wires to Claude in 1.5B+ later) | Polish B |
| ⌘K Command palette | ✅ working (navigation + actions) | Polish B |
| Takeoff module | ⏳ not started | Phase 2 |
| Estimate / Contract / Execution / Financial | ⏳ not started | Phases 3-6 |

---

## Key workflows

### 1. Create a bid manually

`/bids/new` — five-section form: Client (combobox + inline new-client dialog), Project info, Industry requirements, Documents (drag-and-drop), Notes. Sticky right panel shows live preview + warning chip listing missing required fields. On submit:

1. Bid row created with `source = "manual"` and `status = "new"`
2. `bidStatusHistory` row inserted (initial)
3. If `projectAddress` set → POST to Nominatim → store `projectLatitude` / `projectLongitude` / `distanceMiles` (Haversine from Boston)
4. Files uploaded sequentially to `/api/bids/<id>/documents`

### 2. Capture a bid by pasting an email (manual paste)

`/bids` → "Capture from email" button → dialog:

1. **Paste step:** subject + from + body
2. POST `/api/bids/extract` →
   - System prompt cached (`ephemeral`) — minimum prefix is 4096 tokens for Opus, ours is ~700 so cache rarely hits but is harmless
   - Claude Opus 4.7 with `thinking: { type: "adaptive" }` and `output_config.format: zodOutputFormat(ExtractedBidSchema, "extracted_bid")`
   - Schema has 18 fields including `links` array (categorized: documents/portal/meeting/addendum/other) and `confidenceOverall`
   - Saves a `BidExtraction` row (full audit: raw email, parsed JSON, model, tokens, cost, confidence, flags)
3. **Review step:** confidence badge, AI-flagged warnings, all extracted fields editable, choice between "Create new client" and "Pick existing", project links preview
4. Click "Create bid from email" → POST `/api/bids/from-extraction` → creates client (if new) + bid (`source = "email_ai"`) + status history + saves links as `BidLink` rows + geocodes
5. Redirects to `/bids/[id]`

### 3. Capture bids automatically from Gmail

**One-time setup:**
1. `/settings` → Gmail integration → **Connect Gmail**
2. Browser bounces through `/api/auth/gmail/start` → Google consent → `/api/auth/gmail/callback`
3. Callback exchanges code, stores `refreshToken` on the `User` row, redirects to `/settings?gmail=success`

**Per-sync:**
1. `/bids` → **Sync Gmail** button (only visible when connected)
2. POST `/api/gmail/sync?limit=10` →
   - Lists messages matching `newer_than:30d -from:me -in:spam -in:trash + (subject keywords OR body keywords)` — keywords: `bid|rfp|invitation|estimate|proposal|"request for proposal"`
   - Skips messages already extracted (deduped via `[gmail:<msgId>]` prefix in our `emailSubject` field)
   - For each new message: parses MIME body (text/plain preferred, falls back to stripped HTML), collects allowed-extension attachments, runs through Claude → saves `BidExtraction` (status=`pending`) with `attachments` JSON metadata
3. Toast: `"X new extracted, Y already seen"`. Violet banner appears on `/bids`: `"X emails captured from Gmail and waiting for review"`
4. Click banner → dialog lists each pending extraction with summary + confidence
5. Click **Review** on one → opens the same review dialog (loaded via `loadExtractionId` prop, skipping the paste step)
6. Click **Create bid from email** → as in workflow #2, **plus**: downloads each attachment via Gmail API and saves to `public/uploads/bids/<id>/` as `BidDocument` rows

### 4. Bid status lifecycle

`new → qualified → sent_to_takeoff → won | lost`

- `rejected` is reachable from any state
- Each transition writes to `bidStatusHistory` with the user, from-status, to-status, and optional notes
- Detail page shows context-aware action buttons (e.g. when `qualified`: "Assign to Takeoff" + "Reject")

---

## Database schema

Tables (all in `public` schema on Neon):

| Table | Purpose |
|---|---|
| `users` | App users; carries Gmail OAuth tokens |
| `roles` | Admin, Estimator, Project Manager, Field Worker |
| `modules` + `user_module_permissions` | Per-user permissions per module (view/create/edit/delete) |
| `clients` + `client_contacts` | GCs, developers, owners + contact people |
| `bids` | Core opportunity record |
| `bid_documents` | Files attached to a bid (with version + addendum support) |
| `bid_status_history` | Audit log of status changes |
| `bid_ai_analysis` | Reserved for AI scoring (not heavily used yet) |
| `bid_links` | URLs found in the email — Dropbox plans, Procore portal, Zoom walkthrough, etc. |
| `bid_extractions` | Audit row per Claude API call; tracks raw email + JSON + confidence + cost + status |
| `system_settings` | Key-value config (base location, max distance, preferred work types, etc.) |

### `Bid` key fields

```
bidNumber             BID-YYYY-NNNN  (auto-generated, year-scoped sequence)
clientId              FK clients.id
projectName           string
projectAddress        string?
projectLatitude       Decimal?       (geocoded)
projectLongitude      Decimal?       (geocoded)
distanceMiles         Decimal?       (Haversine from Boston)
workType              string?        (Finish Carpentry / Siding / Sheet Metal / Roofing / GC / Other)
receivedDate          DateTime?
responseDeadline      DateTime?
status                string         (new | qualified | sent_to_takeoff | won | lost | rejected)
priority              string         (low | medium | high | urgent)
source                string         (manual | email_ai | portal_api)
bondRequired          Boolean
unionJob              Boolean
prevailingWage        Boolean
davisBacon            Boolean
insuranceRequirements string?
notes                 string?
assignedTo            FK users.id?
```

### `BidExtraction` key fields

```
rawEmail        Text       (full body sent to Claude)
emailSubject    string?    (prefixed "[gmail:<msgId>]" for Gmail-sync dedup)
fromAddress     string?
extractedData   Json       (the 18-field structured output)
confidence      Decimal    (0-100, Claude's self-assessment)
flags           Json       (array of warnings)
attachments     Json?      ([{messageId, attachmentId, filename, mimeType, sizeBytes}])
modelUsed       string     (e.g. "claude-opus-4-7")
inputTokens     int
outputTokens    int
cacheReadTokens int
costCents       Decimal
status          string     (pending | accepted | rejected)
extractedBy     FK users.id
acceptedAt      DateTime?
bidId           FK bids.id?  (set when accepted → bid created)
```

### `User` Gmail fields (added in 1.5B-2)

```
gmailEmail            string?
gmailRefreshToken     string?    (PLAIN TEXT — encrypt before production)
gmailConnectedAt      DateTime?
gmailLastSyncAt       DateTime?
gmailHistoryId        string?    (reserved for incremental-sync upgrade)
```

---

## API surface

### Auth
- `POST /api/auth/[...nextauth]` — NextAuth credentials
- `GET  /api/auth/gmail/start` — redirect to Google consent
- `GET  /api/auth/gmail/callback` — exchange code, store tokens
- `POST /api/auth/gmail/disconnect` — wipe tokens
- `GET  /api/auth/gmail/status` — connected? email? last sync?

### Users
- `GET    /api/users` — list (filters: status, search)
- `POST   /api/users` — admin create
- `GET    /api/users/[id]` — detail with permissions
- `PATCH  /api/users/[id]` — update fields + replace permissions
- `DELETE /api/users/[id]` — soft delete (isActive=false)
- `GET    /api/roles`, `GET /api/modules` — supporting

### Clients
- `GET    /api/clients?status=&search=&type=`
- `POST   /api/clients`
- `GET    /api/clients/[id]` — full detail with contacts + bids
- `PATCH  /api/clients/[id]` — update + full-replace contacts
- `DELETE /api/clients/[id]` — soft archive

### Bids
- `GET    /api/bids?status=&search=&assignedTo=&clientId=&workType=&urgency=&source=`
- `POST   /api/bids` — manual create + auto-geocode
- `GET    /api/bids/[id]` — full detail (client+contacts, docs, history, ai analysis, links)
- `PATCH  /api/bids/[id]` — update fields
- `DELETE /api/bids/[id]` — soft-delete (move to rejected)
- `POST   /api/bids/[id]/status` — status transition + history entry
- `POST   /api/bids/[id]/assign` — set `assignedTo`, transition to `sent_to_takeoff`
- `POST   /api/bids/[id]/geocode` — manual / backfill geocode
- `POST   /api/bids/[id]/documents` — upload (multipart)
- `DELETE /api/bids/[id]/documents/[documentId]`
- `POST   /api/bids/[id]/links` / `DELETE /api/bids/[id]/links/[linkId]`

### Extractions
- `POST   /api/bids/extract` — Claude call, save audit row
- `GET    /api/bids/extractions?status=pending` — list pending
- `GET    /api/bids/extractions/[id]` — single (used by review dialog)
- `DELETE /api/bids/extractions/[id]` — soft reject
- `POST   /api/bids/from-extraction` — accept: create client+bid+links+download attachments

### Gmail
- `POST   /api/gmail/sync?limit=10` — pull + extract recent matching emails

### Dashboard / Settings
- `GET    /api/dashboard` — aggregated KPIs / funnel / series / activity
- `GET    /api/settings` / `PATCH /api/settings` — bulk upsert (admin only)

---

## External integrations

### Anthropic Claude API
- **Model:** `claude-opus-4-7`
- **Mode:** `thinking: { type: "adaptive" }` + `output_config.format: zodOutputFormat(...)`
- **Caching:** `cache_control: ephemeral` on the system prompt (stable, no timestamps)
- **Pricing (cached):** $5/$25 per 1M input/output tokens; cache reads ~10% of input
- **Wrapper:** `src/lib/claude-client.ts` (singleton + cost helper) and `src/lib/bid-extraction.ts` (Zod schema + prompt)
- **Audit trail:** every call writes a `BidExtraction` row with token counts and cost in cents

### Gmail API (googleapis)
- **OAuth scopes:** `gmail.readonly`, `userinfo.email`, `openid`
- **App type:** Workspace Internal (no Google verification, refresh tokens never expire)
- **Wrapper:** `src/lib/gmail.ts`
- **Default search query:** `newer_than:30d -from:me -in:spam -in:trash + (subject:(bid|rfp|invitation|estimate|proposal) OR body keywords)`
- **Attachment allowlist:** pdf, dwg, rvt, xls, xlsx, doc, docx, png, jpg, jpeg
- **Dedup:** by message id stored in `emailSubject` prefix `[gmail:<id>]`
- **No Gmail mutation** — does not mark as read, does not add labels (toggleable in a future update)

### OpenStreetMap Nominatim
- **Wrapper:** `src/lib/geocoding.ts`
- **Free, no API key**, rate-limited (~1 req/sec)
- **Bias:** `countrycodes=us`
- **Used by:** bid creation (auto), `/api/bids/[id]/geocode` (backfill), `/settings` "Resolve" button
- **Distance:** `src/lib/geo.ts` — Haversine + bearing from Boston (42.3601, -71.0589)
- **Project Map:** projects each bid + state polygon vertex via azimuthal projection from Boston

---

## Environment variables (`.env`)

```
# Database
DATABASE_URL="postgresql://...neon.tech/neondb?sslmode=require"

# NextAuth
AUTH_SECRET="<32-byte random>"
AUTH_URL="http://localhost:3000"
AUTH_TRUST_HOST=true

# Anthropic
ANTHROPIC_API_KEY=sk-ant-api03-...

# Google OAuth (Gmail integration)
GOOGLE_CLIENT_ID=<numeric>-<random>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
```

---

## Visual / Brand

- **Design source:** `AWG-CRM_v2/design_handoff_jmo_crm/` (Claude Design output, kept in repo for reference but gitignored)
- **Tokens** wired into `src/app/globals.css` and Tailwind theme:
  - Brand navy palette (`navy-50` … `navy-900`, primary = `navy-800` #00283C)
  - Steel blue accent (`blue-100` … `blue-700`, accent = `blue-500` #3A5A7A)
  - Cool ink neutrals, success/warn/danger semantic, surfaces with light + dark
- **Dark mode is default** (`<html class="dark">` in root layout)
- **Fonts:** Inter (sans) + JetBrains Mono via `next/font`
- **Logo:** white version on navy backgrounds, navy on light. Lives in `public/brand/`
- **Layout shell:** sidebar (260px navy) + topbar (breadcrumbs + ⌘K search + Ask AI + bell + user dropdown)

### Project Map (Dashboard)
- Massachusetts hub at center of an SVG (1000×720, viewBox)
- Boston at hub coordinates (500, 360) at 2.5 px/mile
- Range rings at 25/50/75/100 mi
- New England state borders rendered as dashed paths (simplified polygons projected azimuthally from Boston)
- Each visible bid is a node placed by real bearing + Haversine distance — clickable, links to `/bids/[id]`

---

## Costs (so far)

| Item | Cost |
|---|---|
| Anthropic credits purchased | $20 |
| Per email extraction (Opus 4.7) | ~$0.005 – $0.02 (avg ~$0.012) |
| ~250-500 extractions in $20 | (current usage trivial) |
| Neon (Free tier) | $0 |
| Vercel | not deployed yet |
| **Total spent so far** | **$20** |

---

## Limitations & known gotchas

- **Neon serverless cold-start.** First DB hit after a few minutes idle takes ~5-10 s. The `from-extraction` endpoint has explicit retry (P1001 → 1.5s/3s backoff) and a bumped Prisma transaction timeout (30 s).
- **Gmail refresh tokens stored plaintext** in `users.gmail_refresh_token`. **Encrypt before going to production** (use `pgcrypto` or app-level AES with a KMS key).
- **OAuth callback redirect** is hardcoded to `http://localhost:3000/api/auth/gmail/callback` in Google Console. When deploying to Vercel, add the production URL there too.
- **No background sync.** Gmail sync is on-demand only (user clicks Sync). Auto-polling / push-notifications via Pub/Sub is a future task.
- **Gmail does not get marked as read.** No labels are applied either. Toggleable in a future polish pass — the dedup is purely on our side.
- **State polygons are simplified** (~6-15 lat/lng points each). Cape Cod's outer arm + Block Island + outer islands are not exact. "Recognizable shape, not surveying tool."
- **NY is not drawn** (out of view to the west). Bids in NY will appear at the left edge.
- **Validators on `/api/clients`** check `bid.create` permission for new clients, since the inline-create from `/bids/new` rides that path. Could be split if a separate `clients.create` permission is wanted.
- **Pricing constants** in `src/lib/claude-client.ts` are hardcoded for Opus 4.7. Update if model changes.

---

## Phase roadmap

### ✅ Completed
- **1.3** — Auth + initial scaffolding
- **1.4** — Users, Roles, Permissions, Clients
- **JMO Rebrand** — Tokens, fonts, logos, sidebar, login, topbar
- **Dashboard v2** — Tab switcher (Overview + Project Map with NE state borders + real bids)
- **Settings** — Company / Base / Bid rules / AI / Gmail
- **Polish** — Ask AI panel (UI), ⌘K palette, dashboard wired to real Prisma
- **1.5A** — Bids manual flow (list, create, detail, status transitions, documents, geocoding)
- **1.5B-1** — AI email extraction (paste flow), project links extraction
- **1.5B-2** — Gmail OAuth + on-demand sync, attachment download → BidDocument

### ⏳ Suggested next polish (small, ~30 min each)
- Mark-as-read + label-apply toggles in Settings → Gmail
- Encrypt `gmailRefreshToken` at rest
- Background Gmail sync (cron via Vercel or QStash)
- Distance threshold auto-rejection (already in settings, just enforce in `from-extraction`)
- AI auto-analysis on new bids (the `ai_auto_analyze` flag in settings)
- Wire AI Copilot panel to real Claude (currently canned demo replies)
- Inbox tab on `/bids` with the full pending-extraction queue

### ⏳ Future phases
- **Phase 2 — Takeoff** (extract quantities/measurements from drawings)
- **Phase 3 — Estimate** (labor + materials + equipment pricing)
- **Phase 4 — Contract** (analysis, e-sign, subcontracts)
- **Phase 5 — Execution** (WBS, change orders, field updates)
- **Phase 6 — Financial** (measurements, billing, payments)

---

## Commit history (key milestones)

```
5216c37  Capture Gmail attachments and persist them as bid documents
201d950  Phase 1.5B-2: Gmail OAuth + on-demand sync
b496ff5  Extract and save project links from bid emails
568edbe  Phase 1.5B-1: AI email extraction (Claude Opus 4.7)
cd968c1  Phase B polish — Settings, real Dashboard, Ask AI panel, ⌘K palette
e1cae72  Center Boston and zoom the project map
d604b8e  Draw real New England state borders (dashed) on the project map
1458f9d  Geocode bid addresses (Nominatim) and project map by real bearing
0509353  Wire Project Map (and badge) to real Prisma bids
4b647d6  Fix ClientCombobox dropdown clipped by Section overflow-hidden
fc617c7  Add Clients module — list + detail with inline contacts management
26d98b3  Fix silent validation on /bids/new
715c5f7  Rebuild Login + Topbar to match JMO v2 design
387be35  Add BID module Phase 1.5A, JMO rebrand, dashboard v2, and Users CRUD
f5c1ce9  Add shadcn/ui, sidebar navigation, topbar, and new dashboard
a96eb24  feat: initial commit
2ff427f  Initial commit: AWG CRM Phase 1.3 - Auth system working
```

---

## Useful commands

```powershell
# Start dev server
npm run dev

# Database
npx prisma migrate dev --name <description>     # apply schema changes
npx prisma generate                             # regenerate Prisma client
npx prisma studio                               # GUI at http://localhost:5555
npx prisma db seed                              # populate initial data

# Git
git status
git push origin main

# Add a shadcn component
npx shadcn@latest add <component>

# Stop a stuck dev server
taskkill /PID <pid> /F
```

---

## Decisions made (architectural notes)

- **Modular schema with future-proof permissions.** `user_module_permissions` is a many-to-many with view/create/edit/delete granularity. When Execution gets sub-modules (`execution.projects`, `execution.change_orders`, etc.) the same table holds them — no refactor needed. For future "approve change order > $10k" type rules, a `custom_permissions` table is planned.
- **Separation of bid extraction from bid creation.** Claude returns into `BidExtraction` (audit, status=pending). User reviews → accept/reject. Only on accept does a real `Bid` exist. Lets us measure model quality, retry failed extractions, and reject without polluting the bids table.
- **Source field on Bid.** `manual` / `email_ai` / `portal_api`. Drives the badge color in lists and the "AI Score" defaulting to "pending" for non-AI bids. Future portal API integration (BuildingConnected, Procore) plugs into the same field.
- **Geocoding is Nominatim, not Google.** Free + good enough for our volume. If we hit rate limits or accuracy issues, swap to Google Maps Geocoding API (already budgeted in cost model).
- **Map projection is azimuthal from Boston.** Distances + bearings are Haversine-correct relative to the hub. Sacrifices Maine's exact shape (distortion increases with distance) for an accurate "this is X miles in direction Y from base" map.
- **Internal Workspace OAuth.** Skips Google's verification process for `gmail.readonly`, refresh tokens never expire. Limits sign-in to `awgconstructions.com` / `jmogroup.com` Workspace users — fine for a company-internal CRM.
- **Default to Claude Opus 4.7.** Per Anthropic SDK skill recommendation; correctness on extraction matters more than cost (extractions are cheap anyway). Adaptive thinking on by default. Sonnet/Haiku reserved for high-volume non-critical paths.
- **Server file storage at `public/uploads/bids/<id>/`.** Simple, fast for dev, gitignored. S3 migration is a 1-file swap of `src/lib/storage.ts` (`saveFile` / `deleteFile`).
- **Dark mode by default.** Matches the design handoff prototype. Light mode tokens are in place — toggle is just a `class="dark"` flip on `<html>`.

---

## Where to look first when something breaks

| Symptom | Likely cause | First file to check |
|---|---|---|
| Login redirects in a loop | NextAuth session/JWT cookie issue | `src/middleware.ts`, `src/auth.ts`, `.env` `AUTH_SECRET` |
| `Can't reach database server` | Neon hibernating, will warm in ~10s | retry; check `DATABASE_URL` in `.env` |
| `Transaction already closed` | Prisma `$transaction` timed out | bump `timeout` option (already 30s on `from-extraction`) |
| Gmail OAuth bounces with `redirect_uri_mismatch` | Console URL doesn't match | Google Cloud Console → Credentials → OAuth Client → Authorized redirect URIs |
| Claude says `400 invalid_request_error` | Schema mismatch / model migration | `src/lib/bid-extraction.ts` (Zod schema), check model id `claude-opus-4-7` |
| Map node off-screen | Bid is far from Boston (>~110 mi) | radius is capped at 280 px in `src/components/dashboard/project-map.tsx`; node clamped to viewBox bounds |
| Combobox dropdown invisible | Parent `overflow-hidden` clipping | check the Card/Section wrapper |
