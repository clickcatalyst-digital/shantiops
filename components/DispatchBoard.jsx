import Link from 'next/link';
import { getPackingLists } from '@/lib/data';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// The packing board — Pending → Ready → Dispatched. Rendered inside the Dispatch department view.
const COLUMNS = [
  { key: 'draft', label: 'Pending', tone: 'bg-warning/10 text-warning ring-warning/20' },
  { key: 'packed', label: 'Ready', tone: 'bg-info/10 text-info ring-info/20' },
  { key: 'dispatched', label: 'Dispatched', tone: 'bg-success/10 text-success ring-success/20' },
];

export default async function DispatchBoard() {
  const lists = await getPackingLists();
  const byStatus = { draft: [], packed: [], dispatched: [] };
  lists.forEach(l => { (byStatus[l.status] || byStatus.draft).push(l); });

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {COLUMNS.map(col => (
        <div key={col.key} className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-sm font-semibold">{col.label}</span>
            <span className="text-xs text-muted-foreground tnum">{byStatus[col.key].length}</span>
          </div>
          {byStatus[col.key].map(l => (
            <Link key={l.id} href={`/packing/${l.id}`} className="group">
              <Card className="transition-colors group-hover:border-primary/40 group-hover:bg-accent/40">
                <CardContent className="flex flex-col gap-1 py-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold tnum">{l.packing_no}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${col.tone}`}>{col.label}</span>
                  </div>
                  <div className="text-sm">{l.customer_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {l.invoice_no || 'No invoice'} · {l.item_count} item{l.item_count !== 1 ? 's' : ''}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
          {byStatus[col.key].length === 0 && (
            <div className="rounded-lg border border-dashed py-6 text-center text-xs text-muted-foreground">None</div>
          )}
        </div>
      ))}
    </div>
  );
}
