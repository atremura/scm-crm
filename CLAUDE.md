# CLAUDE.md — Project Context for AI Agents

@AGENTS.md

---

## What this project is

`scm-crm` is the codebase that will become the **Construction Management Platform** — a multi-tenant SaaS for construction companies covering the full project lifecycle from lead capture to post-delivery warranty.

**Currently in production for one tenant:** JMO Carpentry (slug: `jmo`). The architecture is multi-tenant from day one but only one company actively uses the system.

**Owner / primary user:** Andre Tremura (AWG Constructions). Andre's preferred working language is Portuguese. The system, code, and client-facing documents are all in English. Communication with Andre in chat: Portuguese. Code, comments, commit messages, UI strings: English.

---

## Architecture vision — the 12 modules

The full system is designed as 12 interconnected modules + cross-cutting layers. Today, modules 1, 2 (partial), and parts of master data are implemented.

| #   | Module                                  | Status                                                      |
| --- | --------------------------------------- | ----------------------------------------------------------- |
| 1   | Lead Intake & Qualification             | 🟢 Implemented                                              |
| 2   | Takeoff, Estimate & Proposal            | 🟡 Partial — being refactored (see "Cowork strategy" below) |
| 3   | Contract Analysis & Signature           | ⚪ Not started                                              |
| 4   | Pre-Execution (WBS, BOM, Submittals)    | ⚪ Not started                                              |
| 5   | Execution / CECS (the operational core) | ⚪ Not started                                              |
| 6   | Purchasing & Rentals                    | ⚪ Not started                                              |
| 7   | Workforce Tracking                      | ⚪ Not started                                              |
| 8   | Client Portal                           | ⚪ Not started                                              |
| 9   | Admin Master (Multi-Tenant)             | 🟡 Partial                                                  |
| 10  | Centralized Notifications               | ⚪ Not started                                              |
| 11  | Financial                               | ⚪ Not started                                              |
| 12  | Warranty / Post-Delivery                | ⚪ Not started                                              |

**Cross-cutting layers:** Master Data (records), Inventory sub-module, Dashboards, Audit Trail.

Full architecture documents are in `docs/architecture-PT.md` and `docs/architecture-EN.md`.

---

## Cowork strategy (decision: 2026-05-04)

**Critical context for any work on the Estimate module:**

Project scope analysis (PDF reading, drawing analysis, scope inference) does **NOT** run inside this app. It runs in **Cowork Desktop**, an external tool. After Cowork finishes its analysis, it produces a structured JSON file that gets imported into `scm-crm`.

### Why this matters

- The previous "Phase 1 Project AI Analyst" (in-app Claude Files API analysis) is being **deprecated**. It will be removed in upcoming work. Do not extend it.
- AI inside the app can only **suggest**, never create or modify project data directly. All AI output goes through the `Suggestion` table for human approval.
- This keeps the app fast, AI cost bounded, and gives Andre the option to use the simpler "Manual Estimate" path for small jobs without any AI.

### Module 2 has TWO paths

**Path A — AI-assisted (mid/large projects):**

1. Bid accepted → Project created in app
2. Andre opens Cowork Desktop (separate tool) and runs analysis there
3. Cowork generates a `.cowork.json` file
4. Andre uploads that file into `scm-crm` via the import endpoint
5. App creates Classifications and EstimateLines from the import
6. After import, Andre may trigger AI helpers (Hidden Cost Detector, Per-Line Suggestions, Project Context) — these emit `Suggestion` rows

**Path B — Manual (small jobs):**

1. Bid accepted → Project created in app
2. Estimator manually adds Classifications using existing Master Data classifications, or creates new ones on the fly
3. No Cowork, no AI involvement
4. Faster turnaround for repairs, small jobs, fast quotes

**Schema for the Cowork file:** see `docs/cowork-import-schema.md`.

---

## Stack

