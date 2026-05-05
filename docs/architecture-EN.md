# Construction Management Platform — Modular Architecture

**Version:** 1.1
**Last updated:** May 2026
**Language:** English (Portuguese version: `architecture-PT.md`)

---

## 1. Overview

This document consolidates the modular architecture of a multi-tenant construction management platform, covering the entire project lifecycle — from lead capture to post-delivery warranty. The system combines AI automation, a field-ready mobile app, external integrations (DocuSign, Cowork, QuickBooks) and a robust layer of notifications and dashboards.

### Architecture Principles

- **Multi-tenant:** complete data isolation; each construction company is a tenant with its own Master Data, branding and settings.
- **Field mobile-first:** execution functions (progress, photos, time clock, open items, COs) prioritized for iPad and smartphone.
- **AI integrated:** lead capture, contract analysis, subcontract generation and estimating support via Cowork.
- **Granular permissions:** View / Edit / Approve / Signatory applied per module and record type.
- **Audit and versioning:** complete history across all sensitive modules (contracts, WBS, financial, master data).
- **Industry templates:** standards like AIA G702/G703 are system templates, customizable per tenant.

### System Layers

The platform is organized in three interdependent layers:

- **Main project flow (Modules 1–8 + 11–12):** from lead to warranty.
- **Cross-cutting layers:** Master Data, Inventory, Dashboards, Centralized Notifications (Mod. 10).
- **Platform:** Admin Master (Mod. 9) manages tenants, billing, templates and global operations.

---

## 2. Main Flow — Module Sequence

| #   | Module                        | Trigger (input)                 | Output (next)                         |
| --- | ----------------------------- | ------------------------------- | ------------------------------------- |
| 01  | Lead Intake & Qualification   | New email / manual entry        | Approved lead → Mod. 2                |
| 02  | Takeoff, Estimate & Proposal  | Approved lead                   | Won proposal → Mod. 3                 |
| 03  | Contract Analysis & Signature | Won proposal                    | Signed contract → Mod. 4              |
| 04  | Pre-Execution                 | Signed contract                 | Setup complete → Mod. 5               |
| 05  | Execution / CECS              | Pre-Execution finalized         | Project delivered → Mod. 12           |
| 06  | Purchasing & Rentals          | Requests from Mod. 4 and Mod. 5 | Material received / Invoice → Mod. 11 |
| 07  | Workforce Tracking            | Employee clocks in (mobile)     | Auto cost → Mod. 5 / Mod. 11          |
| 08  | Client Portal                 | Signed contract grants access   | Approvals → Mod. 5                    |
| 11  | Financial                     | Events from Mod. 5/6/7 + manual | AP / AR / Cash flow / QuickBooks      |
| 12  | Warranty / Post-Delivery      | Project delivered               | Repair / New proposal → Mod. 2        |

### Layers and Platform

| #   | Layer / Platform            | Function                                                                             |
| --- | --------------------------- | ------------------------------------------------------------------------------------ |
| 09  | Admin Master (Multi-Tenant) | Tenant management, plans, billing (Stripe), global templates, feature flags, support |
| 10  | Centralized Notifications   | Rules engine (event + role + channel), multiple channels, automatic escalation       |
| ★   | Master Data + Inventory     | Base records feeding all modules; Inventory sub-module transferable across projects  |
| ★   | Dashboards                  | Views: Global (executive) / Per Module / Per Project                                 |

---

## 3. Module 1 — Lead Intake & Qualification

Initial capture of project opportunities, with AI-driven triage and human validation.

### 3.1 Inputs

- **Email scraper:** monitors registered company inbox, identifies new projects, automatically registers client and project.
- **Manual entry:** user can enter a lead directly into the system without depending on email.

### 3.2 AI Pre-Screening

- Configurable criteria: distance, work type, union project, state project, among others.
- AI auto-rejects leads that do not meet criteria.
- Rejected leads stay archived — can be manually reopened.

### 3.3 Human Review

- User with permission (View / Edit / Approve) performs second analysis.
- Can accept or reject; can reopen leads previously rejected by AI.

### 3.4 Output

- Approved lead is forwarded to Module 2 (Estimate & Proposal) and assigned to an Estimator.

---

## 4. Module 2 — Takeoff, Estimate & Proposal

Estimating core: the approved lead becomes a project. The system offers **TWO PATHS** depending on project size and complexity — one with AI analysis via Cowork, the other 100% manual using Master Data.

### 4.1 PATH A — AI Analysis (mid and large projects)

Recommended for mid and large projects where AI analysis adds value.

