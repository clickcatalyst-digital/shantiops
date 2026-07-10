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

## Approval platform

**Approvals** (`/approvals`) — device/data-exit control, separate from the milestone tracking
above. A Python agent on each employee's Windows PC blocks external devices by default; the
employee's insertion files a request, a manager approves it with a TOTP code from Settings,
and the device unlocks for a time-boxed window. Same engine, three sub-tabs:

- **Devices** (live) — USB storage + CD/DVD. Risk badge, per-request audit timeline, device
  whitelist, machine registration (issues the agent's auth token) with online/last-seen/version
  status.
- **Web** (placeholder) — browser upload approvals, planned.
- **Mail** (placeholder) — Zoho external-mail attachment approvals, planned.

Roadmap: USB ✅ → CD/DVD ✅ → phones/MTP → printing → browser blocking (domains/categories) →
browser upload approvals → external mail.

Agent, backend routes, and Windows CI build live in [agent/](agent/README.md) — includes an
Inno Setup installer built by GitHub Actions on a `windows-latest` runner (no Windows machine
needed for development; a Python-file simulator covers logic testing on macOS).

## Layout

`lib/` (db, auth, sla/delay engine, milestone taxonomy, data helpers, formatters, packing-pdf,
`usb.js` approval domain logic) · `app/` (pages + API routes, incl. `api/agent` and `api/usb`) ·
`components/` (nav, project header, milestone board/card/drawer, department panels, BOM/packing
panels, portfolio delay timeline, settings forms, `DevicesPanel`/`TotpSetup` for Approvals) ·
`components/ui/` (shadcn primitives) · `agent/` (Python Windows agent + CI build).

## Notes

- `depends_on_key` on milestones is a dormant hook for a future dependency/critical-path layer.
- Reset dev data: delete `shanti-ops-local.db` (local mode) — reseeds on next start.
