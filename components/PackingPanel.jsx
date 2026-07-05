'use client';

// Dispatch's packing panel (§ dept-scoped view): generate a draft packing list from the Engineering
// BOM's still-pending lines, export the pending list, and list this project's packing lists.
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, showToast } from '@/lib/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const STATUS_TONE = {
  draft: 'bg-warning/10 text-warning ring-warning/20',
  packed: 'bg-info/10 text-info ring-info/20',
  dispatched: 'bg-success/10 text-success ring-success/20',
};
const STATUS_LABEL = { draft: 'Pending', packed: 'Ready', dispatched: 'Dispatched' };

export default function PackingPanel({ projectId, pending, packingLists, canPack }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    try {
      const { id, items } = await api('/api/packing/from-bom', { method: 'POST', body: { project_id: projectId } });
      showToast(`Draft packing list created (${items} items)`);
      router.push(`/packing/${id}`);
    } catch (err) { showToast(err.message, 'error'); setBusy(false); }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle>Packing &amp; Dispatch</CardTitle>
        {canPack && pending.length > 0 && (
          <div className="flex gap-2">
            <Button size="sm" disabled={busy} onClick={generate}>Generate Draft Packing List</Button>
            <Button asChild size="sm" variant="outline">
              <a href={`/api/projects/${projectId}/pending-pdf`} target="_blank" rel="noreferrer">Pending PDF</a>
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {canPack && pending.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {pending.length} BOM line{pending.length !== 1 ? 's' : ''} pending — generate a draft to pack {pending.length !== 1 ? 'them' : 'it'}.
          </p>
        )}
        {packingLists.length === 0 ? (
          <p className="text-sm text-muted-foreground">No packing lists yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {packingLists.map(pl => (
              <Link key={pl.id} href={`/packing/${pl.id}`}
                className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm transition-colors hover:border-primary/40 hover:bg-accent/40">
                <div className="flex flex-col">
                  <span className="font-semibold tnum">{pl.packing_no}</span>
                  <span className="text-xs text-muted-foreground">{pl.item_count} item{pl.item_count !== 1 ? 's' : ''}</span>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_TONE[pl.status] || STATUS_TONE.draft}`}>
                  {STATUS_LABEL[pl.status] || pl.status}
                </span>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
