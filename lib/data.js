// lib/data.js — server-side read helpers shared by the page components.
import { queryAll, queryOne } from './db';
import { effectiveStatus, worstStatus, biggestBlocker, slaStatus } from './sla';
import { cumulativeDelay } from './delay';
import { CUSTOMER_PHASES } from './milestones';
import { headDepartments } from './auth';

const ATTENTION = new Set(['overdue', 'blocked', 'due_now', 'due_soon', 'in_progress']);

export async function getProjectsWithStatus() {
  const projects = await queryAll('SELECT * FROM projects ORDER BY created_at DESC');
  const miles = await queryAll('SELECT * FROM milestones');

  const byProject = {};
  miles.forEach(m => { (byProject[m.project_id] ||= []).push(m); });

  return projects.map(p => {
    const ms = byProject[p.id] || [];
    const done = ms.filter(m => m.actual_end || m.status === 'done').length;
    return {
      ...p,
      roll: worstStatus(ms),
      blocker: biggestBlocker(ms),
      progress: ms.length ? Math.round((done / ms.length) * 100) : 0,
      milestones: ms,
    };
  });
}

export async function getProjectDetail(id) {
  const project = await queryOne('SELECT * FROM projects WHERE id = ?', [id]);
  if (!project) return null;
  const milestones = await queryAll(
    'SELECT * FROM milestones WHERE project_id = ? ORDER BY sort_order, id', [id]
  );

  const done = milestones.filter(m => m.actual_end || m.status === 'done').length;
  const scheduled = milestones.filter(m => m.planned_end);
  const current = milestones.find(m => effectiveStatus(m).code === 'in_progress');
  const next = milestones.find(m => !m.actual_end && m.status !== 'done' && m.planned_end);
  const estDispatch = scheduled.reduce((a, m) => (m.planned_end > a ? m.planned_end : a), '');

  return {
    project,
    milestones,
    health: worstStatus(milestones),
    blocker: biggestBlocker(milestones),
    progress: milestones.length ? Math.round((done / milestones.length) * 100) : 0,
    currentPhase: current?.milestone_label || null,
    nextPhase: next?.milestone_label || null,
    estDispatch: estDispatch || null,
  };
}

// "My Work" (functional head, department-scoped) / "Today's Factory" (PM, everything).
// deptFilter narrows further — a PM peeking at one department (Departments dropdown), or a head
// with multiple departments picking one of their own tabs.
export async function getMyWork(user, deptFilter = null) {
  const rows = await queryAll(
    `SELECT m.*, p.project_no, p.customer_name
       FROM milestones m
       JOIN projects p ON p.id = m.project_id`
  );
  let scoped = user?.role === 'operator'
    ? rows.filter(r => headDepartments(user).includes(r.department))
    : rows;
  if (deptFilter) scoped = scoped.filter(r => r.department === deptFilter);
  const items = scoped
    .map(m => ({ ...m, eff: effectiveStatus(m) }))
    .filter(m => ATTENTION.has(m.eff.code));

  // Group by project, sort each by urgency (severity via daysLeft ascending is a fine proxy).
  const byProject = {};
  for (const it of items) {
    (byProject[it.project_id] ||= { project_no: it.project_no, customer_name: it.customer_name, items: [] })
      .items.push(it);
  }
  const order = { overdue: 0, blocked: 1, due_now: 2, due_soon: 3, in_progress: 4 };
  Object.values(byProject).forEach(g => g.items.sort((a, b) => order[a.eff.code] - order[b.eff.code]));
  return Object.values(byProject);
}

export async function getExecutiveSummary() {
  const projects = await getProjectsWithStatus();

  const kpi = { total: projects.length, healthy: 0, delayed: 0, critical: 0, completed: 0, valueInProgress: 0 };
  for (const p of projects) {
    const c = p.roll.code;
    if (c === 'done') kpi.completed++;
    else if (c === 'overdue' || c === 'blocked') kpi.critical++;
    else if (c === 'due_now' || c === 'due_soon') kpi.delayed++;
    else kpi.healthy++;
    if (c !== 'done') kpi.valueInProgress += p.order_value || 0;
  }

  // Average delay = mean overdue days across currently-overdue milestones.
  const allMiles = projects.flatMap(p => p.milestones);
  const overdue = allMiles.map(m => slaStatus(m)).filter(s => s.code === 'red');
  kpi.avgDelay = overdue.length ? Math.round(overdue.reduce((a, s) => a + Math.abs(s.daysLeft), 0) / overdue.length) : 0;

  // Delayed because — count open, at-risk milestones by delay category.
  const delayedBy = {};
  for (const m of allMiles) {
    const code = effectiveStatus(m).code;
    if ((code === 'overdue' || code === 'blocked') && m.delay_category) {
      delayedBy[m.delay_category] = (delayedBy[m.delay_category] || 0) + 1;
    }
  }

  const topRisks = projects
    .filter(p => p.blocker)
    .map(p => ({ project_no: p.project_no, id: p.id, customer_name: p.customer_name, ...p.blocker }))
    .sort((a, b) => b.impactDays - a.impactDays);

  const forecast = projects.map(p => {
    const est = p.milestones.reduce((a, m) => (m.planned_end && m.planned_end > a ? m.planned_end : a), '');
    const current = p.milestones.find(m => effectiveStatus(m).code === 'in_progress');
    const next = p.milestones.find(m => !m.actual_end && m.status !== 'done' && m.planned_end);
    return {
      id: p.id, project_no: p.project_no, customer_name: p.customer_name, roll: p.roll,
      estDispatch: est || null,
      progress: p.progress,
      currentStage: current?.milestone_label || next?.milestone_label || '—',
      cumDelay: cumulativeDelay(p.milestones),
      value: p.order_value,
    };
  });

  return { kpi, delayedBy, topRisks, forecast };
}

