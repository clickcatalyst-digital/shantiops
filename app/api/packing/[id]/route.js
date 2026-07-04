import { NextResponse } from 'next/server';
import { execute } from '@/lib/db';
import { getSessionUser, requireDepartment } from '@/lib/auth';

const EDITABLE = ['customer_name', 'customer_address', 'invoice_no', 'invoice_date', 'package_type',
  'dc_no', 'dc_date', 'vehicle_no', 'dispatch_through', 'contact_person', 'status'];

export async function PATCH(req, { params }) {
  const denied = requireDepartment(getSessionUser(), 'Dispatch');
  if (denied) return denied;
  const b = await req.json();
  const sets = [];
  const args = [];
  for (const f of EDITABLE) {
    if (f in b) { sets.push(`${f} = ?`); args.push(b[f] === '' ? null : b[f]); }
  }
  if (!sets.length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  sets.push('updated_at = CURRENT_TIMESTAMP');
  args.push(params.id);
  await execute(`UPDATE packing_lists SET ${sets.join(', ')} WHERE id = ?`, args);
  return NextResponse.json({ ok: true });
}
