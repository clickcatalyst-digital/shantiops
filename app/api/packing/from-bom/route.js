import { NextResponse } from 'next/server';
import { execute, queryAll, queryOne, nextNumber } from '@/lib/db';
import { getSessionUser, requireDepartment } from '@/lib/auth';
import { getProjectBom } from '@/lib/data';

// Auto-generate a DRAFT packing list from a project's still-pending BOM lines. Prefills
// material_description / moc / size_spec from each BOM row; leaves IBR No / Item Code / Box / Qty /
// Make blank for the Dispatch head to fill. Only pending lines are pulled (handles partial dispatch).
export async function POST(req) {
  const user = getSessionUser();
  const denied = requireDepartment(user, 'Dispatch');
  if (denied) return denied;

  const { project_id } = await req.json();
  if (!project_id) return NextResponse.json({ error: 'project_id is required' }, { status: 400 });

  const project = await queryOne('SELECT * FROM projects WHERE id = ?', [project_id]);
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const { pending } = await getProjectBom(project_id);
  if (!pending.length) return NextResponse.json({ error: 'No pending BOM lines to pack' }, { status: 400 });

  const packing_no = await nextNumber('packing_no', 'PL');
  const pl = await execute(
    'INSERT INTO packing_lists (project_id, packing_no, customer_name, created_by) VALUES (?, ?, ?, ?)',
    [project_id, packing_no, project.customer_name, user?.username || null]
  );
  const listId = Number(pl.lastId);

  let s = 1;
  for (const b of pending) {
    await execute(
      `INSERT INTO packing_items (packing_list_id, bom_item_id, s_no, material_description, moc, size_spec, qty, unit)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [listId, b.id, s++, b.material_description, b.moc || null, b.size_spec || null, 1, "No's"]
    );
  }
  return NextResponse.json({ id: listId, packing_no, items: pending.length });
}
