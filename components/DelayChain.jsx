// Compact single-project delay chain for the project page (the portfolio version lives on Executive).
// Milestones as a left→right sequence of nodes in fixed order; each shows its own delta, the final
// node the cumulative running total.
import { cn } from '@/lib/utils';
import { effectiveStatus } from '@/lib/sla';
import { milestoneDelta, cumulativeDelay, deltaLabel, nodeColorClass } from '@/lib/delay';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const LEGEND = [
  ['bg-success', 'Closed'],
  ['bg-warning', 'Running late'],
  ['bg-blocked', 'Blocked'],
  ['bg-info', 'On track'],
  ['bg-muted-foreground/40', 'Not started'],
];

export default function DelayChain({ milestones }) {
  const ordered = [...milestones].sort((a, b) => a.sort_order - b.sort_order);
  if (!ordered.length) return null;
  const cum = cumulativeDelay(ordered);
  const lastIdx = ordered.length - 1;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle>Delay Chain</CardTitle>
        <div className="hidden flex-wrap items-center gap-3 sm:flex">
          {LEGEND.map(([c, label]) => (
            <span key={label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={cn('size-2.5 rounded-sm', c)} />{label}
            </span>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex overflow-x-auto pb-2">
          {ordered.map((m, i) => {
            const d = milestoneDelta(m);
            const isFinal = i === lastIdx;
            const shown = isFinal ? cum : d;
            return (
              <div key={m.id} className="flex flex-none items-start">
                <div className="w-32 text-center" title={`${m.milestone_label} · ${effectiveStatus(m).label}`}>
                  <div className={cn('mx-auto mb-1.5 size-4 rounded-full', nodeColorClass(m), isFinal && 'ring-2 ring-foreground ring-offset-2 ring-offset-background')} />
                  <div className="min-h-8 text-[10px] leading-tight text-muted-foreground">{m.milestone_label}</div>
                  <div className={cn('text-[10px] font-semibold tnum', shown > 0 ? 'text-danger' : shown < 0 ? 'text-success' : 'text-muted-foreground')}>
                    {isFinal ? `Σ ${deltaLabel(cum)}` : deltaLabel(d)}
                  </div>
                </div>
                {!isFinal && <div className="mt-2 h-px w-5 flex-none bg-border" />}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
