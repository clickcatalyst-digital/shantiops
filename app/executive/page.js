import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getExecutiveSummary, getProjectsWithStatus } from '@/lib/data';
import { getSessionUser, isManager, roleHome } from '@/lib/auth';
import StatusBadge from '@/components/StatusBadge';
import PortfolioDelayTimeline from '@/components/PortfolioDelayTimeline';
import PageHeader from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDate, formatMoney } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function Executive() {
  const user = getSessionUser();
  if (!isManager(user)) redirect(roleHome(user));

  const [{ kpi, delayedBy, topRisks, forecast }, projects] = await Promise.all([
    getExecutiveSummary(),
    getProjectsWithStatus(),
  ]);

  const stats = [
    { label: 'Projects', value: kpi.total },
    { label: 'Healthy', value: kpi.healthy, tone: 'text-success' },
    { label: 'Delayed', value: kpi.delayed, tone: 'text-warning' },
    { label: 'Critical', value: kpi.critical, tone: 'text-danger' },
    { label: 'Completed', value: kpi.completed },
    { label: 'Avg Delay', value: `${kpi.avgDelay}d` },
    { label: 'Value in Progress', value: formatMoney(kpi.valueInProgress) },
  ];
  const delayRows = Object.entries(delayedBy).sort((a, b) => b[1] - a[1]);
  const delayMax = delayRows.reduce((a, [, n]) => Math.max(a, n), 0) || 1;

  return (
    <main className="container flex flex-col gap-6 py-8">
      <PageHeader title="Executive Overview" description="Health, risks and delivery forecast across all projects" />

      {/* Hero: portfolio delay timeline */}
      <PortfolioDelayTimeline projects={projects} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {stats.map(s => (
          <Card key={s.label}>
            <CardContent className="py-4">
              <div className={`text-2xl font-bold tnum ${s.tone || ''}`}>{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Top Risks</CardTitle></CardHeader>
          <CardContent>
            {topRisks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active risks. 🎉</p>
            ) : (
              <div className="flex flex-col divide-y">
                {topRisks.map(r => (
                  <Link key={r.id} href={`/projects/${r.id}`}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm -mx-2 px-2 rounded transition-colors hover:bg-muted/40">
                    <StatusBadge status={{ code: r.code, label: r.code === 'overdue' ? 'Overdue' : 'Blocked' }} />
                    <span className="font-medium">{r.project_no}</span>
                    <span className="text-muted-foreground">{r.milestone_label}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{r.delay_category || '—'}</span>
                    <span className="text-xs font-semibold text-danger tnum">+{r.impactDays}d</span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Delayed Because</CardTitle></CardHeader>
          <CardContent>
            {delayRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No categorised delays.</p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {delayRows.map(([cat, n]) => (
                  <div key={cat} className="flex items-center gap-3 text-sm">
                    <span className="w-24 shrink-0 text-muted-foreground">{cat}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${(n / delayMax) * 100}%` }} />
                    </div>
                    <span className="w-6 text-right font-semibold tnum">{n}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Delivery Forecast</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Health</TableHead>
                <TableHead>Est. Dispatch</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {forecast.map(p => (
                <TableRow key={p.id}>
                  <TableCell><Link href={`/projects/${p.id}`} className="font-medium text-primary hover:underline">{p.project_no}</Link></TableCell>
                  <TableCell>{p.customer_name}</TableCell>
                  <TableCell><StatusBadge status={p.roll} /></TableCell>
                  <TableCell className="tnum">{p.estDispatch ? formatDate(p.estDispatch) : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  );
}
