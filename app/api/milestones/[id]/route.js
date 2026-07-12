import { NextResponse } from 'next/server';
import { execute, queryOne } from '@/lib/db';
import { getSessionUser, isInternal, isHead, canAccessDepartment } from '@/lib/auth';
import { audit } from '@/lib/usb';

// Whitelisted columns — never interpolate a client-supplied column name into SQL.
const EDITABLE = ['assignee', 'department', 'planned_start', 'planned_end', 'actual_start', 'actual_end',
  'status', 'delay_reason', 'delay_category', 'vendor', 'po_no', 'material_ready', 'qc_ok', 'notes'];
// Functional heads own execution, not schedule: they may only stamp actuals/status/why-late.
const HEAD_EDITABLE = ['actual_start', 'actual_end', 'status', 'delay_reason', 'delay_category'];

export async function PATCH(req, { params }) {
  const user = getSessionUser();
  if (!isInternal(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const b = await req.json();

  // Fetched unconditionally (not just for heads) so the audit entry can name the project/milestone.
  const m = await queryOne('SELECT project_id, milestone_key, department FROM milestones WHERE id = ?', [params.id]);
  if (!m) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let allowed = EDITABLE;
  if (isHead(user)) {
    // A head may only act on milestones in a department they're granted, and only on execution fields.
    if (!canAccessDepartment(user, m.department)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    allowed = HEAD_EDITABLE;
  }

  const sets = [];
  const args = [];
  const changed = [];
  for (const f of allowed) {
    if (f in b) { sets.push(`${f} = ?`); args.push(b[f] === '' ? null : b[f]); changed.push(f); }
  }
  if (!sets.length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  // Setting a status of 'done' with no actual_end auto-stamps today.
  if (b.status === 'done' && !('actual_end' in b)) {
    sets.push('actual_end = COALESCE(actual_end, ?)');
    args.push(new Date().toISOString().slice(0, 10));
  }
  sets.push('updated_at = CURRENT_TIMESTAMP');
  args.push(params.id);
  await execute(`UPDATE milestones SET ${sets.join(', ')} WHERE id = ?`, args);
  await audit('milestone_edit', {
    actor: user.username,
    detail: `project ${m.project_id} · ${m.milestone_key} · ${changed.join(',')}`,
  });
  return NextResponse.json({ ok: true });
}
