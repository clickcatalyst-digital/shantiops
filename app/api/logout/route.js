import { NextResponse } from 'next/server';
import { COOKIE_OPTS } from '@/lib/auth';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_OPTS.name, '', { ...COOKIE_OPTS, maxAge: 0 });
  return res;
}