| Layer     | Tech                                                      | Notes                                                                                                                                        |
| --------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework | **Next.js 16.2.4**                                        | App Router. Note: Next 16 has breaking changes vs your training data — read `node_modules/next/dist/docs/` before writing Next-specific code |
| Language  | TypeScript 5, **strict mode ON**                          | Do not introduce `any`. Do not enable `typescript.ignoreBuildErrors`                                                                         |
| UI        | Tailwind 4 + shadcn/ui + radix-ui + lucide-react          | shadcn primitives in `src/components/ui/`                                                                                                    |
| Forms     | react-hook-form + Zod (`@hookform/resolvers`)             | **Installed but underused** — many existing forms use raw `useState`. Migration is gradual.                                                  |
| Auth      | NextAuth v5 beta + `@auth/prisma-adapter` + bcryptjs      | Credentials provider + Gmail OAuth (separate flow for lead intake)                                                                           |
| ORM       | Prisma 6.19                                               | Migrations are versioned in `prisma/migrations/`. Use `npx prisma migrate dev` for new ones; never reset (Neon production data)              |
| Database  | PostgreSQL on Neon                                        | Multi-tenant via `companyId` column on every operational table — **NOT schema-separated, NOT RLS**                                           |
| Storage   | Vercel Blob (`@vercel/blob`) + local `/uploads/` fallback | Abstracted via `src/lib/storage.ts`                                                                                                          |
| AI        | `@anthropic-ai/sdk` 0.90                                  | Singleton in `src/lib/claude-client.ts`. Model: `claude-opus-4-7`. Files API beta is being phased out.                                       |
| Email     | `googleapis` (Gmail)                                      | OAuth flow at `/api/auth/gmail/*`. Sync at `/api/gmail/sync`.                                                                                |
| Excel     | exceljs (server) + xlsx (client parse)                    | Excel proposal exports working. PDF export is TODO.                                                                                          |
| Deploy    | Vercel                                                    | `postinstall: prisma generate` is required (already configured)                                                                              |

**Always use `process.env.X` for secrets. Never hardcode. `.env.example` is committed; `.env*` files are not.**

---

## Multi-tenant model

- Every operational AND master data table has a `companyId` foreign key to `Company`
- Tenant isolation is enforced **in application code only** (not via Postgres RLS)
- Pattern: every API route calls `requireAuth()` from `src/lib/permissions.ts`, then includes `where: { companyId: ctx.companyId }` in every Prisma query
- Pattern: every mutation includes `companyId: ctx.companyId` in the data
- 88 query sites currently follow this pattern. Adding new ones MUST follow it.

**Permissions:** `Role` (global) + `Module` + `UserModulePermission` (matrix user × module × action). Helper: `canDo(ctx, moduleSlug, action)`. Slugs in use: `bid`, `takeoff`, `estimate`. Admin role bypasses checks.

---

## Code conventions

### File structure

```
src/
├── app/                    Next.js App Router
│   ├── (authenticated)/    Routes requiring login
│   ├── api/                REST endpoints
│   ├── login/, register/   Public routes
│   └── page.tsx            Root redirect
├── components/             Feature-organized components
│   └── ui/                 shadcn primitives — DO NOT MODIFY directly, use shadcn CLI
└── lib/                    Pure logic, no React
    ├── prisma.ts           Prisma singleton
    ├── claude-client.ts    Anthropic singleton
    ├── permissions.ts      Auth helpers
    └── ...                 Domain logic (pricing engine, resolvers, etc)
```

### Naming

- Files: `kebab-case.ts` for libs, `kebab-case.tsx` for components, `[id]/` for dynamic Next routes
- React components: `PascalCase`
- Functions, variables: `camelCase`
- Database fields: `camelCase` in Prisma schema (mapped to `snake_case` in PG via `@map`)

### Patterns to follow

- **Snapshot pattern in audit trails.** When a value can change over time (rates, prices, master data), the row that uses it must snapshot the value at use time. Examples: `EstimateLine` snapshots labor rate, material cost; `BidExtraction` snapshots full Anthropic response. Never re-derive historical values from current master data.
- **Pure functions in `lib/`.** Domain logic (pricing engine, resolvers, evaluators) lives in `lib/` and is testable in isolation. Avoid mixing UI state with calculation logic.
- **Validate at the boundary.** Every API route validates payload with Zod before touching the database. Validation errors return 400 with field-level messages.
- **Loading states.** Every async operation has a `Loader2` / `Skeleton` UI. Don't ship a button that disappears with no feedback.
- **Server-only marker.** Files with secrets or server-only logic import `'server-only'` at the top.

### Anti-patterns to avoid

- ❌ Don't use `any`. If TypeScript complains, narrow the type or refactor. Boundaries with external SDKs are an exception (NextAuth callbacks, Anthropic union types).
- ❌ Don't put business logic inside page components. Extract to `lib/` and call from the page.
- ❌ Don't fetch data inside `useEffect` without an abort signal — the project has many of these as tech debt; do not add more.
- ❌ Don't bypass `requireAuth()` and tenant filtering. There is no RLS. The app is the only line of defense.
- ❌ Don't write to AI master data tables (`ProductivityEntry`, `Material`, `LaborRate`) from AI code. AI emits `Suggestion` rows; humans approve before master data changes.
- ❌ Don't reset the database. Use `npx prisma migrate dev` for new migrations.

---

## Repository hygiene

### Pre-commit hook

Husky v9 runs `gitleaks` (if installed) + `lint-staged` on every commit. `lint-staged` runs `eslint --fix` and `prettier --write` on changed files. Don't commit if these fail — fix the cause instead.

