// lib/db.js
import { createClient } from '@libsql/client';
import bcrypt from 'bcryptjs';
import { MILESTONE_TEMPLATE } from './milestones';

let db = null;
let initPromise = null;

function getClient() {
  if (db) return db;
  if (process.env.TURSO_URL) {
    db = createClient({
      url: process.env.TURSO_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
      intMode: 'number'
    });
  } else {
    db = createClient({ url: 'file:./shanti-ops-local.db', intMode: 'number' });
  }
  return db;
}

async function migrate(client) {
  // Redesign flatten (confirmed): Project → Unit → Milestone becomes Project → Milestone, flat.
  // The old unit-scoped rows don't map onto the new flat model, so — since this is demo data only —
  // wipe and let seedIfEmpty() rebuild everything fresh the first time this runs against an old DB.
  const oldSchema = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='project_units'");
  if (oldSchema.rows.length) {
    for (const t of ['milestones', 'project_units', 'packing_items', 'packing_lists', 'projects', 'users', 'counters']) {
      await client.execute(`DROP TABLE IF EXISTS ${t}`);
    }
  }

  // role: admin | manager | operator (internal) | customer (external, scoped to project_id).
  await client.execute(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'operator',
    project_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // A project = one customer order (e.g. SB-1018). Mirrors the packing list header.
  // owner = responsible PM. order_value feeds the exec "value in progress" KPI (optional).
  await client.execute(`CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_no TEXT NOT NULL UNIQUE,
    customer_name TEXT NOT NULL,
    description TEXT,
    order_date DATE,
    order_value REAL,
    status TEXT NOT NULL DEFAULT 'active',
    owner TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // One row per milestone per project — flat, no intermediate unit layer (redesign §4).
  // milestone_key/label/sort_order come from lib/milestones.js and are seeded automatically
  // whenever a project is created.
  await client.execute(`CREATE TABLE IF NOT EXISTS milestones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    milestone_key TEXT NOT NULL,
    milestone_label TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    assignee TEXT,
    department TEXT,
    planned_start DATE,
    planned_end DATE,
    actual_start DATE,
    actual_end DATE,
    status TEXT NOT NULL DEFAULT 'pending',
    delay_reason TEXT,
    delay_category TEXT,
    vendor TEXT,
    po_no TEXT,
    material_ready INTEGER NOT NULL DEFAULT 0,
    qc_ok INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    depends_on_key TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Packing lists — the auto-generated replacement for the manual PDF.
  await client.execute(`CREATE TABLE IF NOT EXISTS packing_lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
    packing_no TEXT NOT NULL UNIQUE,
    customer_name TEXT NOT NULL,
    customer_address TEXT,
    invoice_no TEXT,
    invoice_date DATE,
    package_type TEXT,
    dc_no TEXT,
    dc_date DATE,
    vehicle_no TEXT,
    dispatch_through TEXT,
    contact_person TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Line items — fields mirror the columns on the Shanti Boilers master packing list.
  await client.execute(`CREATE TABLE IF NOT EXISTS packing_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    packing_list_id INTEGER NOT NULL REFERENCES packing_lists(id) ON DELETE CASCADE,
    s_no INTEGER,
    material_description TEXT NOT NULL,
    moc TEXT,
    size_spec TEXT,
    ibr_no TEXT,
    item_code TEXT,
    box_no TEXT,
    qty REAL NOT NULL DEFAULT 1,
    unit TEXT DEFAULT "No's",
    make TEXT,
    scanned_qty REAL NOT NULL DEFAULT 0
  )`);

  await client.execute(`CREATE TABLE IF NOT EXISTS counters (
    name TEXT PRIMARY KEY,
    value INTEGER NOT NULL DEFAULT 1000
  )`);

  const seeded = await client.execute({ sql: "SELECT value FROM counters WHERE name = 'project_no'", args: [] });
  if (!seeded.rows.length) {
    await client.execute({ sql: "INSERT INTO counters (name, value) VALUES ('project_no', 1000)", args: [] });
  }
  const seeded2 = await client.execute({ sql: "SELECT value FROM counters WHERE name = 'packing_no'", args: [] });
  if (!seeded2.rows.length) {
    await client.execute({ sql: "INSERT INTO counters (name, value) VALUES ('packing_no', 1000)", args: [] });
  }

  await client.execute(`CREATE INDEX IF NOT EXISTS idx_milestones_project ON milestones(project_id)`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_milestones_planned_end ON milestones(planned_end)`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_packing_project ON packing_lists(project_id)`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_packing_items_list ON packing_items(packing_list_id)`);

  // Redesign additive migrations — safe to re-run (addColumn ignores "duplicate column").
  await addColumn(client, 'users', 'departments TEXT');          // CSV of department names a head is granted
  await addColumn(client, 'users', 'display_name TEXT');
  await addColumn(client, 'users', 'contact_number TEXT');
  await addColumn(client, 'users', 'active INTEGER NOT NULL DEFAULT 1');
  await addColumn(client, 'packing_items', 'bom_item_id INTEGER'); // reconciliation link back to the BOM row
  await addColumn(client, 'packing_items', 'section TEXT');        // free-text group (Boiler / Chimney / Ducting)

  // BOM — flat, one list per project. Feeds the auto-generated draft packing list.
  await client.execute(`CREATE TABLE IF NOT EXISTS bom_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    material_description TEXT NOT NULL,
    moc TEXT,
    size_spec TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_bom_project ON bom_items(project_id)`);

  // USB device approval — a Windows agent per machine blocks USB storage and files requests here.
  await client.execute(`CREATE TABLE IF NOT EXISTS machines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    user_id INTEGER REFERENCES users(id),
    active INTEGER NOT NULL DEFAULT 1,
    last_seen DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  await client.execute(`CREATE TABLE IF NOT EXISTS usb_devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vendor_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    serial TEXT NOT NULL DEFAULT '',
    label TEXT,
    whitelisted INTEGER NOT NULL DEFAULT 0,
    first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(vendor_id, product_id, serial)
  )`);
  // status: pending | approved | rejected | revoked — 'expired' is derived at read time (lib/usb.js).
  // expires_at is epoch ms to avoid SQLite datetime-string comparison pitfalls.
  await client.execute(`CREATE TABLE IF NOT EXISTS usb_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    machine_id INTEGER NOT NULL REFERENCES machines(id),
    device_id INTEGER NOT NULL REFERENCES usb_devices(id),
    status TEXT NOT NULL DEFAULT 'pending',
    reason TEXT,
    requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    decided_at DATETIME,
    decided_by TEXT,
    expires_at INTEGER
  )`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_usb_requests_machine ON usb_requests(machine_id)`);
  await client.execute(`CREATE TABLE IF NOT EXISTS usb_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER,
    machine_id INTEGER,
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    detail TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  // TOTP state for approvers (pending secret keeps a mis-scan from clobbering a working one).
  await addColumn(client, 'users', 'totp_secret TEXT');
  await addColumn(client, 'users', 'totp_pending_secret TEXT');
  await addColumn(client, 'users', 'totp_fails INTEGER NOT NULL DEFAULT 0');
  await addColumn(client, 'users', 'totp_lock_until INTEGER');
  await addColumn(client, 'users', 'totp_last_code TEXT');

  // v2: device kind (usb | cd, room for phone/printer/... later) + agent version reporting.
  await addColumn(client, 'usb_devices', "kind TEXT NOT NULL DEFAULT 'usb'");
  await addColumn(client, 'machines', 'agent_version TEXT');

  await seedIfEmpty(client);
}

// Add a column if it doesn't already exist. libsql throws "duplicate column name" on re-run — ignore that.
async function addColumn(client, table, columnDef) {
  try {
    await client.execute(`ALTER TABLE ${table} ADD COLUMN ${columnDef}`);
  } catch (e) {
    if (!String(e).toLowerCase().includes('duplicate column')) throw e;
  }
}

// Seed a default admin + a demo project so the app is usable/demo-able on first run.
// ponytail: fixed default creds for the demo; change ADMIN_PASSWORD env for a real deploy.
async function seedIfEmpty(client) {
  const users = await client.execute("SELECT COUNT(*) AS n FROM users");
  if (users.rows[0].n > 0) return;

  const mk = (u, pw, role, projectId, departments = null, displayName = null) => client.execute({
    sql: "INSERT INTO users (username, password, role, project_id, departments, display_name) VALUES (?, ?, ?, ?, ?, ?)",
    args: [u, bcrypt.hashSync(pw, 10), role, projectId, departments, displayName]
  });
  const adminPw = process.env.ADMIN_PASSWORD || 'admin123';
  await mk('admin', adminPw, 'admin', null, null, 'Admin (PM)');
  await mk('manager', 'manager123', 'manager', null, null, 'Project Manager');
  // Functional heads — scoped to the department(s) a PM has granted (access matrix).
  await mk('ravi', 'ravi123', 'operator', null, 'Production', 'Ravi (Production)');
  await mk('suresh', 'suresh123', 'operator', null, 'Procurement', 'Suresh (Procurement)');

  // Demo project SB-1018 (matches the sample packing list) with three units + milestones.
  const proj = await client.execute({
    sql: `INSERT INTO projects (project_no, customer_name, description, order_date, order_value, owner)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: ['SB-1018', 'Asian Brown Bleachchem P Ltd', '3 TPH Solid Fuel Fired Boiler', '2026-04-15', 4200000, 'manager']
  });
  const projectId = Number(proj.lastInsertRowid);
  // Flat 25-stage milestone chain (redesign §4 — no unit layer). Staggered start tells a realistic
  // story: completed → an overdue/blocked vendor bottleneck → in progress → upcoming.
  await createProjectMilestones(client, projectId, 46);

  await mk('customer', 'customer123', 'customer', projectId); // external, scoped to this project
  await seedDemoPackingList(client, projectId);

  // Advance the counters past the seeded numbers.
  await client.execute("UPDATE counters SET value = 1018 WHERE name = 'project_no'");
  await client.execute("UPDATE counters SET value = 1001 WHERE name = 'packing_no'");
}

