import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getMyWork, getBomWork } from '@/lib/data';
import { getSessionUser, isCustomer, isManager, isHead, headDepartments, canAccessDepartment, roleHome } from '@/lib/auth';
import StatusBadge from '@/components/StatusBadge';
import DispatchBoard from '@/components/DispatchBoard';
import PageHeader from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/format';
import { ArrowRightIcon } from 'lucide-react';

export const dynamic = 'force-dynamic';

function StatChip({ label, value, dot }) {
  return (
    <div className="flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-sm shadow-sm">
      <span className={`size-2 rounded-full ${dot}`} />
      <span className="font-semibold tnum">{value}</span>
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

export default async function Home({ searchParams }) {
  const user = getSessionUser();
  if (isCustomer(user)) redirect(roleHome(user));

  if (isHead(user) && headDepartments(user).length === 0) {
    return (
      <main className="container py-8">
        <h1 className="mb-4 text-2xl font-bold tracking-tight">My Work</h1>
        <Card><CardContent className="py-10 text-center text-muted-foreground">
          No departments assigned yet — contact your PM.
        </CardContent></Card>
      </main>
    );
  }

  const deptFilter = searchParams?.dept || null;
  const manager = isManager(user);

  // Dispatch department view = the packing board (§ "packing within department").
  if (deptFilter === 'Dispatch' && canAccessDepartment(user, 'Dispatch')) {
    return (
      <main className="container flex flex-col gap-6 py-8">
        <PageHeader title="Packing &amp; Dispatch"
          description="Packing lists generated from each project's BOM — Pending → Ready → Dispatched." />
        <DispatchBoard />
      </main>
    );
  }

  const groups = await getMyWork(user, deptFilter);
  // Open Master-BOM work for BOM-owning departments (Engineering: missing BOMs; Procurement /
  // Stores / Production: items not yet closed). Fills the once-empty Engineering attention list.
  const bomWork = deptFilter && deptFilter !== 'Engineering' && !['Procurement', 'Stores', 'Production'].includes(deptFilter)
    ? [] : await getBomWork(user);
  const title = deptFilter || (manager ? "Today's Factory" : 'My Work');
  const total = groups.reduce((a, g) => a + g.items.length, 0);
  const allItems = groups.flatMap(g => g.items);
  const chips = {
    overdue: allItems.filter(m => m.eff.code === 'overdue').length,
    blocked: allItems.filter(m => m.eff.code === 'blocked').length,
    dueSoon: allItems.filter(m => m.eff.code === 'due_now' || m.eff.code === 'due_soon').length,
  };

  return (
    <main className="container flex flex-col gap-6 py-8">
      <PageHeader title={title}
        description={`${manager ? 'Everything needing attention across all projects' : `Assigned to @${user?.username}`} · ${total} item${total !== 1 ? 's' : ''}`}>
        {manager && (
          <Button asChild variant="outline" size="sm">
            <Link href="/executive">Executive view <ArrowRightIcon data-icon="inline-end" /></Link>
          </Button>
        )}
      </PageHeader>

      <div className="flex flex-wrap gap-2">
        <StatChip label="overdue" value={chips.overdue} dot="bg-danger" />
        <StatChip label="blocked" value={chips.blocked} dot="bg-blocked" />
        <StatChip label="due soon" value={chips.dueSoon} dot="bg-warning" />
      </div>

      {bomWork.length > 0 && (
        <Card>
          <CardHeader className="py-4"><CardTitle className="text-base">Master BOM</CardTitle></CardHeader>
          <CardContent className="flex flex-col divide-y pt-0">
            {bomWork.map(w => (
              <Link key={w.id} href={`/projects/${w.id}`}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm transition-colors hover:bg-muted/40 -mx-2 px-2 rounded">
                <span className="font-medium text-primary">{w.project_no}</span>
                <span className="text-muted-foreground">{w.customer_name}</span>
                <span className="ml-auto text-xs tnum">
                  {w.total === 0
                    ? <span className="text-warning font-medium">BOM not uploaded</span>
                    : <span className="text-muted-foreground">{w.open} open item{w.open !== 1 ? 's' : ''}</span>}
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {groups.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">
          Nothing needs attention right now. 🎉
        </CardContent></Card>
      ) : (
        <div className="grid items-start gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {groups.map(g => (
            <Card key={g.items[0].project_id}>
              <CardHeader className="flex-row items-center justify-between gap-2 py-4">
                <CardTitle className="text-base">
                  <Link href={`/projects/${g.items[0].project_id}`} className="text-primary hover:underline">{g.project_no}</Link>
                  <span className="text-muted-foreground font-normal"> · {g.customer_name}</span>
                </CardTitle>
                <span className="text-xs text-muted-foreground tnum">{g.items.length} item{g.items.length !== 1 ? 's' : ''}</span>
              </CardHeader>
              <CardContent className="flex flex-col divide-y pt-0">
                {g.items.map(m => (
                  <Link key={m.id} href={`/projects/${m.project_id}`}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm transition-colors hover:bg-muted/40 -mx-2 px-2 rounded">
                    <StatusBadge status={m.eff} />
                    <span className="font-medium">{m.milestone_label}</span>
                    {manager && <span className="text-xs text-muted-foreground">{m.assignee ? `@${m.assignee}` : 'Unassigned'}</span>}
                    <span className="ml-auto text-xs text-muted-foreground tnum">{formatDate(m.planned_end)}</span>
                    {m.delay_reason && <span className="w-full text-xs text-warning">⚠ {m.delay_reason}</span>}
                  </Link>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
