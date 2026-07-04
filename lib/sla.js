// lib/sla.js
// Status + SLA logic. Two layers:
//   slaStatus()       — pure deadline colour (green/yellow/orange/red) off planned_end vs today.
//   effectiveStatus() — merges the human status (pending/in_progress/done/blocked) WITH the deadline
//                       into the richer code set the UI paints:
//                       not_started(gray) in_progress(blue) blocked(purple)
//                       due_soon(yellow) due_now(orange) overdue(red) done(green)

export function daysBetween(a, b) {
  const MS = 24 * 60 * 60 * 1000;
  return Math.round((b - a) / MS);
}

function todayMidnight(today) {
  return new Date(today.toDateString());
}

export function slaStatus(milestone, today = new Date()) {
  if (milestone.actual_end) return { code: 'done', label: 'Complete', daysLeft: null };
  if (!milestone.planned_end) return { code: 'gray', label: 'Not scheduled', daysLeft: null };

  const daysLeft = daysBetween(todayMidnight(today), new Date(milestone.planned_end));
  if (daysLeft < 0) return { code: 'red', label: `Overdue ${Math.abs(daysLeft)}d`, daysLeft };
  if (daysLeft <= 2) return { code: 'orange', label: `${daysLeft}d left`, daysLeft };
  if (daysLeft <= 7) return { code: 'yellow', label: `${daysLeft}d left`, daysLeft };
  return { code: 'green', label: `${daysLeft}d left`, daysLeft };
}

export const SLA_COLORS = {
  done: 'var(--success)',
  green: 'var(--success)',
  in_progress: 'var(--primary)',
  blue: 'var(--primary)',
  blocked: '#7c3aed',
  purple: '#7c3aed',
  yellow: '#ca8a04',
  due_soon: '#ca8a04',
  orange: 'var(--warning)',
  due_now: 'var(--warning)',
  red: 'var(--danger)',
  overdue: 'var(--danger)',
  not_started: 'var(--text-muted)',
  gray: 'var(--text-muted)',
};

// The single richest status code for a milestone, used for cards, swimlane capsules and roll-ups.
export function effectiveStatus(m, today = new Date()) {
  if (m.actual_end || m.status === 'done') return { code: 'done', label: 'Completed', daysLeft: null };
  if (m.status === 'blocked') return { code: 'blocked', label: 'Blocked', daysLeft: null };

  const sla = slaStatus(m, today);
  if (sla.code === 'red') return { code: 'overdue', label: sla.label, daysLeft: sla.daysLeft };
  if (m.status === 'in_progress') return { code: 'in_progress', label: 'In progress', daysLeft: sla.daysLeft };
  if (sla.code === 'orange') return { code: 'due_now', label: sla.label, daysLeft: sla.daysLeft };
  if (sla.code === 'yellow') return { code: 'due_soon', label: sla.label, daysLeft: sla.daysLeft };
  return { code: 'not_started', label: 'Not started', daysLeft: sla.daysLeft };
}

// Higher = more urgent. Drives roll-up + biggestBlocker selection.
const SEVERITY = { overdue: 6, blocked: 5, due_now: 4, due_soon: 3, in_progress: 2, not_started: 1, done: 0, gray: 1 };

export function worstStatus(milestones, today = new Date()) {
  let worst = { code: 'done', label: 'Complete' };
  for (const m of milestones) {
    const s = effectiveStatus(m, today);
    if ((SEVERITY[s.code] ?? 0) > (SEVERITY[worst.code] ?? 0)) worst = s;
  }
  return worst;
}

// The one milestone answering "why is this delayed?" — worst open milestone + its delay context.
// Returns null when nothing is overdue/blocked (project is healthy).
export function biggestBlocker(milestones, today = new Date()) {
  let pick = null, pickSev = 2; // only surface things at least as bad as due_now (>=4); ignore in_progress
  for (const m of milestones) {
    const s = effectiveStatus(m, today);
    const sev = SEVERITY[s.code] ?? 0;
    if (sev >= 4 && sev > pickSev) { pick = { m, s }; pickSev = sev; }
  }
  if (!pick) return null;
  const { m, s } = pick;
  const t0 = todayMidnight(today);
  // Blocked-since: from planned_end if we're past it, else from actual_start.
  const anchor = m.planned_end && new Date(m.planned_end) < t0 ? new Date(m.planned_end)
    : (m.actual_start ? new Date(m.actual_start) : t0);
  const blockedDays = Math.max(daysBetween(anchor, t0), 0);
  const impactDays = s.code === 'overdue' ? Math.abs(s.daysLeft) : blockedDays;
  return {
    milestone_label: m.milestone_label,
    code: s.code,
    delay_category: m.delay_category || null,
    reason: m.delay_reason || null,
    blockedDays,
    impactDays,
  };
}