**Project Setup:**

- Estimator assigned to the approved lead.
- Folder structure with upload of drawings, specs, manuals and addendums.

**Cowork Analysis (Desktop):**

- Skills configured by service type (siding, sheet metal, finish carpentry) or general skill.
- Cowork analyzes: scope, services, materials, man-hours, productivity, schedule, histogram, risks.
- Output as a standard structured file (see `docs/cowork-import-schema.md`).
- Extracted values feed pricing and productivity sheets.

### 4.2 PATH B — Manual Estimate (small jobs)

For small jobs that don't justify AI analysis effort — spot repairs, simple services, fast quotes where scope is well known.

**Direct project entry:**

- Estimator registers the project and creates the estimate without going through AI.
- Adds existing classifications already in the database (Master Data: services, materials, productivity, labor).
- Can create a new classification on the fly if not yet in the catalog.
- Quantities, unit prices and totals entered manually.

**Operational advantage:**

- Faster turnaround: ideal for quick proposals when scope is straightforward.
- Reduces AI token cost on small jobs.
- Keeps the estimator in control when human experience is enough.

### 4.3 Estimate & Proposal (both paths)

- Estimator reviews, edits and approves the estimate.
- Proposal generated with fixed template + dynamic fields.
- Sent to client company and registered contact.

### 4.4 Status and Tracking

- In Analysis → In Preparation → Sent → Finalist → Won / Lost (manual transitions).

---

## 5. Module 3 — Contract Analysis & Signature

AI-powered contractual risk analysis, dual flow (Exhibit + Contract or Direct Contract) and digital signature via DocuSign.

### 5.1 Standard Flow (with Exhibit)

- Client sends Exhibit first.
- AI analyzes: risk score, comparison vs Proposal (hidden items, out of scope), discrepancies, sensitive terms.
- Output: text summary with risk bullets.
- Human review: approves or requests adjustment.
- Signature via DocuSign and return to client.
- Client sends main contract → AI re-analysis (consistency with Exhibit).
- Approval + DocuSign signature.

### 5.2 Alternate Flow (Direct Contract)

- Estimator or permitted user skips the Exhibit phase.
- AI compares contract directly against original Proposal.

### 5.3 Module Features

- Multiple authorized signatories (Signatory role separate from Approve).
- Full version history + AI report per version.

---

## 6. Module 4 — Pre-Execution (Project Setup)

Complete project setup after contract is signed. Creates the structures consumed during execution.

### 6.1 Dual WBS (Client and Subcontract)

- **Client WBS:** agreed values with client; phases customizable by project PM (each project may have different phases).
- **Subcontract WBS:** automatically generated when assigning a subcontract; sub's negotiated values.
- **Link:** physical progress identical on both (mirror); financial progress can be adjusted by PM on Client WBS (for cash flow), without affecting the sub's WBS.

### 6.2 BOM and Submittals

- Consolidated BOM from the estimate.
- Multiple submittals possible with PDF generated in standard template.
- Status: Pending / Submitted / Approved / Rejected / Revise & Resubmit.

### 6.3 Staggered Purchasing

- System generates a current purchase list (does not buy everything at once).
- PM requests purchase → goes to Module 6.

### 6.4 Subcontracts

- Assigned by service (auto-generates Subcontract WBS).
- Subcontract agreement generated by AI (templates + clauses from client contract + Sub WBS scope).
- Subcontract document repository (pulls from Master Data + project-specific customizations).

### 6.5 Required Documentation

- Standard list in Master Data + project-specific customizations.
- Variable requirements (e.g., $5M Umbrella, $2M, or none).
- Validity tracking with alerts.

### 6.6 Equipment and Rentals

- Planning with scheduled in/out dates.
- Auto PO at scheduled date → Module 6.
- Budget vs actual tracking (dates, costs, vendor).

### 6.7 Schedule and Histogram

- Built here (Cowork basis) and visible/updated in Module 5 with real progress.

---

## 7. Module 5 — Execution / CECS

Project tracking brain. Combines complete PM view, field mobile app, specialized sub-modules and billings.

### 7.1 WBS View and Synchronization

- PM sees complete Client WBS; can advance any item (including for low-tech subs).
- Subcontractor sees only its Subcontract WBS (no client values).
- Sub progress → reflects in Client WBS after PM approval.
- PM progress → reflects in Subcontract WBS automatically.
- Extra financial progress in Client WBS (cash flow) does not affect the sub.

### 7.2 Change Orders

