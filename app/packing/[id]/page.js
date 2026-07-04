import { notFound, redirect } from 'next/navigation';
import { getPackingDetail } from '@/lib/data';
import { getSessionUser, isCustomer, canAccessDepartment, roleHome } from '@/lib/auth';
import PackingDetail from '@/components/PackingDetail';

export const dynamic = 'force-dynamic';

export default async function PackingPage({ params }) {
  const user = getSessionUser();
  const data = await getPackingDetail(params.id);
  if (!data) notFound();

  const canEdit = canAccessDepartment(user, 'Dispatch'); // PM or a Dispatch functional head

  if (isCustomer(user)) {
    // A customer may only see their own order's list, and only once it's past draft (≥ Ready).
    if (String(data.list.project_id) !== String(user.project_id) || data.list.status === 'draft') {
      redirect(roleHome(user));
    }
  } else if (!canEdit) {
    // Internal users without Dispatch access have no business on the packing board.
    redirect('/');
  }

  return <PackingDetail list={data.list} items={data.items} readOnly={!canEdit} />;
}
