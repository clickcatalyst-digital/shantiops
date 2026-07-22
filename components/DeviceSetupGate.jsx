'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { INSTALLER_URL } from '@/lib/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardAction } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DownloadIcon, LogOutIcon } from 'lucide-react';

// Blocks the rest of the app for a functional head until their machine is enrolled — see
// app/layout.js. Polls like PeoplePanel/DevicesPanel/BrowserPanel so it unlocks itself the
// moment the agent's first check-in lands, no manual refresh needed. Nav (and its logout menu)
// is hidden while gated, so this needs its own way out — e.g. signed into the wrong account.
export default function DeviceSetupGate({ machine }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(t);
  }, [router]);

  async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <main className="container flex min-h-[70vh] items-center justify-center py-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Welcome to SB Ops</CardTitle>
          <CardDescription>Just one more step before you're all set.</CardDescription>
          <CardAction>
            <Button size="icon-sm" variant="ghost" aria-label="Log out" onClick={logout}>
              <LogOutIcon />
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm text-muted-foreground">
          {machine ? (
            <>
              <p>
                Download both files below, put them in the same folder on your Windows PC, and
                run the installer — it self-enrolls with no typing. This page unlocks
                automatically once it's done, no need to refresh.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" asChild>
                  <a href={`/api/usb/machines/${machine.id}/enroll-file`} download>Enroll file</a>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <a href={INSTALLER_URL}><DownloadIcon data-icon="inline-start" />Installer</a>
                </Button>
              </div>
              <p>
                While it installs, Windows will show a blue screen titled <strong>"Windows
                protected your PC."</strong> That's expected for a new installer, not a sign
                anything's wrong — click <strong>More info</strong>, then <strong>Run
                anyway</strong> to continue.
              </p>
            </>
          ) : (
            <p>
              Your admin hasn't registered your machine yet. Once they do, the download links
              will appear here automatically — nothing to do on your end right now.
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
