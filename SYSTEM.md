# Shanti Ops — Manufacturing Operations Platform

A single web app that runs a boiler order from **design to commissioning** and replaces the manual
packing list. SLA/milestone tracking and dispatch are one system: the same project row, different
stages.

This document reflects the **current build after the REDESIGN.md alignment** (see `REDESIGN.md` for
the rationale behind each change).

---

## 1. What it is — an operational command center, not a spreadsheet

Exception-driven and **role-aware**: it surfaces what needs attention and shows each user the right
altitude. Three experiences share one database:

| View | Who | Answers |
|------|-----|---------|
| **Operations** | functional heads, PM | "What needs doing today?" |
| **Executive** | PM | "Where are the risks and when do we ship?" |
| **Customer Portal** | the customer | "How is my order progressing?" |

---

## 2. Roles & access (department-based)

Two internal roles plus the external customer. Access for functional heads is scoped **per
department**, not per project — the single access-scoping unit. Departments: Design, **Engineering**
(owns the BOM, no milestones of its own), Procurement, Production, QC, Dispatch (owns Packing),
Installation.

**Project page is department-scoped:** a functional head sees only their department's slice — its
milestones (Start/Close) plus the one panel that applies to them (Engineering → Bill of Materials,
Dispatch → Packing). PM/admin see an **all-departments tabbed card** (one tab per department, each
showing that department's milestones + actions). Packing is reached via **Departments → Dispatch**
(no standalone tab). See `components/ProjectDepartmentTabs.jsx`, `DepartmentPanel.jsx`,
`PackingPanel.jsx`, `BomPanel.jsx`.

| Login | Password | Role | Access |
|-------|----------|------|--------|
| `admin` | `admin123` | **PM** | Everything — all projects, all departments. Owns project creation. |
| `manager` | `manager123` | **PM** | Same as admin (they were always identical). |
| `ravi` | `ravi123` | **Functional Head** | Production department only (demo). |
| `suresh` | `suresh123` | **Functional Head** | Procurement department only (demo). |
| `customer` | `customer123` | Customer | One order, read-only, business language. |

- **PM** creates projects, owns the schedule (planned dates), edits any milestone, uploads BOMs, and
  manages access. Lands on **Executive**. Nav: Executive · Operations · Projects · Packing ·
  **Departments ▾** (peek into any department) · cog → Settings.
- **Functional Head** does the data entry operators used to. Scoped to their granted department(s):
  they only see/act on milestones in those departments, get a **read-only** Projects list (no
  "+ New Project"), and see **Packing** only if granted **Dispatch**. With more than one department
  they get one **tab per department**. Empty state if unassigned: "No departments assigned yet —
  contact your PM."
- Access is granted by the PM in **Settings → Access Matrix** (heads × departments grid) alongside
  **User Management** (create / deactivate heads). Enforced at the route/API level via
  `requirePM` / `requireDepartment` / `canAccessDepartment` in `lib/auth.js`.

---

## 3. Operations view (daily execution)

- **PM** sees *Today's Factory* (everything); a **head** sees *My Work* (their departments only).
  Both lead with **summary chips** (overdue / blocked / due-soon counts) and the delay chain inline.
- The Departments dropdown (PM) and department tabs (multi-department head) filter this view via
  `?dept=`.

### Project page — top to bottom
1. **Health header** — the hero "Why is this delayed?" (worst blocker + dispatch impact), progress %,
   current phase, next milestone, estimated dispatch.
2. **Needs Attention band** — only the milestones that matter right now.
3. **Delay Chain** (primary visual) — the 25 milestones as a left→right sequence of connected nodes
   in fixed workflow order, colored by state (closed / running-late / blocked / on-track / not-started),
   each showing its own days-early/late delta, with the **cumulative** total on the final node.
4. **Milestone board** — card grid → edit drawer. PMs get the full editable drawer + a bulk grid.
   **Functional heads get a reduced drawer**: schedule is read-only, with two actions — **Start**
   (stamps actual start) and **Close** (stamps actual end); closing late prompts the head for the
   delay category + reason. Heads only see their own department's milestones here.
5. **Bill of Materials** — see §5.
6. **Milestone Timeline (swimlane)** — the full-detail date view, collapsed, sits below the chain.

### Status colours
`Not started` (gray) · `In progress` (blue) · `Blocked` (purple) · `Due soon` (yellow) ·
`Due ≤2d` (orange) · `Overdue` (red) · `Completed` (green).

---

## 4. Executive view

KPIs (projects, healthy, delayed, critical, completed, avg delay, value in progress), Top Risks
(worst blocker per project by dispatch impact), Delayed Because (by category), Delivery Forecast.

---

## 5. Packing & BOM (the digital packing list)

Board: **Pending → Ready → Dispatched**. The new flow is BOM-driven:

1. **PM uploads a BOM** (flat, one list per project) on the project page.
2. **Dispatch generates a draft packing list** from still-pending BOM lines — `Material description`,
   `MOC`, `Size/Spec` prefilled; `IBR No.`, `Item code`, `Box No.`, `Qty`, `Make` left for the
   Dispatch head to fill.
3. On approval (status ≥ Ready), rows feed the board.
4. **Reconciliation:** any BOM line not yet on an approved packing list stays **Pending** and can seed
   a new list later (partial dispatch). Each packing item links back via `bom_item_id`.
5. **Real PDF generation** (`@react-pdf/renderer`): "Generate PDF" streams a document matching the
   SB-IBR-1018 layout (company header, buyer/invoice/DC block, item table, 7-day declaration,
   Stores/Production/QC/Management sign-off). A separate **Pending-list PDF** exports unpacked lines.

---

## 6. Customer Portal (read-only, external)

- Business-language **phase stepper** (Order Received → … → Commissioning), overall %, est. dispatch.
- A packing-list link that opens a **read-only document view** (Print / Generate PDF only) — no
  editing, and only once the list is past draft (≥ Ready). Enforced at the route and API level.
- A customer only ever sees their own order.

---

## 7. Architecture

- **Next.js 14** (App Router) + **React 18**. Server components read data directly; API routes handle
  writes, auth, and PDF generation. PDFs via `@react-pdf/renderer` (pure Node, externalized in
  `next.config.js`).
- **UI: Tailwind CSS v4 + shadcn/ui** (radix primitives in `components/ui/`). Theme tokens (premium
  palette + status colors) live in `app/globals.css`; dark mode via the `[data-theme="dark"]` toggle
  in `components/Nav.jsx`. Toasts via `sonner` (`showToast` in `lib/client.js` wraps it).
- **Responsive layout:** the content column is defined once — an unlayered `.container` rule in
  `app/globals.css` (centered, `max-width: 1760px`, fluid `clamp` padding) — so it's balanced on a
  1920 monitor (symmetric gutters) and comfortable on mobile. Pages use multi-column grids
  (`components/PageHeader.jsx` is the shared header). **Mobile is app-like:** desktop top-tabs
  collapse into a fixed **bottom tab bar** (icons) below `md`; tables like Projects render as cards
  on mobile, a table on desktop.
- **Navigation:** PM top tabs are Executive · Operations · Projects; the Departments picker and
  Settings/Logout live in the cog dropdown. **Packing is not a top tab** — it's reached inside the
  **Dispatch department** view (`/?dept=Dispatch`), which renders the Pending→Ready→Dispatched board.
- **Delay visualization:** the **Portfolio Delay Timeline** (one row per project, stages colored by
  state, today-marker, cumulative delay) is the hero of the **Executive** tab
  (`components/PortfolioDelayTimeline.jsx`); each project page keeps a compact single-project delay
  chain. Shared delta math is in `lib/delay.js`.
- **Database: Turso (libsql)** via `.env.local`; falls back to a local SQLite file for offline dev.
- **Auth**: bcrypt + JWT in an httpOnly cookie carrying role + granted departments; role/department
  gating on pages and API routes.

```
projects ──< milestones                         (flat — design → commissioning, no unit layer)
projects ──< bom_items                           (the uploaded BOM)
projects ──< packing_lists ──< packing_items     (packing_items.bom_item_id → bom_items, reconciliation)
users (role + departments CSV + customer scoping)
```

Milestones carry: assignee, department, planned/actual dates, status, delay category + reason,
vendor/PO/material-ready/QC flags, notes, and a **dormant `depends_on_key`** for a future
dependency/critical-path layer.

---

## 8. Run

```bash
npm install
npm run dev        # http://localhost:3000
```

Demo project **SB-1018** seeds on first run as a single flat 25-stage milestone chain (completed →
an overdue/blocked vendor bottleneck → in progress → upcoming) plus the `PL-1001` packing list.
Changing the schema against an existing pre-redesign database triggers a one-time drop-and-reseed
(the demo data doesn't map onto the flattened model).

---

## 9. Deliberately deferred (phase 2)

Dependency graph / auto critical-path (`depends_on_key` column in place), activity feed, file/photo
uploads, barcode/QR validation at dispatch, email/WhatsApp notifications. None block what's
demonstrable today.
