// Downloads a per-machine shanti-enroll.json (server URL + live enroll code). The manager drops
// this into the employee's Drive folder; the installer reads it beside itself for zero-typing setup.
// PM-only. Leak risk is bounded: single-use, 24h expiry, and an enrolled machine does nothing
// without manager TOTP.
import { NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
import { getSessionUser, requirePM } from '@/lib/auth';
import { ensureEnrollCode } from '@/lib/enroll';

export const dynamic = 'force-dynamic';

export async function GET(req, { params }) {
  const user = getSessionUser();
  const guard = requirePM(user);
  if (guard) return guard;

  const machine = await queryOne('SELECT id, name FROM machines WHERE id = ?', [Number(params.id)]);
  if (!machine) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const code = await ensureEnrollCode(machine.id);
  const server_url = new URL(req.url).origin;
  const body = JSON.stringify({ server_url, enroll_code: code }, null, 2);

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="shanti-enroll.json"',
    },
  });
}
