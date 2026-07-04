// Executive hero (redesign §6, portfolio view): one row per project, its stages as a connected
// bar colored by state, a today-marker, and the cumulative dispatch delay called out at the end.
// Scannable across every project at once — an executive Gantt of delay.
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { effectiveStatus } from '@/lib/sla';
import { cumulativeDelay, nodeColorClass } from '@/lib/delay';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function Row({ project }) {
  const ms = [...(project.milestones || [])].sort((a, b) => a.sort_order - b.sort_order);
  const total = ms.length || 1;
  // Today-marker = boundary at the first not-yet-done stage.
  let currentIdx = ms.findIndex(m => !(m.actual_end || m.status === 'done'));
  if (currentIdx === -1) currentIdx = total;
  const cum = cumulativeDelay(ms);
  const late = cum > 0;
  const done = ms.filter(m => m.actual_end || m.status === 'done').length;

  return (
    <div className="grid grid-cols-[9rem_1fr_5.5rem] items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/50">
      <Link href={`/projects/${project.id}`} className="min-w-0">
        <div className="truncate text-sm font-semibold text-primary hover:underline">{project.project_no}</div>
        <div className="truncate text-xs text-muted-foreground">{Math.round((done / total) * 100)}% complete</div>
      </Link>

      <div className="relative">
        <div className="flex h-3 items-stretch gap-px">
          {ms.map(m => (
            <div
              key={m.id}
              title={`${m.milestone_label} · ${effectiveStatus(m).label}`}
              className={cn('flex-1 first:rounded-l-sm last:rounded-r-sm', nodeColorClass(m))}
            />
          ))}
        </div>
        {/* today marker */}
        {currentIdx < total && (
          <div
            className="absolute -top-1 -bottom-1 w-0.5 bg-foreground/70"
            style={{ left: `${(currentIdx / total) * 100}%` }}
            title="Today"
          />
        )}
      </div>

      <div className="text-right">
        <span className={cn('text-sm font-semibold tnum', late ? 'text-danger' : cum < 0 ? 'text-success' : 'text-muted-foreground')}>
          {cum > 0 ? `+${cum}d` : cum < 0 ? `${cum}d` : 'on time'}
        </span>
        {cum !== 0 && <div className="text-[10px] text-muted-foreground">{late ? 'late' : 'early'}</div>}
      </div>
    </div>
  );
}

const LEGEND = [
  ['bg-success', 'Closed'],
  ['bg-warning', 'Running late'],
  ['bg-blocked', 'Blocked'],
  ['bg-info', 'On track'],
  ['bg-muted-foreground/40', 'Not started'],
];

export default function PortfolioDelayTimeline({ projects }) {
  const rows = (projects || []).filter(p => (p.milestones || []).length);
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <div>
          <CardTitle>Delay Chain — Portfolio</CardTitle>
          <p className="text-sm text-muted-foreground">Every project's stages, cumulative dispatch delay at the end.</p>
        </div>
        <div className="hidden flex-wrap items-center gap-3 sm:flex">
          {LEGEND.map(([c, label]) => (
            <span key={label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={cn('size-2.5 rounded-sm', c)} />{label}
            </span>
          ))}
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-3 w-0.5 bg-foreground/70" />Today
          </span>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        {rows.length === 0
          ? <p className="py-6 text-center text-sm text-muted-foreground">No scheduled projects yet.</p>
          : rows.map(p => <Row key={p.id} project={p} />)}
      </CardContent>
    </Card>
  );
}
