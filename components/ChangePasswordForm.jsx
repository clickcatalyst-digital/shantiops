'use client';

import { useState } from 'react';
import { api, showToast } from '@/lib/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ChangePasswordForm() {
  const [f, setF] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (f.newPassword !== f.confirm) return showToast('New passwords do not match', 'error');
    setBusy(true);
    try {
      await api('/api/account/password', { method: 'POST', body: f });
      showToast('Password updated');
      setF({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) { showToast(err.message, 'error'); }
    setBusy(false);
  }

  return (
    <Card>
      <CardHeader><CardTitle>Change Password</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5"><Label>Current Password</Label>
            <Input type="password" required value={f.currentPassword} onChange={e => setF({ ...f, currentPassword: e.target.value })} /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5"><Label>New Password</Label>
              <Input type="password" required minLength={6} value={f.newPassword} onChange={e => setF({ ...f, newPassword: e.target.value })} /></div>
            <div className="flex flex-col gap-1.5"><Label>Confirm New Password</Label>
              <Input type="password" required minLength={6} value={f.confirm} onChange={e => setF({ ...f, confirm: e.target.value })} /></div>
          </div>
          <div><Button disabled={busy}>{busy ? 'Saving…' : 'Update Password'}</Button></div>
        </form>
      </CardContent>
    </Card>
  );
}
