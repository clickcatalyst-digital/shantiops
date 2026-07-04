// Full-detail date timeline for a project, collapsed by default — sits below the delay chain.
import { effectiveStatus } from '@/lib/sla';
import { nodeColorClass } from '@/lib/delay';
import { Card } from '@/components/ui/card';

const DAY = 864e5;
const iso = d => d.toISOString().slice(0, 10);

export default function SwimlaneGantt({ milestones }) {
  const dated = milestones.filter(m => m.planned_start && m.planned_end);
  if (!dated.length) return null;

  const min = new Date(dated.reduce((a, m) => (m.planned_start < a ? m.planned_start : a), dated[0].planned_start));
  const max = new Date(dated.reduce((a, m) => (m.planned_end > a ? m.planned_end : a), dated[0].planned_end));
  const span = Math.max(max - min, DAY);
  const pct = dateStr => ((new Date(dateStr) - min) / span) * 100;

  const ticks = [];
  const t = new Date(min.getFullYear(), min.getMonth(), 1);
  while (t <= max) {
    if (t >= min) ticks.push({ left: pct(iso(t)), label: t.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }) });
    t.setMonth(t.getMonth() + 1);
  }
  const today = new Date();
  const todayLeft = today >= min && today <= max ? pct(iso(today)) : null;

  return (
    <Card className="p-0">
      <details>
        <summary className="flex cursor-pointer items-center justify-between gap-2 px-6 py-4 text-sm font-semibold">
          Milestone Timeline
          <span className="text-xs font-normal text-muted-foreground">click to expand</span>
        </summary>
        <div className="overflow-x-auto px-6 pb-6">
          <div className="min-w-[720px]">
            <div className="relative mb-2 h-5 border-b">
              {ticks.map((tk, i) => (
                <span key={i} className="absolute -translate-x-1/2 text-[10px] font-semibold text-muted-foreground" style={{ left: `${tk.left}%` }}>{tk.label}</span>
              ))}
            </div>
            <div className="relative h-6">
              {todayLeft != null && <span className="absolute -top-1 bottom-0 z-10 w-0.5 bg-primary" style={{ left: `${todayLeft}%` }} />}
              {dated.map(m => {
                const left = pct(m.planned_start);
                const width = Math.max(pct(m.planned_end) - left, 0.6);
                return (
                  <span key={m.id} className={`absolute top-1.5 h-3 rounded-sm ${nodeColorClass(m)}`}
                    style={{ left: `${left}%`, width: `${width}%` }}
                    title={`${m.milestone_label}: ${m.planned_start} → ${m.planned_end} (${effectiveStatus(m).label})`} />
                );
              })}
            </div>
          </div>
        </div>
      </details>
    </Card>
  );
}