- **Sub → GC:** subcontractor creates CO; PM approves; becomes addition to subcontract.
- **GC → Client:** PM creates CO; Director approves internally; client approves; becomes addition to client contract.
- Materials in CO automatically generate purchase request to Module 6.
- Attachments: photos, dates, hours, values, materials.

### 7.3 Sub-modules

- **Plan Viewer:** drawings viewer with measurement (scale calibration), markup, geolocated pins, version comparison.
- **RFI Log:** auto numbering, SLA tracking, link to WBS/open item/CO, PDF/Excel export.
- **Safety:** Toolbox Talks with digital signature, training with validity, incidents/near miss, inspections.
- **Punch List:** activated near delivery; pin in Plan Viewer; final verification; standard PDF export.
- **Daily Reports:** weather, crew present, activities, incidents, photos.
- **Open Items:** per WBS item; auto email to responsible parties.
- **Non-CO material requests:** missing or extras without passing on to client; goes to Module 6.
- **Photo Gallery + Timeline:** per item, geolocated and timestamped.

### 7.4 Costs: Budget vs Actual

- Comparison panel fed by POs, approved COs, materials, equipment, labor.
- By service, category and project total.

### 7.5 Billings

- **Client:** industry-standard AIA (G702/G703), monthly (1st–30th), includes approved additions.
- **Subcontract:** bi-weekly or monthly per agreement; PM sets date and system pulls executed amount.

### 7.6 Mobile App

- iPad and smartphone, offline-first with automatic sync.
- Progress (% or quantity), photos with GPS+timestamp, open items, COs, daily reports.
- Weekly crew list (subcontract updates).
- WBS, submittals and documents view with offline cache.
- Role-based login (full PM / restricted sub / mid-level foreman).

---

## 8. Module 6 — Purchasing & Rentals

Centralizes company purchasing and rentals, with mandatory quote flow and integration with receiving and financial.

### 8.1 Inputs

- Initial purchase list from Module 4 (approved submittals).
- Material requests from Module 5 (PM or subcontractor).
- Scheduled rentals from Module 4 (dates).
- Materials from approved Change Orders.

### 8.2 RFQ — Request for Quote

- Minimum of 3 quotes before issuing PO.
- RFQ sent to multiple vendors; side-by-side comparison (price, lead time, terms).
- Quote history as basis for future purchases.

### 8.3 PO — Purchase Order

- Value-based approval (configurable per tenant).
- Numbered PO with vendor, values, terms, standard PDF and email delivery.

### 8.4 Q&A between Purchasing and PM

- Purchasing can raise questions in-system; PM responds without leaving.
- History linked to the request with notifications.

### 8.5 Receiving (Mobile)

- PM or foreman confirms receipt on site with photo and data.
- Discrepancies (missing, wrong, damaged) generate open items.

### 8.6 Output to Financial

- Vendor invoice → Module 11 for approval and payment.
- Closed PO feeds Module 5's Budget vs Actual.

---

## 9. Module 7 — Workforce Tracking

Operational tracking and own-labor cost calculation per project. Does not replace HR/payroll — it's tracking and cost.

### 9.1 Time Clock (Mobile + GPS)

- Employee clocks in/out via app.
- GPS validates location (configurable project radius).
- Optional photo for identity confirmation.

### 9.2 Project Allocation

- Employee selects which project they're working on.
- Can allocate to a specific WBS phase (optional).
- Multiple projects same day: records travel time.

### 9.3 Automatic Cost

- Hourly rate from Master Data; multiplies by recorded hours.
- Cost flows directly into the project (Budget vs Actual).
- Linked to phase if allocated by phase.

### 9.4 Per-Employee View

- Total hours and consolidated cost across all projects.
- Distribution across projects; configurable period.

### 9.5 PM Validation

- PM validates daily/weekly entries.
- Can adjust (correct hours, transfer between projects, mark absence).
- Adjustment history (audit).

### 9.6 Reports

- Location history; travel time; overtime; absences.

---

## 10. Module 8 — Client Portal

Dedicated external portal for the client: progress, approvals, communication and financial history.

### 10.1 Access

- Dedicated login, separate from internal users.
- Multi-project: clients with multiple projects see all of them.
- Multi-contact: multiple client people with individual permissions (View / Approve).

### 10.2 Project View

- Physical progress %, schedule, upcoming milestones, overall status.

### 10.3 Documents

- Signed contract, submittals (approved/pending), COIs, weekly crew list.

### 10.4 Approvals

- Submittals: approve / reject / request revision directly in portal.
- Change Orders: review photos and justifications, approve or reject.
- Monthly AIA: review and approve.
- All approvals digitally signed via DocuSign.

