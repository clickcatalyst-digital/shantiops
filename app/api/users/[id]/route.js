import { NextResponse } from 'next/server';
import { execute } from '@/lib/db';
import { getSessionUser, requirePM } from '@/lib/auth';

// PM-only: toggle a functional head's department access (access matrix) and/or active status.
export async function PATCH(req, { params }) {
  const denied = requirePM(getSessionUser());
  if (denied) return denied;
  const b = await req.json();

  const sets = [];
  const args = [];
  if (Array.isArray(b.departments)) { sets.push('departments = ?'); args.push(b.departments.join(',') || null); }
  if ('active' in b) { sets.push('active = ?'); args.push(b.active ? 1 : 0); }
  if (!sets.length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  args.push(params.id);
  await execute(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, args);
  return NextResponse.json({ ok: true });
}
