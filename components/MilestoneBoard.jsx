'use client';

// Flat milestone board for a project. Card grid by default; bulk-edit flips to a spreadsheet grid.
import { useState } from 'react';
import MilestoneCard from './MilestoneCard';
import MilestoneGrid from './MilestoneGrid';
import MilestoneDrawer from './MilestoneDrawer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function MilestoneBoard({ milestones, head = false }) {
  const [drawer, setDrawer] = useState(null);
  const [bulk, setBulk] = useState(false);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle>Milestones</CardTitle>
        {!head && (
          <Button variant="outline" size="sm" onClick={() => setBulk(b => !b)}>
            {bulk ? 'Cards' : 'Bulk edit'}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {bulk && !head
          ? <MilestoneGrid milestones={milestones} />
          : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {milestones.map(m => <MilestoneCard key={m.id} m={m} onClick={() => setDrawer(m)} />)}
            </div>
          )}
      </CardContent>
      {drawer && <MilestoneDrawer milestone={drawer} head={head} onClose={() => setDrawer(null)} />}
    </Card>
  );
}
