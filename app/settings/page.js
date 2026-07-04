import { redirect } from 'next/navigation';
import { getSessionUser, isCustomer, isPM, roleHome } from '@/lib/auth';
import { getFunctionalHeads } from '@/lib/data';
import ChangePasswordForm from '@/components/ChangePasswordForm';
import ProfileForm from '@/components/ProfileForm';
import AccessMatrix from '@/components/AccessMatrix';
import UserManagement from '@/components/UserManagement';
import PageHeader from '@/components/PageHeader';
import { Separator } from '@/components/ui/separator';

export const dynamic = 'force-dynamic';

export default async function Settings() {
  const user = getSessionUser();
  if (isCustomer(user)) redirect(roleHome(user));

  const heads = isPM(user) ? await getFunctionalHeads() : null;

  return (
    <main className="container flex flex-col gap-6 py-8">
      <PageHeader title="Settings" description={`Account settings${isPM(user) ? ' and access management' : ''}`} />

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <ProfileForm user={user} />
        <ChangePasswordForm />
      </div>

      {isPM(user) && (
        <>
          <Separator />
          <h2 className="text-lg font-semibold">Access Management</h2>
          <AccessMatrix heads={heads} />
          <UserManagement heads={heads} />
        </>
      )}
    </main>
  );
}
