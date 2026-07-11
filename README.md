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
above. A manager approves each request with a TOTP code (set up in Settings); approvals are
time-boxed and every transition is audited. One approval engine, three sub-tabs:

- **Devices** (live) — USB storage, CD/DVD, and **phones (MTP/WPD)**. A Python agent on each
  employee's Windows PC blocks the device by default; insertion files a request; approval unlocks
  it for X minutes. Risk badge, per-request audit timeline, device whitelist, and machine
  registration with online / last-seen / agent-version status.
- **Browser** (live) — per-domain policy: **Allow / Block / Approval-required**. A Chrome + Edge
  MV3 extension enforces it via the local agent; approval-required sites reuse the same TOTP
  approval + time-boxed grant. Sub-sections: Active Sessions, Blocked Websites, Pending Website
  Requests.
- **Mail** (placeholder) — Zoho external-mail attachment approvals (see
  [docs/v4-zoho-mail-brainstorm.md](docs/v4-zoho-mail-brainstorm.md)).

Roadmap: USB ✅ · CD/DVD ✅ · phones/MTP ✅ · browser policy ✅ → printing → cloud-storage &
web-messaging domains (just policy rows now) → app-control (block side-installed browsers) →
external mail.

**Setup & deploy:** see [docs/SETUP.md](docs/SETUP.md) for the go-live checklist (publish the
extension, wire its ID into the installer, register machines). Agent, extension, backend routes,
and the Windows CI build live in [agent/](agent/README.md) and [extension/](extension/) — the
installer is built by GitHub Actions on `windows-latest` (no Windows machine needed for
development; a simulator covers logic testing on macOS). Enrollment is zero-typing (a per-machine
`shanti-enroll.json`), and the agent **auto-updates** from a tagged GitHub Release.

## Layout

`lib/` (db, auth, sla/delay engine, milestone taxonomy, data helpers, formatters, packing-pdf,
`usb.js`/`browser.js` approval domain logic, `enroll.js` codes) · `app/` (pages + API routes,
incl. `api/agent`, `api/usb`, `api/browser`) · `components/` (nav, project/milestone/packing UI,
settings forms, `DevicesPanel`/`BrowserPanel`/`TotpSetup` for Approvals) · `components/ui/`
(shadcn primitives) · `agent/` (Python Windows agent + CI build) · `extension/` (Chrome/Edge MV3
browser-policy extension).

## Notes

- `depends_on_key` on milestones is a dormant hook for a future dependency/critical-path layer.
- Reset dev data: delete `shanti-ops-local.db` (local mode) — reseeds on next start.
