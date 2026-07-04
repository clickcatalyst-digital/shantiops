// Exception-only view: the milestones needing attention right now.
import StatusBadge from './StatusBadge';
import { effectiveStatus } from '@/lib/sla';
import { formatDate } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const ATTENTION = new Set(['overdue', 'blocked', 'due_now', 'due_soon', 'in_progress']);
const ORDER = { overdue: 0, blocked: 1, due_now: 2, due_soon: 3, in_progress: 4 };

export default function TodayBand({ milestones }) {
  const items = milestones
    .map(m => ({ ...m, eff: effectiveStatus(m) }))
    .filter(m => ATTENTION.has(m.eff.code))
    .sort((a, b) => ORDER[a.eff.code] - ORDER[b.eff.code]);

  return (
    <Card>
      <CardHeader><CardTitle>Needs Attention — {items.length}</CardTitle></CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing overdue, blocked, or due soon. 🎉</p>
        ) : (
          <div className="flex flex-col divide-y">
            {items.map(m => (
              <div key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
                <StatusBadge status={m.eff} />
                <span className="font-medium">{m.milestone_label}</span>
                <span className="text-xs text-muted-foreground">{m.assignee ? `@${m.assignee}` : 'Unassigned'}</span>
                <span className="ml-auto text-xs text-muted-foreground tnum">{formatDate(m.planned_end)}</span>
                {m.delay_reason && <span className="w-full text-xs text-warning">⚠ {m.delay_reason}</span>}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
