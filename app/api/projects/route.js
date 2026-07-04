import { NextResponse } from 'next/server';
import { execute, nextNumber } from '@/lib/db';
import { getSessionUser, requirePM } from '@/lib/auth';

export async function POST(req) {
  const user = getSessionUser();
  const denied = requirePM(user); // project creation is PM/engineering-only
  if (denied) return denied;
  const b = await req.json();
  if (!b.customer_name?.trim()) {
    return NextResponse.json({ error: 'Customer name is required' }, { status: 400 });
  }
  const project_no = b.project_no?.trim() || (await nextNumber('project_no', 'SB'));
  try {
    const r = await execute(
      `INSERT INTO projects (project_no, customer_name, description, order_date, owner)
       VALUES (?, ?, ?, ?, ?)`,
      [project_no, b.customer_name.trim(), b.description || null, b.order_date || null, user?.username || null]
    );
    return NextResponse.json({ id: Number(r.lastId), project_no });
  } catch (e) {
    if (String(e).includes('UNIQUE')) {
      return NextResponse.json({ error: `Project ${project_no} already exists` }, { status: 409 });
    }
    throw e;
  }
}
