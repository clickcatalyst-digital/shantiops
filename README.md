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

## Demo logins

| Login | Password | Role | Sees |
|-------|----------|------|------|
| `admin` | `admin123` | admin | Today's Factory + Executive |
| `manager` | `manager123` | manager | Today's Factory + Executive |
| `ravi` | `ravi123` | operator | My Work |
| `suresh` | `suresh123` | operator | My Work |
| `customer` | `customer123` | customer | Customer Portal (SB-1018) |

## Three views

- **Operations** (`/`, `/projects/[id]`) — exception-driven daily execution: health header with a
  "why is this delayed?" hero, needs-attention band, collapsible components → milestone cards → edit
  drawer (type-specific fields) → bulk-edit grid → swimlane timeline.
- **Executive** (`/executive`) — KPIs, top risks, "delayed because", delivery forecast.
- **Customer Portal** (`/portal/[id]`) — read-only phase stepper in business language + packing-list
  download.

## Packing (`/packing`)
Pending / Ready / Dispatched board; each list is a printable digital replica of the master packing
list (Print → Save as PDF).

## Layout
`lib/` (db, auth, sla/status engine, milestone taxonomy, data helpers, formatters) · `app/` (pages +
API routes) · `components/` (header, today band, accordion, cards, drawer, swimlane, board, nav).

## Notes
- `depends_on_key` on milestones is a dormant hook for a future dependency/critical-path layer.
- Reset dev data: delete `shanti-ops-local.db` (local mode) — reseeds on next start.
