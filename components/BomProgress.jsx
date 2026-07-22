// Per-section BOM procurement rollup — closed (green) / transit (amber) / pending (muted) stacked
// bars, same token colors as the milestone status pills. Pure props; renders server- or client-side.
import { Card, CardContent, CardHeader, CardTitle, CardAction } from '@/components/ui/card';

export default function BomProgress({ rollup }) {
  if (!rollup || !rollup.total) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Master BOM</CardTitle>
        <CardAction className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground tnum">{rollup.closedPct}%</span> of {rollup.total} items closed
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-2.5">
        {rollup.sections.map(s => (
          <div key={s.section} className="flex items-center gap-3 text-sm">
            <span className="w-36 shrink-0 truncate text-muted-foreground" title={s.section}>{s.section}</span>
            <div className="flex h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-success" style={{ width: `${(s.closed / s.total) * 100}%` }} />
              <div className="h-full bg-warning" style={{ width: `${(s.transit / s.total) * 100}%` }} />
            </div>
            <span className="w-20 shrink-0 text-right text-xs text-muted-foreground tnum">
              {s.closed}/{s.total} closed
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
