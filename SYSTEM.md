# Shanti Ops — Manufacturing Operations Platform

A single web app that runs a boiler order from **design to commissioning** and replaces the manual
packing list. SLA/milestone tracking and dispatch are one system: the same project row, different
stages.

This document reflects the **current, working build**.

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
department**, not per project — the single access-scoping unit.

**Departments:** Design, **Engineering** (owns the Bill of Materials — no milestones of its own),
Procurement, Production, QC, **Dispatch** (owns Packing), Installation.

| Login | Password | Role | Access |
|-------|----------|------|--------|
| `admin` | `admin123` | **PM** | Everything — all projects, all departments. Owns project creation. |
| `manager` | `manager123` | **PM** | Same as admin (they were always identical). |
| `ravi` | `ravi123` | **Functional Head** | Production department only (demo). |
| `suresh` | `suresh123` | **Functional Head** | Procurement department only (demo). |
| `customer` | `customer123` | Customer | One order, read-only, business language. |

- **PM** creates projects, owns the schedule (planned dates), edits any milestone, uploads BOMs, and
  manages access. Lands on **Executive**. Top nav: **Executive · Operations · Projects** — the
  Departments picker, Settings, theme toggle, and Logout all live in the **cog dropdown** (no
  standalone Packing tab; reached via Departments → Dispatch).
- **Functional Head** does the data entry operators used to. Scoped to their granted department(s):
  they only see/act on milestones in those departments, get a **read-only** Projects list (no
  "+ New Project"), and see **Packing** only if granted **Dispatch**. A head assigned more than one
  department gets **one tab per department in the top nav**. Empty state if unassigned: "No
  departments assigned yet — contact your PM."
- Access is granted by the PM in **Settings → Access Matrix** (heads × departments grid) alongside
  **User Management** (create / deactivate heads). Enforced at the route/API level via
  `requirePM` / `requireDepartment` / `canAccessDepartment` in `lib/auth.js`.

**Known gap (deferred — needs more detail on per-department workflows):** Departments →
Engineering on the Operations page currently shows the generic attention list, which is always
empty for Engineering (it has no milestones of its own) — a real Engineering workspace lands once
that's specced out.

---

## 3. Operations view (daily execution)

- **PM** sees *Today's Factory* (everything); a **head** sees *My Work* (their department(s) only).
  Both lead with **summary chips** (overdue / blocked / due-soon counts).
- The Departments picker (PM, in the cog) and department tabs (multi-department head, in the top
  nav) filter this view via `?dept=`.
- **Special case — Dispatch:** picking the Dispatch department renders the **Pending → Ready →
  Dispatched packing board** (`components/DispatchBoard.jsx`) instead of the generic attention
  list, since packing lives entirely under Dispatch.

### Project page — top to bottom

The layout adapts to who's looking:

1. **Row 1 — identity + attention (two columns):** project header (name, status, "why is this
   delayed?" blocker callout, PM/value/updated, Customer-view link) beside **Needs Attention**
   (only the milestones that matter right now, scoped to the viewer's department if they're a head).
2. **Row 2 — Milestone Tracker:** the same component as the Executive dashboard
   (`components/PortfolioDelayTimeline.jsx`), scoped to this one project — its stages as a
   connected, color-coded bar with a today-marker, expandable into a per-stage pill chain (status,
   delay delta, actual dates), cumulative dispatch delay at the end.
3. **Row 3 — department work**, which differs by role:
   - **PM/admin** see an **all-departments tab strip** (underline style, `components/ProjectDepartmentTabs.jsx`)
     — one tab per department, with a red dot on any department that has an overdue/blocked
     milestone.
   - **Functional head** sees their own department(s) as stacked sections (no tabs) — each is a
     `components/DepartmentPanel.jsx`.
   - Each department's panel (`DepartmentPanel`) shows: that department's milestones via
     `MilestoneBoard`/`MilestoneCard` → edit drawer (`MilestoneDrawer`), plus a department-specific
     panel where relevant — **Engineering → Bill of Materials** (`BomPanel`), **Dispatch →
     Packing** (`PackingPanel`, this project's packing lists + generate-from-BOM).
   - **Milestone edit drawer:** PM gets the full editable form (all fields) + a bulk spreadsheet
     grid. **Functional heads get a reduced drawer** — schedule (planned dates) is read-only, with
     two actions: **Start** (stamps actual start) and **Close** (stamps actual end); closing late
     prompts for delay category + reason.

### Status colours

`Not started` (gray) · `On track / In progress` (blue) · `Running late` (amber) · `Blocked` (red) ·
`Closed` (green). Each milestone's colour merges its human status with its deadline automatically
(`lib/sla.js`, `lib/delay.js`).

---

## 4. Executive view

Order, top to bottom:

1. **KPIs** — projects, healthy, delayed, critical, completed, average delay (days), value in
   progress.
2. **Milestone Tracker** — the portfolio-wide version of the project-page tracker: one row per
   project, stages as a connected bar, today-marker, cumulative delay, expandable per-stage detail.
3. **Top Risks** (worst blocker per project, ranked by dispatch impact) + **Delayed Because** (by
   category), side by side.
4. **Delivery Forecast** — one row per project: Project · Customer · Health · Progress % · Current
   stage · Delay (±days) · Value · Est. Dispatch.

---

## 5. Packing & BOM (the digital packing list)

The Dispatch department board: **Pending → Ready → Dispatched**. BOM-driven flow:

1. **Engineering (or PM) uploads a BOM** (flat, one list per project) via the Engineering panel on
   the project page.
2. **Dispatch generates a draft packing list** from still-pending BOM lines (Engineering tab's BOM,
   or the Dispatch tab's own panel) — `Material description`, `MOC`, `Size/Spec` prefilled;
   `IBR No.`, `Item code`, `Box No.`, `Qty`, `Make` left for the Dispatch head to fill.
3. On approval (status ≥ Ready), rows feed the board.
4. **Reconciliation:** any BOM line not yet on an approved packing list stays **Pending** and can
   seed a new list later (partial dispatch). Each packing item links back via `bom_item_id`.
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

- **Next.js 14** (App Router) + **React 18**. Server components read data directly; API routes
  handle writes, auth, and PDF generation. PDFs via `@react-pdf/renderer` (pure Node, externalized
  in `next.config.js`).
- **UI: Tailwind CSS v4 + shadcn/ui** (radix primitives in `components/ui/`). Theme tokens (premium
  palette + status colors) live in `app/globals.css`; dark mode via the `[data-theme="dark"]` toggle
  in `components/Nav.jsx`. Toasts via `sonner` (`showToast` in `lib/client.js` wraps it).
- **Responsive layout:** the content column is defined once — an unlayered `.container` rule in
  `app/globals.css` (centered, `max-width: 1760px`, fluid `clamp` padding) — so it's balanced on a
  1920 monitor (symmetric gutters) and comfortable on mobile. **Mobile is app-like:** desktop
  top-tabs collapse into a fixed **bottom tab bar** (icons) below `md`; tables like Projects render
  as cards on mobile, a table on desktop.
- **Delay visualization:** one component, `components/PortfolioDelayTimeline.jsx`, does double duty
  — the portfolio-wide **Milestone Tracker** on Executive, and (scoped to a single project) the
  per-project tracker on the project page. Shared delta math lives in `lib/delay.js`.
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

> Note: don't run `npm run build` (production) against the same working tree while `npm run dev`
> is pointed at it — mixing build output and dev-server output in one `.next` folder corrupts it
> (missing vendor chunks, pages render unstyled). If that happens: stop the dev server,
> `rm -rf .next`, restart.

---

## 9. Deliberately deferred

Dependency graph / auto critical-path (`depends_on_key` column in place), activity feed, file/photo
uploads, barcode/QR validation at dispatch, email/WhatsApp notifications, and real per-department
workspaces beyond Engineering's BOM and Dispatch's packing (QC, Installation, Design, Procurement
currently just get their milestone list — see the known gap in §2). None block what's demonstrable
today.