### 10.5 Communication

- Chat with project PM; auto notifications to client.

### 10.6 Financial History

- Approved AIAs, pending/received payments, approved COs, totals (contracted / executed / billed / paid).

---

## 11. Module 9 — Admin Master (Multi-Tenant)

Platform layer used by the Construction Management Platform team — not by tenants.

### 11.1 Tenant Management

- Create / suspend / deactivate tenants.
- Full company registration (EIN, owner, address, contacts).

### 11.2 Plans and Billing

- Plans with limits: users, active projects, storage, modules, AI tokens.
- Recurring billing via Stripe.
- Tenant invoices; dunning control.

### 11.3 Global Settings

- Standard templates (G702/G703, RFI, PO, RFQ).
- AI prompts and models.
- Integration catalog (DocuSign, Cowork, QuickBooks, etc.).

### 11.4 Operations

- Per-tenant activity logs; metrics (DAU, MAU, most-used modules).
- Support tickets; audit trail.
- Onboarding with setup wizard and initial Master Data import.
- Feature flags / gradual rollout.

---

## 12. Module 10 — Centralized Notifications

Cross-cutting layer that standardizes notifications across all modules.

### 12.1 Rules Engine

- Rules: event + role + channel + urgency (Normal / High / Critical).
- Editable templates with dynamic variables.

### 12.2 Supported Channels

- Email with tenant branding.
- Push notification (mobile).
- In-app (bell).
- SMS (critical events).
- WhatsApp (future).

### 12.3 User Preferences

- Opt-in/out per event and channel.
- Do Not Disturb mode (hours, weekends).
- Optional daily/weekly digest.

### 12.4 Escalation

- No action in X time → escalates to superior (configurable per event type).

### 12.5 History

- Who received, when, read and clicked.
- Useful for audit and system improvement.

---

## 13. Module 11 — Financial

Focus on project inflows and outflows with automatic entries from other modules + manual misc entries.

### 13.1 Automatic Revenue

- Client-approved AIA → account receivable.
- Client payment received → cash receipt entry.
- Client-approved Change Order → adds to receivable balance.

### 13.2 Automatic Expenses

- Material PO approved and received → account payable.
- Approved rental PO → account payable.
- Vendor invoice → AP with due date.
- Approved subcontract billing → AP.
- Weekly payroll (from Mod. 7) → automatic expense.

### 13.3 Manual Entries

- Misc expenses: fuel, coffee, extra PPE, tools, maintenance.
- Entry with date, amount, category, project (optional), vendor, receipt (photo/PDF).
- Categories configurable in Master Data.

### 13.4 Approval and Payment

- Payables go through approval before payment.
- Status: Pending Approval / Approved / Paid / Rejected.
- Payment scheduling; manual reconciliation (future bank integration).

### 13.5 Views

- Per project: revenues, expenses, balance, real margin (feeds Mod. 5 Budget vs Actual).
- Company: cash flow, consolidated AP/AR, simplified P&L.

### 13.6 Future Integration

- Hooks for QuickBooks (entry export).

---

## 14. Module 12 — Warranty / Post-Delivery

Post-delivery: warranty call management, triage, repair execution and historical analysis.

### 14.1 Warranty Setup

- Warranties per service/area (e.g., structure 5 years, finishes 1 year, equipment per manufacturer).
- Attached documents (manuals, certificates).

### 14.2 Service Calls

- Client opens call via Portal (description, photo, Plan Viewer pin).
- Auto numbering.
- Status: Open / Under Review / Approved / Rejected / Scheduled / In Progress / Resolved / Closed.

### 14.3 Triage

- Coverage analysis: covered (free) / not covered (quote) / disputed.
- Not covered → becomes new proposal (back to Mod. 2).

### 14.4 Repair Execution

- Assignment to employee or subcontractor.
- Repair mini-WBS.
- Cost recorded (project warranty pool).
- Before/after photos; client approval that repair is complete.

### 14.5 Historical Analysis

- Defect patterns by service.
- Subcontractor performance (who leaves more defects).
- Total warranty cost per project (impacts real margin).

---

## 15. Master Data (Cross-Cutting Layer)

Single source of truth for the base records that feed all modules.

### 15.1 Records