// Which operator owns each department's work (demo), so "My Work" is populated.
const DEPT_ASSIGNEE = { Design: 'admin', Procurement: 'suresh', Production: 'ravi', QC: 'manager', Dispatch: 'ravi', Installation: 'ravi' };
const DELAY_REASONS = ['Pump vendor delay', 'Awaiting client drawing approval', 'MS plate shortage'];
const DEPT_DELAY_CAT = { Procurement: 'Vendor', Production: 'Material', Design: 'Design', QC: 'Other', Dispatch: 'Material', Installation: 'Customer' };

// Seed one flat milestone row per template entry directly under the project.
// startDaysAgo = null -> no dates (blank template). A number -> lay 3-day planned bars end-to-end
// starting that many days before today, then paint a realistic status story:
//   completed → one overdue/blocked bottleneck (with delay category) → current in-progress → upcoming.
async function createProjectMilestones(client, projectId, startDaysAgo) {
  const N = MILESTONE_TEMPLATE.length;

  // First pass: compute planned start/end for every milestone.
  const plan = [];
  if (startDaysAgo != null) {
    let cursor = Date.now() - startDaysAgo * 864e5;
    for (let i = 0; i < N; i++) {
      const ps = new Date(cursor).toISOString().slice(0, 10);
      cursor += 3 * 864e5;
      const pe = new Date(cursor).toISOString().slice(0, 10);
      cursor += 864e5; // 1-day gap between milestones
      plan.push({ ps, pe });
    }
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  // The "current" milestone is the first one still planned to finish today or later.
  let curIdx = plan.findIndex(p => p.pe >= todayStr);
  if (curIdx === -1) curIdx = N; // everything is in the past

  for (let i = 0; i < N; i++) {
    const m = MILESTONE_TEMPLATE[i];
    const assignee = DEPT_ASSIGNEE[m.department] || null;
    let ps = null, pe = null, as = null, ae = null, status = 'pending';
    let reason = null, delayCat = null, vendor = null, poNo = null, materialReady = 0, qcOk = 0;

    if (m.category === 'procurement') { vendor = 'Thermax Ltd'; poNo = `PO-${1000 + i}`; }

    if (plan.length) {
      ({ ps, pe } = plan[i]);
      if (i < curIdx - 1) {                       // completed on time
        status = 'done'; as = ps; ae = pe;
        if (m.category === 'procurement') materialReady = 1;
        if (m.category === 'qc') qcOk = 1;
      } else if (i === curIdx - 1) {              // the bottleneck (overdue / blocked)
        status = 'blocked'; as = ps;
        reason = DELAY_REASONS[projectId % DELAY_REASONS.length];
        delayCat = DEPT_DELAY_CAT[m.department] || 'Other';
        if (m.category === 'procurement') { vendor = 'Kirloskar Bros'; materialReady = 0; }
      } else if (i === curIdx) {                  // current work
        status = 'in_progress'; as = ps;
      }
    }
    await client.execute({
      sql: `INSERT INTO milestones
              (project_id, milestone_key, milestone_label, sort_order, assignee, department,
               planned_start, planned_end, actual_start, actual_end, status,
               delay_reason, delay_category, vendor, po_no, material_ready, qc_ok)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [projectId, m.key, m.label, i, assignee, m.department,
        ps, pe, as, ae, status, reason, delayCat, vendor, poNo, materialReady, qcOk]
    });
  }
}

// A fully-populated demo packing list that mirrors the real SB-1018 PDF, so the
// "replace the paper packing list" story is demoable on first run.
async function seedDemoPackingList(client, projectId) {
  const pl = await client.execute({
    sql: `INSERT INTO packing_lists
            (project_id, packing_no, customer_name, customer_address, invoice_no, invoice_date,
             package_type, dc_no, dc_date, vehicle_no, dispatch_through, contact_person, status, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [projectId, 'PL-1001', 'ASIAN BROWN BLEACHCHEM P LTD',
      '51, MITHABASPALLY, THANDUR-501141, VIKARABAD DIST, TELANGANA',
      'SB/0214/2025-26', '2026-01-03', 'BOILER — SB-BR-1018-SF-WB-120-10.54',
      '3773', '2026-01-03', 'TG12T3546', 'TRAILOR', '', 'draft', 'admin']
  });
  const id = Number(pl.lastInsertRowid);
  const items = [
    ['CONTROL PANEL', 'CS', 'AS PER DRAWING', 'SB-IBR-1018', 'SB-LOOSE 1', 1, ''],
    ['ID FAN WITH MOTOR', 'MS', 'CFM:3000 · 5 HP · HEAD 8" · 1440 RPM', 'SB-IBR-1018', 'SB-LOOSE 2', 1, '250921021822'],
    ['FD FAN WITH MOTOR', 'MS', 'CFM:2000 · 3 HP · HEAD 6" · 1440 RPM', 'SB-IBR-1018', 'SB-LOOSE 2', 1, ''],
    ['LADDER', 'MS', 'AS PER DRAWING', '', 'SB-LOOSE 3', 1, ''],
    ['FEED LINE PIPE', 'MS', 'AS PER DRAWING', 'SB-IBR-1018', 'SB-LOOSE 5', 1, ''],
    ['MS STRUCTURE WORK', 'STD', 'ISMC 75 x 5000 Lg · ISA 50x50x5 - 5000 Lg', '', 'SB-LOOSE 12,13,14', 3, ''],
  ];
  for (let i = 0; i < items.length; i++) {
    const [desc, moc, spec, ibr, box, qty, code] = items[i];
    await client.execute({
      sql: `INSERT INTO packing_items
              (packing_list_id, s_no, material_description, moc, size_spec, ibr_no, box_no, qty, unit, item_code)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [id, i + 1, desc, moc, spec, ibr, box, qty, "No's", code]
    });
  }
}

export async function initDB() {
  if (!initPromise) {
    const client = getClient();
    initPromise = migrate(client).then(() => client);
  }
  return initPromise;
}

export async function queryAll(sql, params = []) {
  const client = await initDB();
  const result = await client.execute({ sql, args: params });
  return result.rows;
}

export async function queryOne(sql, params = []) {
  const client = await initDB();
  const result = await client.execute({ sql, args: params });
  return result.rows.length ? result.rows[0] : null;
}

export async function execute(sql, params = []) {
  const client = await initDB();
  const result = await client.execute({ sql, args: params });
  return { changes: result.rowsAffected, lastId: result.lastInsertRowid };
}

export async function nextNumber(counterName, prefix) {
  const client = await initDB();
  // libsql has no atomic increment-and-return in one call across dialects we support,
  // so do it as a short read-modify-write; fine at this write volume.
  const row = await queryOne('SELECT value FROM counters WHERE name = ?', [counterName]);
  const next = (row ? row.value : 1000) + 1;
  await client.execute({ sql: 'UPDATE counters SET value = ? WHERE name = ?', args: [next, counterName] });
  return `${prefix}-${next}`;
}
