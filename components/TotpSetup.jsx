'use client';

import { useState } from 'react';
import { api, showToast } from '@/lib/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Two-phase enrollment: generate a secret (QR shown), then confirm with a live code before it's
// promoted to the active secret — a mis-scan can't lock the manager out of USB approvals.
export default function TotpSetup({ configured }) {
  const [qr, setQr] = useState(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(configured);

  async function generate() {
    setBusy(true);
    try {
      const data = await api('/api/usb/totp', { method: 'POST', body: {} });
      setQr(data.qr);
    } catch (err) { showToast(err.message, 'error'); }
    setBusy(false);
  }

  async function confirm(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/api/usb/totp', { method: 'POST', body: { code } });
      showToast('TOTP enabled — you can now approve USB requests');
      setDone(true);
      setQr(null);
    } catch (err) { showToast(err.message, 'error'); }
    setBusy(false);
  }

  return (
    <Card>
      <CardHeader><CardTitle>USB Approval Authenticator</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-4">
        {done && !qr && (
          <p className="text-sm text-muted-foreground">
            Authenticator configured. Scan again to replace it.
          </p>
        )}
        {!qr ? (
          <div><Button variant="outline" disabled={busy} onClick={generate}>
            {done ? 'Reconfigure' : 'Set up authenticator'}
          </Button></div>
        ) : (
          <form onSubmit={confirm} className="flex flex-col gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="Scan with an authenticator app" className="size-40 rounded border" />
            <div className="flex flex-col gap-1.5">
              <Label>Enter the 6-digit code to confirm</Label>
              <Input value={code} onChange={e => setCode(e.target.value)} maxLength={6} required
                inputMode="numeric" placeholder="000000" />
            </div>
            <div><Button disabled={busy}>{busy ? 'Confirming…' : 'Confirm'}</Button></div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
