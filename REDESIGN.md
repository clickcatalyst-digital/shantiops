# Shanti Ops — Redesign notes (draft)

Working notes for the next version. This captures decisions made so far and flags what's still
open. Not a spec yet — a shared understanding to build the real design from.

---

## 1. Roles

| Old name | New name | Access |
|---|---|---|
| `admin` / `manager` | **PM (Product Manager)** | Everything — all projects, all departments. Same as today's admin/manager (they were already identical). Owns project creation. |
| `operator` | **Functional Head** | Scoped to **department(s) a PM has assigned them** (e.g. Dispatch) — every project automatically, not per-project. Cannot create projects. Only sees/acts on milestones in their own department(s). |
| `customer` | Customer | Unchanged — one order, read-only, business language. |

**Removed:** no login below functional head. Functional heads do the data entry that individual
operators used to do. There's no "worker" tier.

**Confirmed:** access is granted per **Department** — the field that already exists on every
milestone (Design, Procurement, Production, QC, Dispatch, ...). The earlier separate
"modules/Functions" idea is dropped; Department *is* the access-scoping unit. One access matrix,
one vocabulary, used both for the PM's browse dropdown (section 2) and the settings assignment
screen (section 3).

**Confirmed:** access is department-wide, not per-project. Assigning a functional head to
"Dispatch" means every project's dispatch work, automatically.

**Confirmed:** project creation ("+ New Project") is PM/engineering-only. A functional head has
nothing to originate a project from.

**Confirmed:** a functional head only sees milestones tagged with their own department(s) —
not the whole project's milestone list.

---

## 2. Navigation structure

