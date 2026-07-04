import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { queryOne } from '@/lib/db';
import { signToken, COOKIE_OPTS } from '@/lib/auth';

export async function POST(req) {
  const { username, password } = await req.json();
  const user = await queryOne('SELECT * FROM users WHERE username = ?', [username]);
  if (!user || !bcrypt.compareSync(password || '', user.password)) {
    return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
  }
  if (!user.active) {
    return NextResponse.json({ error: 'This account has been deactivated' }, { status: 403 });
  }
  const res = NextResponse.json({ ok: true, role: user.role });
  res.cookies.set(COOKIE_OPTS.name, signToken(user), COOKIE_OPTS);
  return res;
}
