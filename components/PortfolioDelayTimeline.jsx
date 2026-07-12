// Executive hero (redesign §6, portfolio view): one row per project, its stages as a connected
// bar colored by state, a today-marker, and the cumulative dispatch delay called out at the end.
// Scannable across every project at once — an executive Gantt of delay.
'use client'; // Row now uses useState — file needs to be a client component

import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { effectiveStatus } from '@/lib/sla';
import { MILESTONE_TEMPLATE } from '@/lib/milestones';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { cumulativeDelay, nodeColorClass, milestoneDelta, deltaLabel, statusPillClasses } from '@/lib/delay';

// One source of truth for the row layout: chevron / project name / 1fr bar track / delay.
// The header strip and the stripe overlay both derive from this — if the tracks change, update
// TRACK_LEFT/TRACK_RIGHT below to match (px-2 pad + col widths + gap-3 gaps).
const ROW_GRID = 'grid-cols-[1.1rem_9rem_1fr_4rem] gap-3 px-2';
const TRACK_LEFT = 'left-[12.1rem]';  // 0.5 (px-2) + 1.1 + 0.75 (gap) + 9 + 0.75 (gap)
const TRACK_RIGHT = 'right-[5.25rem]'; // 0.5 (px-2) + 4 + 0.75 (gap)

