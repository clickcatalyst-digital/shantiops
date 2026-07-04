import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { execute, queryOne } from '@/lib/db';
import { getSessionUser, requirePM } from '@/lib/auth';

// Create a functional-head account (PM only). Departments are granted afterward via the access matrix.
export async function POST(req) {
  const denied = requirePM(getSessionUser());
  if (denied) return denied;
  const b = await req.json();
  if (!b.username?.trim() || !b.password?.trim()) {
    return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
  }
  const existing = await queryOne('SELECT id FROM users WHERE username = ?', [b.username.trim()]);
  if (existing) return NextResponse.json({ error: `User ${b.username} already exists` }, { status: 409 });

  const r = await execute(
    'INSERT INTO users (username, password, role, display_name) VALUES (?, ?, ?, ?)',
    [b.username.trim(), bcrypt.hashSync(b.password, 10), 'operator', b.display_name?.trim() || null]
  );
  return NextResponse.json({ id: Number(r.lastId) });
}