// Read-only customer view: collapse internal milestones into business-language phases.
export async function getCustomerView(projectId) {
  const project = await queryOne('SELECT * FROM projects WHERE id = ?', [projectId]);
  if (!project) return null;
  const milestones = await queryAll('SELECT * FROM milestones WHERE project_id = ?', [projectId]);
  const byKey = {};
  milestones.forEach(m => { (byKey[m.milestone_key] ||= []).push(m); });

  const phases = CUSTOMER_PHASES.map((ph, i) => {
    const ms = ph.keys.flatMap(k => byKey[k] || []);
    let status = 'upcoming';
    if (i === 0) status = 'done'; // Order Received — implicit once the project exists
    else if (ms.length) {
      const doneCount = ms.filter(m => m.actual_end || m.status === 'done').length;
      const started = ms.some(m => m.actual_start || m.status === 'in_progress' || m.actual_end || m.status === 'done');
      if (doneCount === ms.length) status = 'done';
      else if (started) status = 'in_progress';
    }
    return { key: ph.key, label: ph.label, status };
  });

  const estDispatch = milestones.reduce((a, m) => (m.planned_end && m.planned_end > a ? m.planned_end : a), '');
  const packing = await queryOne(
    "SELECT id FROM packing_lists WHERE project_id = ? ORDER BY created_at DESC LIMIT 1", [projectId]
  );
  return { project, phases, estDispatch: estDispatch || null, packingListId: packing?.id || null };
}

export async function getPackingLists() {
  return queryAll(
    `SELECT pl.*, (SELECT COUNT(*) FROM packing_items WHERE packing_list_id = pl.id) AS item_count
       FROM packing_lists pl ORDER BY pl.created_at DESC`
  );
}

// This project's packing lists — for the Dispatch panel on the project page.
export async function getProjectPackingLists(projectId) {
  return queryAll(
    `SELECT pl.*, (SELECT COUNT(*) FROM packing_items WHERE packing_list_id = pl.id) AS item_count
       FROM packing_lists pl WHERE pl.project_id = ? ORDER BY pl.created_at DESC`, [projectId]
  );
}

export async function getPackingDetail(id) {
  const list = await queryOne('SELECT * FROM packing_lists WHERE id = ?', [id]);
  if (!list) return null;
  const items = await queryAll(
    'SELECT * FROM packing_items WHERE packing_list_id = ? ORDER BY box_no, s_no, id', [id]
  );
  return { list, items };
}

// Functional heads — for the PM's access matrix / user management screen (Settings).
export async function getFunctionalHeads() {
  const rows = await queryAll(
    "SELECT id, username, display_name, departments, active FROM users WHERE role = 'operator' ORDER BY username"
  );
  return rows.map(r => ({ ...r, departments: headDepartments(r) }));
}

// BOM + reconciliation for a project. Pending = BOM lines not yet carried into an approved
// (non-draft) packing list, so partial dispatches can seed a new list later (§8).
export async function getProjectBom(projectId) {
  const bom = await queryAll('SELECT * FROM bom_items WHERE project_id = ? ORDER BY sort_order, id', [projectId]);
  // A BOM line is "carried" once it's referenced by a packing item on a packed/dispatched list.
  const carried = await queryAll(
    `SELECT DISTINCT pi.bom_item_id FROM packing_items pi
       JOIN packing_lists pl ON pl.id = pi.packing_list_id
      WHERE pl.project_id = ? AND pl.status != 'draft' AND pi.bom_item_id IS NOT NULL`, [projectId]
  );
  const carriedIds = new Set(carried.map(r => r.bom_item_id));
  return { bom, pending: bom.filter(b => !carriedIds.has(b.id)) };
}
