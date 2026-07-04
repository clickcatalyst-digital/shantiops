'use client';

// Rows: functional heads. Columns: departments. Toggling a cell grants/revokes department access.
import { useState } from 'react';
import { api, showToast } from '@/lib/client';
import { DEPARTMENTS } from '@/lib/milestones';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function AccessMatrix({ heads: initialHeads }) {
  const [heads, setHeads] = useState(initialHeads);

  async function toggle(head, dept) {
    const has = head.departments.includes(dept);
    const next = has ? head.departments.filter(d => d !== dept) : [...head.departments, dept];
    setHeads(hs => hs.map(h => (h.id === head.id ? { ...h, departments: next } : h)));
    try {
      await api(`/api/users/${head.id}`, { method: 'PATCH', body: { departments: next } });
    } catch (err) {
      showToast(err.message, 'error');
      setHeads(hs => hs.map(h => (h.id === head.id ? { ...h, departments: head.departments } : h)));
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle>Access Matrix</CardTitle></CardHeader>
      <CardContent>
        {heads.length === 0 ? (
          <p className="text-sm text-muted-foreground">No functional heads yet — create one below.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Head</TableHead>
                  {DEPARTMENTS.map(d => <TableHead key={d} className="text-center">{d}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {heads.map(h => (
                  <TableRow key={h.id}>
                    <TableCell>
                      <div className="font-medium">{h.display_name || h.username}</div>
                      <div className="text-xs text-muted-foreground">@{h.username}</div>
                    </TableCell>
                    {DEPARTMENTS.map(d => (
                      <TableCell key={d} className="text-center">
                        <Checkbox checked={h.departments.includes(d)} onCheckedChange={() => toggle(h, d)} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