**PM:**
- Executive is the default landing tab — strategic-first.
- Top nav: Executive · Operations · Projects · [Departments ▾] · (cog: Settings).
- Departments (Design, Procurement, Production, QC, Dispatch, ...) are not top-level tabs for a
  PM — they live behind a **Departments** dropdown next to Settings (renamed from the earlier
  "Functions" placeholder, now that it's unified with the milestone Department field), so a PM
  can peek into any department's work on demand without it cluttering daily nav.

**Functional head:**
- If a head is assigned more than one department, they navigate between them via **tabs across
  the top, one per assigned department**.
- Operations ("My Work") sits alongside their department tab(s), filtered to their own department
  only.

---

## 3. Settings

Role-dependent — not the same screen for everyone.

**Every role:**
- Change password
- Profile — display name, contact number

**PM only, in addition:**
- **Access matrix** — every functional head and which department(s) they're granted. Rows: heads.
  Columns: departments (Design, Procurement, Production, QC, Dispatch, ...). A PM toggles access
  on/off per department; a head can hold multiple. Same list as the PM's Departments dropdown in
  section 2.
- **User management** — creating/deactivating functional head accounts, alongside the access
  matrix.
- SLA thresholds (what counts as "due soon" vs "overdue") are already editable today — no gap
  here.

**Open question:** empty state — what does a functional head see if they've been created but not
yet assigned any department?

---

## 4. Components / units — removed

Originally the model was Project → Component (Boiler/Chimney/Dust collector) → Milestones. This is
**dropped**. Boiler/Chimney/Dust Collector in the seed data were confirmed to likely be
demo-only examples, not a real recurring structure — a real order is simpler than that. Milestones
now belong **directly to the project**, flat, no intermediate unit layer. If genuine multi-unit
orders come up later, this can be revisited, but the default is simple: one project, one
milestone list.

---

## 5. Milestone workflow — functional head view (simplified)

Per the milestone drawer screenshot: today it exposes Assignee, Department, Status, Planned
Start/End, Actual Start/End, Delay category/reason, Notes — all editable.

**Confirmed: functional heads get a reduced version of this.**

- **Read-only:** Assignee, Department, Planned Start, Planned End. They see the schedule, they
  don't set it — that stays a PM/engineering decision.
- **Two actions only, replacing manual date editing:**
  - **Start** — stamps `Actual start` = today, status → in progress.
  - **Close** — stamps `Actual end` = today, status → done.
- **Confirmed: closing late prompts for delay category + reason**, filled in by the functional
  head at the moment of closing — they have firsthand knowledge of why, rather than a PM guessing
  after the fact.
- This keeps the PM as the sole owner of *schedule* (planned dates), while functional heads own
  *execution* (start/close + why something ran late). The PM's Operations/Executive views roll
  this up into the overall progress and delay-chain diagram (section 6).

**Full editable drawer** (dates, reassignment, everything) remains PM-only.

---

## 6. Milestone visualization — delay chain

Replaces (or sits alongside — TBD) the current collapsed-by-default swimlane timeline. With
components removed (section 4), this is now **one chain per project**, not per unit.

- Milestones shown as a **sequence of connected nodes**, one direction (left→right or top→bottom),
  arrows between them, following the fixed 25-stage master workflow order (Design → Submit Design
  Approval → Release BOM/PR → ... → Commissioning & Handover — confirmed against the
  WORK_FLOW_TRACKER spreadsheet, which matches what's already built card-for-card).
- Each node is colored by state:
  - **Green** — closed (on time or early)
  - **Amber** — ongoing, currently running late
  - **Purple** — blocked
  - **Gray** — not started
- Each node shows **its own delta** — days early / on time / days late — directly on the node, next
  to the end date.
- The **final node** (dispatch) shows the **cumulative** delay/early number — the running sum of
  every prior delta.
- With 25 stages, a single row can't fit on screen at readable size — needs horizontal scroll or
  wrapped rows.

**Open question:** does this replace the swimlane entirely, or live above it as a summary with the
swimlane still available for full detail?

---

## 7. Operations (Today's Factory) — visual pass

Today it's a flat text list of milestones across projects (status pill, days, assignee). Confirmed
it needs a visual layer, made of **both**:

- **Quick-count summary chips** at the top — overdue / blocked / due-soon totals.
- **The milestone delay-chain diagram** (section 6), shown inline per project.

For a functional head, this same screen is filtered to their own department's milestones only,
per section 1.

---

## 8. Packing / BOM workflow

**Today:** packing lists are created from scratch, manually, replicating the paper master packing
list. No connection to engineering's bill of materials. PDF output today is browser Print → Save
as PDF, not a generated document.

**New flow:**

1. Engineering uploads a **BOM** — flat, one list per project.
2. System auto-generates a **draft packing list**: `Material description`, `MOC`, `Size/Specification`
   pre-filled from the BOM row.
3. Packing/Dispatch functional head reviews each row and fills in the fields the BOM doesn't have:
   - `IBR No.`, `Item code`, `Box No.`, `Qty`, `Make` — all manual for v1, all editable.
4. On approval, the row becomes a live packing list entry, feeding the existing Pending → Ready →
   Dispatched board.
5. **Reconciliation:** any BOM line not yet carried into an approved packing list stays on a
   **Pending list**, which can later seed a new packing list (handles partial dispatch).

**Confirmed decisions:**
- BOM is flat per project.
- `Make` and `IBR No.` are manual-only in v1.
- Packing access is granted via the Dispatch department in the access matrix (section 3), not a
  separate concept — see section 1.
- **New requirement: proper PDF generation.** A "Generate PDF" action producing the actual
  document layout (company header, buyer/invoice/DC block, item table, declaration, sign-off row
  — matching the SB-IBR-1018 sample), not just browser print-to-PDF.
- **New requirement: Pending list PDF** — a separate PDF export for the Pending list when it has
  items.

**Open question:** does the packing list keep the paper form's component sectioning (Boiler /
Chimney / Ducting-SDC), given components are otherwise removed from the data model (section 4)?
This may need to stay as a packing-list-only concept (e.g. free-text grouping within the list)
since it doesn't map to a real project structure anymore.

---

## 9. Confirmed bug — customer has write access to packing/dispatch

Verified from screenshots of the live customer portal (login: `customer`).

- The phase stepper is correct — read-only, business language, as designed.
- Clicking **"View/Download Packing List"** opens the same internal packing list editor internal
  staff use: status dropdown, "Edit Details," delete (×) on every line item.
- The **"← All"** button takes the customer into the full internal Packing & Dispatch board,
  unscoped to their order.
- "Add Item" and "Edit" let them rewrite dispatch details and delete rows.

**Root cause:** `/packing/*` is one shared UI for internal and external users, gated only by which
link was clicked — not a real role/permission check.

**Required fix:** a dedicated read-only packing list view (document + Print/PDF only), no access
until status is at least `Ready`, enforced at the route/API level.

---

## 10. Confirmed bug — functional heads have unscoped Projects and Packing access

Verified from screenshots of the operator nav (login: `ravi`).

- Ravi (production) sees the same full **Projects** list and **"+ New Project"** as a PM.
- Ravi also has full unrestricted **Packing** tab access despite not being Dispatch-department.

**Required fix:** both need to respect the department-based access matrix (section 3) — Projects
scoped/read-only for functional heads, Packing only visible to heads with Dispatch access.

---

## 11. Confirmed bug — Settings is broken and has no destination

- Top nav `SETTINGS` tab 404s; the cog dropdown has nothing behind it.
- **Fix:** remove `SETTINGS` from the primary tab row, live only behind the cog dropdown,
  alongside the Departments dropdown (section 2) and access matrix/user management (section 3).

---

## 12. Known gap carried over from today

Milestones and packing lists are two separate trees under the same project — nothing in packing
currently references a milestone. Worth deciding whether the redesign links them (e.g. the
"Packing & Labeling" milestone, once closed, opens onto this board) or keeps them intentionally
separate.

---

## 13. Still to cover

- Procurement, fabrication, QC functional-head workflows (not yet discussed)
- Empty state for a functional head with no department assigned yet
- Packing list's component-style sectioning, now that components are removed (section 8)
- Customer portal changes, if any, beyond the packing-list bug fix (section 9)
- Whether dependency/critical-path (the dormant `depends_on_key`) plays into the delay-chain
  visualization in section 6
- Confirm: "Start" + "Close" as the two functional-head milestone actions (section 5) — flagged
  as Claude's recommendation, not yet explicitly confirmed by you
