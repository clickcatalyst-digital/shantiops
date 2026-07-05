'use client';

// Engineering's Bill of Materials panel (§ dept-scoped view): upload a flat BOM + the BOM table with
// Pending/Packed reconciliation status. Generating a packing list from the BOM is a Dispatch action
// (see PackingPanel), not here.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, showToast } from '@/lib/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

function parseBom(text) {
  return text.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
    const [material_description, moc, size_spec] = line.split(/\t|,/).map(x => x?.trim());
    return { material_description, moc, size_spec };
  }).filter(r => r.material_description);
}

export default function BomPanel({ projectId, bom, pending, canUpload }) {
  const router = useRouter();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const pendingIds = new Set(pending.map(p => p.id));

  async function upload(e) {
    e.preventDefault();
    const rows = parseBom(text);
    if (!rows.length) return showToast('Paste at least one BOM line', 'error');
    setBusy(true);
    try {
      const { inserted } = await api(`/api/projects/${projectId}/bom`, { method: 'POST', body: { rows } });
      showToast(`${inserted} BOM line${inserted !== 1 ? 's' : ''} added`);
      setText('');
      router.refresh();
    } catch (err) { showToast(err.message, 'error'); }
    setBusy(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bill of Materials</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {bom.length === 0 ? (
          <p className="text-sm text-muted-foreground">No BOM uploaded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow><TableHead>#</TableHead><TableHead>Description</TableHead><TableHead>MOC</TableHead><TableHead>Size / Spec</TableHead><TableHead>Status</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {bom.map((b, i) => {
                  const isPending = pendingIds.has(b.id);
                  return (
                    <TableRow key={b.id}>
                      <TableCell className="tnum">{i + 1}</TableCell>
                      <TableCell className="font-medium">{b.material_description}</TableCell>
                      <TableCell>{b.moc || '—'}</TableCell>
                      <TableCell>{b.size_spec || '—'}</TableCell>
                      <TableCell>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${isPending ? 'bg-warning/10 text-warning ring-warning/20' : 'bg-success/10 text-success ring-success/20'}`}>
                          {isPending ? 'Pending' : 'Packed'}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {canUpload && (
          <form onSubmit={upload} className="flex flex-col gap-2">
            <Label>Upload BOM <span className="text-muted-foreground">— one item per line: Description, MOC, Size/Spec</span></Label>
            <Textarea rows={4} value={text} onChange={e => setText(e.target.value)}
              placeholder={'Control Panel, CS, As per drawing\nID Fan with Motor, MS, CFM:3000 · 5 HP'} />
            <div><Button disabled={busy}>{busy ? 'Uploading…' : 'Upload BOM'}</Button></div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