function formatDate(d) {
  if (!d) return null;
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function Row({ project }) {
  const [expanded, setExpanded] = useState(false);
  const ms = [...(project.milestones || [])].sort((a, b) => a.sort_order - b.sort_order);
  const total = ms.length || 1;
  let currentIdx = ms.findIndex(m => !(m.actual_end || m.status === 'done'));
  if (currentIdx === -1) currentIdx = total;
  const cum = cumulativeDelay(ms);
  const late = cum > 0;
  const done = ms.filter(m => m.actual_end || m.status === 'done').length;

  // Original deadline: last milestone's planned end date, as originally scheduled.
  const lastMs = ms[ms.length - 1];
  const origDate = lastMs?.planned_end ? formatDate(lastMs.planned_end) : null;

  return (
    // relative: paints the row's hover bg and bars above the column-stripe overlay behind it.
    <div className="relative rounded-lg transition-colors hover:bg-muted/50">
      <div className={cn('grid items-center py-2', ROW_GRID)}>
        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          className="flex size-4 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={expanded ? 'Collapse milestones' : 'Expand milestones'}
          aria-expanded={expanded}
        >
          <ChevronRight className={cn('size-3.5 transition-transform', expanded && 'rotate-90')} />
        </button>

        <Link href={`/projects/${project.id}`} className="min-w-0">
          <div className="truncate text-sm font-semibold text-primary hover:underline">{project.project_no}</div>
          <div className="truncate text-xs text-muted-foreground">{Math.round((done / total) * 100)}% complete</div>
        </Link>

        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          className="relative cursor-pointer py-1"
          aria-label="Toggle milestone details"
        >
          <div className="flex h-3 items-stretch gap-px">
            {ms.map(m => (
              <div
                key={m.id}
                title={`${m.milestone_label} · ${effectiveStatus(m).label}`}
                className={cn('flex-1 first:rounded-l-sm last:rounded-r-sm', nodeColorClass(m))}
              />
            ))}
          </div>
          {currentIdx < total && (
            <div
              className="pointer-events-none absolute -top-2 -bottom-2 z-10"
              style={{ left: `${(currentIdx / total) * 100}%` }}
              title="Today"
            >
              <div className="absolute left-1/2 top-0 h-full w-0.5 -translate-x-1/2 bg-foreground/80" />
              <div className="absolute left-1/2 top-0 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground ring-2 ring-background" />
            </div>
          )}
        </button>

        <div className="text-right">
          <span className={cn('text-sm font-semibold tnum', late ? 'text-danger' : cum < 0 ? 'text-success' : 'text-muted-foreground')}>
            {cum > 0 ? `+${cum}d` : cum < 0 ? `${cum}d` : 'on time'}
          </span>
          {cum !== 0 && <div className="text-[10px] text-muted-foreground">{late ? 'late' : 'early'}</div>}
          {origDate && <div className="text-[10px] text-muted-foreground">Due {origDate}</div>}
        </div>
      </div>

      {expanded && (
        <div className="flex flex-wrap items-center gap-y-3 px-2 pb-3 pl-[2.6rem]">
          {ms.map((m, i) => {
            const s = effectiveStatus(m);
            const delta = milestoneDelta(m);
            const start = formatDate(m.actual_start);
            const end = formatDate(m.actual_end || m.planned_end);
            return (
              <div key={m.id} className="flex items-center">
                {i > 0 && (
                  <div className="mx-0.5 flex shrink-0 items-center" aria-hidden="true">
                    <div className="h-px w-3 bg-border sm:w-5" />
                    <svg width="6" height="8" viewBox="0 0 6 8" className="-ml-px shrink-0 fill-border">
                      <path d="M0 0L6 4L0 8Z" />
                    </svg>
                  </div>
                )}
                <div
                  className={cn(
                    'flex flex-col gap-1 whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-xs',
                    statusPillClasses(s.code)
                  )}
                >
                  <span className="font-medium">{m.milestone_label}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-semibold uppercase tracking-wide">{s.label}</span>
                    {delta != null && (
                      <span className={cn('text-[10px] font-semibold', delta > 0 ? 'text-danger' : delta < 0 ? 'text-success' : 'opacity-70')}>
                        {deltaLabel(delta)}
                      </span>
                    )}
                    {(start || end) && (
                      <span className="text-[10px] font-normal opacity-60">
                        {start || '—'}{end ? ` → ${end}` : ''}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const LEGEND = [
  ['bg-success', 'Closed'],
  ['bg-warning', 'Running late'],
  ['bg-danger', 'Blocked'],
  ['bg-info', 'On track'],
  ['bg-muted-foreground/40', 'Not started'],
];

export default function PortfolioDelayTimeline({ projects }) {
  const rows = (projects || []).filter(p => (p.milestones || []).length);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Milestone Tracker</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No scheduled projects yet.</p>
        ) : (
          <>
            {/* Column headers — short stage names. Every project seeds from the same 25-stage
                template in the same order, so one header reads across all rows. gap-px matches
                the bar segments' gap so header cells, stripes and segments share one stride. */}
            <div className={cn('hidden sm:grid', ROW_GRID)} aria-hidden>
              <div /><div />
              <div className="flex items-end gap-px">
                {MILESTONE_TEMPLATE.map((m, i) => (
                  <div key={m.key} title={m.label}
                    className={cn('flex h-16 flex-1 items-end justify-center overflow-hidden rounded-t-sm pb-1',
                      i % 2 === 1 && 'bg-foreground/10')}>
                    <span className="rotate-180 truncate text-[9px] leading-none text-muted-foreground [writing-mode:vertical-rl]">
                      {m.short}
                    </span>
                  </div>
                ))}
              </div>
              <div />
            </div>

            <div className="relative">
              {/* Faint alternating column stripes behind every row, aligned to the bar track.
                  ponytail: assumes the canonical template — a project with custom milestones still
                  renders its own bars correctly, it just reads against the standard header. */}
              <div className={cn('pointer-events-none absolute inset-y-0 hidden gap-px sm:flex', TRACK_LEFT, TRACK_RIGHT)} aria-hidden>
                {MILESTONE_TEMPLATE.map((m, i) => (
                  <div key={m.key} className={cn('flex-1', i % 2 === 1 && 'bg-foreground/[0.06]')} />
                ))}
              </div>
              {rows.map(p => <Row key={p.id} project={p} />)}
            </div>

            <div className="hidden flex-wrap items-center justify-end gap-3 pt-2 sm:flex">
              {LEGEND.map(([c, label]) => (
                <span key={label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className={cn('size-2 rounded-full', c)} />{label}
                </span>
              ))}
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="relative inline-block h-3 w-2">
                  <span className="absolute left-1/2 top-0 h-full w-0.5 -translate-x-1/2 bg-foreground/80" />
                  <span className="absolute left-1/2 top-0 size-1.5 -translate-x-1/2 -translate-y-1/4 rounded-full bg-foreground ring-2 ring-background" />
                </span>
                Today
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
