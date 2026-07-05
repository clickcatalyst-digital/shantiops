// Delay math shared by the per-project DelayChain and the Executive Portfolio Delay Timeline.
import { daysBetween, effectiveStatus } from './sla';

// Per-milestone delta in days: + late, − early, 0 on time, null if not yet measurable.
export function milestoneDelta(m, today = new Date()) {
  if (m.actual_end && m.planned_end) return daysBetween(new Date(m.planned_end), new Date(m.actual_end));
  if (!m.actual_end && m.planned_end) {
    const late = daysBetween(new Date(m.planned_end), today);
    return late > 0 ? late : null; // running late; on-track upcoming milestones don't count yet
  }
  return null;
}

// Running total of every measurable delta across a project's milestones.
export function cumulativeDelay(milestones, today = new Date()) {
  return milestones.reduce((sum, m) => {
    const d = milestoneDelta(m, today);
    return d != null ? sum + d : sum;
  }, 0);
}

// Tailwind classes for a status pill: tinted background + solid text/border,
// using the SAME color token as nodeColorClass so a pill always matches its bar segment.
export function statusPillClasses(code) {
  return {
    done: 'bg-success/15 text-success border-success/30',
    overdue: 'bg-warning/15 text-warning border-warning/30',
    blocked: 'bg-danger/15 text-danger border-danger/30',
    in_progress: 'bg-info/15 text-info border-info/30',
    due_now: 'bg-info/15 text-info border-info/30',
    due_soon: 'bg-info/15 text-info border-info/30',
    not_started: 'bg-muted-foreground/10 text-muted-foreground border-muted-foreground/20',
  }[code] || 'bg-muted-foreground/10 text-muted-foreground border-muted-foreground/20';
}

export function deltaLabel(d) {
  if (d == null) return '—';
  if (d === 0) return 'on time';
  return d > 0 ? `${d}d late` : `${Math.abs(d)}d early`;
}

// Tailwind class for a milestone node/segment, keyed to the status palette.
export function nodeColorClass(m, today = new Date()) {
  const code = effectiveStatus(m, today).code;
  return {
    done: 'bg-success',
    overdue: 'bg-warning',     // amber — running late
    blocked: 'bg-danger',      // red — needs intervention, distinct from "late"
    in_progress: 'bg-info',
    due_now: 'bg-info',
    // due_soon: 'bg-info', // unused while due_soon is folded into not_started in effectiveStatus()
    not_started: 'bg-muted-foreground/40',
  }[code] || 'bg-muted-foreground/40';
}