- Clients (companies) and their contacts.
- Employees (with hourly rate, certifications, Boston base).
- Subcontractors (separate from employees).
- Suppliers (vendors; price and performance history).
- Materials (catalog, units, specs, vendors).
- Services and detailed specifications (reference for Cowork AI and for Manual Estimate).
- Productivity (man-hours, crew compositions, waste factors).
- Salaries / Labor Rates (restricted access).
- Equipment / Tools.
- Units of Measure.
- Regions / Locations (MA, FL with regional multipliers).
- Project Types (union, state, private, federal).
- Document Templates (proposal, contract, RFI, PO, etc.).

### 15.2 Features

- Granular permissions — sensitive records with restricted access (Salaries, employee data).
- Change history (especially Materials, Salaries, Prices).
- Bulk import via CSV/Excel for initial setup and batch updates.

### 15.3 Sub-module: Inventory

- Leftover material from a project enters inventory.
- Can be transferred to another project.
- Transfer creates cost on destination project, credit on origin project.
- Location, quantity and condition control.

---

## 16. Key Integration Points Between Modules

| Connection                         | Description                                                                                                        |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Cowork ↔ Mod. 2 (AI Path)          | Estimator sends drawings/specs; Cowork returns structured analysis; feeds pricing and productivity sheets.         |
| Master Data → Mod. 2 (Manual Path) | Estimator uses existing classifications (services, materials, productivity, labor) or creates new ones on the fly. |
| Mod. 2 → Mod. 3                    | Won-status proposal triggers contract flow. AI uses Proposal as comparison baseline.                               |
| Mod. 3 → Mod. 4                    | Signed contract releases Pre-Execution. Client contract clauses feed AI when generating subcontract.               |
| Mod. 4 → Mod. 5                    | WBSs, BOM, schedule and histogram travel to execution. Submittals and equipment trigger Mod. 6.                    |
| Mod. 5 ↔ Mod. 6                    | Material requests, COs and equipment generate POs/RFQs. Receiving closes the procurement loop.                     |
| Mod. 5 ↔ Mod. 7                    | Mobile time clock triggers automatic project cost (Budget vs Actual).                                              |
| Mods. 5 / 6 / 7 → Mod. 11          | AIA, POs, invoices, payroll — all auto-generate Financial entries.                                                 |
| Mod. 5 ↔ Mod. 8                    | Client sees progress, approves Submittals/CO/AIA via portal — syncs with execution.                                |
| Mod. 5 → Mod. 12                   | After delivery, project enters warranty. Service Calls may become new Proposal (back to Mod. 2).                   |
| Mod. 10 → All                      | Configurable notifications by event, role and channel. Auto escalation on SLAs.                                    |
| Master Data → All                  | Single source of truth for clients, employees, materials, services, regions and templates.                         |
| Mod. 9 → Platform                  | Multi-tenant, billing, global templates, feature flags, support. Full isolation between tenants.                   |

---

## 17. Suggested Next Steps

Based on this vision, the following incremental approach is suggested for development:

- **Phase 1 — Foundation:** Master Data + Admin Master (multi-tenant base) + Permissions + Lead Intake.
- **Phase 2 — Sales Core:** Estimate & Proposal (with Cowork import and manual flow) + Contracts + DocuSign.
- **Phase 3 — Operations Core:** Pre-Execution (dual WBS) + Execution (web) + basic Mobile App.
- **Phase 4 — Supply Chain:** Purchasing (RFQ/PO/Receiving) + Workforce Tracking.
- **Phase 5 — External and Financial:** Client Portal + Financial (automatic entries).
- **Phase 6 — Post-Delivery and Refinement:** Warranty + advanced Notifications + complete Dashboards.
- **Phase 7 — Integrations:** QuickBooks, banking, WhatsApp, and AI maturation.

### Pending Decisions

- Define the Cowork import file schema (required fields) — in progress, see `cowork-import-schema.md`.
- Define exact templates: AIA G702/G703, RFI, PO, Submittal, contracts.
- Define PO value-based approval limits (default per tenant).
- Define standard SLAs for notification escalation.
- Define billing plan structure (Starter / Professional / Enterprise).

### Final Notes

The architecture described here is modular by design — each module can evolve independently, but they all consume the same Master Data and respond to the same notifications engine. This ensures the system grows consistently without losing cohesion.

The mobile-first focus on field functions (Mod. 5 and Mod. 7) is a key competitive advantage: most competing systems still force desktop usage, which reduces field adoption.

The multi-tenant nature opens the path to commercializing the platform as SaaS for other construction companies, multiplying the value of the development investment.

Including the Manual Estimate path (without AI) in Module 2 ensures small jobs and fast quotes are not bogged down by the AI flow, keeping turnaround fast and operational cost low.

---

_End of Document._
