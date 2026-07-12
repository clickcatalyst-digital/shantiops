import Link from 'next/link';
import { getSessionUser, isPM, isHead, isCustomer, headDepartments } from '@/lib/auth';
import { PM_GUIDE, HEAD_GUIDES, CUSTOMER_GUIDE } from '@/components/help-content';
import PageHeader from '@/components/PageHeader';
import LogoutButton from '@/components/LogoutButton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

function GuideSection({ title, icon: Icon, steps }) {
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Icon className="size-4 text-primary" />{title}</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-3">
        {steps.map((s, i) => (
          <div key={s.title} className="flex gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">{i + 1}</span>
            <div>
              <div className="text-sm font-medium">{s.title}</div>
              <p className="text-sm text-muted-foreground">{s.body}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default async function HelpPage() {
  const user = getSessionUser();

  let sections = [];
  if (isPM(user)) {
    sections = PM_GUIDE;
  } else if (isHead(user)) {
    sections = headDepartments(user).map(d => HEAD_GUIDES[d]).filter(Boolean);
  } else if (isCustomer(user)) {
    sections = CUSTOMER_GUIDE;
  }

  const body = (
    <div className="grid gap-4 sm:grid-cols-2">
      {sections.map(s => <GuideSection key={s.title} {...s} />)}
      {sections.length === 0 && (
        <Card className="sm:col-span-2"><CardContent className="py-10 text-center text-muted-foreground">
          No departments assigned yet — contact your PM for a guide to your work.
        </CardContent></Card>
      )}
    </div>
  );

  if (isCustomer(user)) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-muted/40 to-background">
        <header className="border-b bg-background/80 backdrop-blur">
          <div className="container flex h-14 items-center justify-between">
            <div className="text-base font-bold tracking-tight">SHANTI<span className="text-primary">BOILERS</span></div>
            <LogoutButton />
          </div>
        </header>
        <main className="container flex max-w-3xl flex-col gap-4 py-8">
          <Link href="/portal" className="text-sm text-muted-foreground hover:underline">← My Orders</Link>
          <h1 className="text-2xl font-bold tracking-tight">Help</h1>
          {body}
        </main>
      </div>
    );
  }

  return (
    <main className="container flex flex-col gap-6 py-8">
      <PageHeader title="Help"
        description={isPM(user)
          ? 'How to use the system, end to end'
          : 'What you can do here, department by department'} />
      {body}
    </main>
  );
}