### Identity

Local `git config user.name` is `Andre Tremura`, `user.email` is `andre.tremura@awgconstructions.com`. Do **NOT** add `Co-Authored-By: Claude` to commit messages unless Andre explicitly asks.

### Branches

- `main` is the deployment branch and the only long-lived branch
- Feature branches use `feature/<short-name>` (e.g., `feature/cowork-import`)
- Refactor branches use `refactor/<short-name>` (e.g., `refactor/estimate-page-split`)
- Fix branches use `fix/<short-name>` (e.g., `fix/login-redirect`)
- Branches are short-lived: created when starting work, merged to main when done, deleted immediately after merge
- Never push directly to main — always go through a feature branch + merge
- Use `git merge --ff-only` when possible (no merge commits for clean linear history)

### Build expectations

Before any commit that touches code:

- `npx tsc --noEmit` must pass with 0 errors
- `npm run lint` may have warnings but 0 errors
- `npm run build` must complete successfully

CI in GitHub Actions (when set up) will enforce these.

---

## Existing modules — quick reference

### Lead Intake (Module 1) — implemented

- Models: `Bid`, `BidExtraction`, `BidLink`, `BidDocument`, `BidStatusHistory`, `BidAiAnalysis`
- Flow: Gmail email → Claude extracts → `BidExtraction` (audit) → user accepts → becomes `Bid` → prequalification scoring → status flow
- Endpoints: `/api/bids/*`, `/api/gmail/*`
- UI: `/bids`, `/bids/[id]`, `/bids/new`

### Estimate (Module 2) — being refactored

**Current state:**

- Models: `Project`, `ProjectDocument`, `Classification`, `Estimate`, `EstimateLine`, `EstimateCostFactor`, `Suggestion`, `DerivativeCostRule`
- Pricing engine: `src/lib/estimate-pricing.ts` (deterministic, do not modify carelessly)
- Resolver: `src/lib/togal-resolver.ts` (L1 matchCode + L2 fuzzy match — reuse for Cowork importer)
- AI helpers: `ai-project-context.ts` (IA-1), `ai-hidden-costs.ts` (IA-2), `estimate-ai-suggester.ts` (per-line)
- Excel export: working (client + internal versions)
- PDF export: button exists, marked "soon"

**Being deprecated (DO NOT EXTEND):**

- `src/lib/ai/scope-analyst/` (entire folder)
- `/api/projects/[id]/analyze` endpoint
- `/api/projects/[id]/analysis-runs` endpoints
- `/takeoff/[id]/analysis-runs/[runId]` page
- `components/takeoff/ai-analysis-panel.tsx`
- Models `ProjectAnalysisRun`, `ClassificationCalibration`
- Fields `Classification.sourceAnalysisRunId`, `aiConfidence`, `quantityBasis`, `needsTogalVerification`
- Fields `Project.stories`, `durationWeeks`, `siteConditions`, `requiredEquipment`, `winterRisk`, `permitChecklist` (will move to `Project.contextHints` JSONB)
- Field `ProjectDocument.anthropicFileId`

**Being added:**

- `EstimateImport` model (audit row for Cowork imports)
- `Project.contextHints` JSONB field
- Cowork import endpoints and UI (see `docs/cowork-import-schema.md`)
- Manual Estimate path (small jobs, no AI)

### Master Data — partial

**Implemented:**

- `Client` + `ClientContact`
- `Material` + `MaterialType`
- `ProductivityEntry`, `LaborTrade`, `LaborRate`, `Region`, `Division`
- `CostFactor`, `Assembly`

**To be added:**

- `Employee` (currently only `User` for auth — no HR data)
- `Subcontractor` (separate from employees)
- `Supplier` (currently a free-text field on `Material`)

---

## When in doubt

1. **Read this file first** — it's the source of truth for context
2. **Read `docs/architecture-PT.md` or `docs/architecture-EN.md`** — full module specs
3. **Read `docs/cowork-import-schema.md`** — for anything touching the import flow
4. **Read `docs/audit-2026-05.md`** — for the state of the codebase as of the last audit
5. **Check `node_modules/next/dist/docs/` for Next 16 specifics** — Next 16 has breaking changes vs older training data
6. **Ask Andre** — when scope is unclear, ask before assuming. Andre prefers explicit confirmation over rework.

---

## Communication preferences

- **In chat with Andre:** respond in Portuguese
- **In code, commits, comments, UI:** English
- **In documentation:** primary language is English, but PT versions exist for client-facing architecture docs
- **Tone:** direct, technical, honest about tradeoffs. Andre values clarity over polish and would rather hear "this is risky because X" than a confident wrong answer.

---

_Last updated: 2026-05-04. When making significant architectural decisions, update this file in the same commit._
