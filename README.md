# Shanti Ops

Manufacturing operations platform for Shanti Boilers — SLA/milestone tracking + dispatch/packing in
one app. See **[SYSTEM.md](SYSTEM.md)** for the full feature walkthrough (use that for the client).

## Run

```bash
npm install
npm run dev        # http://localhost:3000
```

Data lives in **Turso** when `TURSO_URL` + `TURSO_AUTH_TOKEN` are set in `.env.local` (they are);
otherwise it falls back to a local SQLite file. First run auto-seeds demo data.

> Don't run `npm run build` against the same folder while `npm run dev` is running — mixing
> build/dev output in one `.next` directory corrupts it. If the app renders unstyled, stop the dev
> server, `rm -rf .next`, and restart.

## Demo logins

| Login | Password | Role | Access |
|-------|----------|------|--------|
| `admin` | `admin123` | PM | Everything — all projects, all departments |
| `manager` | `manager123` | PM | Same as admin |
| `ravi` | `ravi123` | Functional Head | Production department |
| `suresh` | `suresh123` | Functional Head | Procurement department |
| `customer` | `customer123` | Customer | Portal for SB-1018 only |

Departments: Design, Engineering (BOM), Procurement, Production, QC, Dispatch (Packing),
Installation. A PM sees all of them; a functional head only sees what they're granted (Settings →
Access Matrix).

## Three views

- **Operations** (`/`) — exception-driven daily list: overdue/blocked/due-soon chips + a project
  list of what needs attention. Picking the Dispatch department here shows the packing board
  instead.
- **Projects** (`/projects`, `/projects/[id]`) — the project detail page adapts to the viewer: a
  header + Needs Attention row, a Milestone Tracker (stage-by-stage delay bar), then either an
  all-departments tab strip (PM) or the head's own department section(s), each with its milestones
  and any department-specific panel (Engineering's BOM, Dispatch's packing).
- **Executive** (`/executive`) — KPIs, the portfolio Milestone Tracker, Top Risks + Delayed
  Because, and a Delivery Forecast table.
- **Customer Portal** (`/portal/[id]`) — read-only phase stepper in business language + a
  read-only packing-list view once it's ready.

## Packing & BOM

Reached via **Departments → Dispatch** (no standalone tab). Engineering uploads a project's BOM;
Dispatch generates a draft packing list from the still-pending BOM lines, fills in the remaining
fields, and moves it through **Pending → Ready → Dispatched**. PDFs are real generated documents
(`@react-pdf/renderer`), not browser print-to-PDF.

## Layout

`lib/` (db, auth, sla/delay engine, milestone taxonomy, data helpers, formatters, packing-pdf) ·
`app/` (pages + API routes) · `components/` (nav, project header, milestone board/card/drawer,
department panels, BOM/packing panels, portfolio delay timeline, settings forms) ·
`components/ui/` (shadcn primitives).

## Notes

- `depends_on_key` on milestones is a dormant hook for a future dependency/critical-path layer.
- Reset dev data: delete `shanti-ops-local.db` (local mode) — reseeds on next start.
