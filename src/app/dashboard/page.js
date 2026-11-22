import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { getDashboardData } from '@/app/actions/workflow';
import AppShell from '@/components/AppShell';
import DashboardClient from './DashboardClient';

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  if (session.role === 'supplier' && session.status !== 'approved') {
    redirect('/login');
  }

  const data = await getDashboardData();
  if (!data) redirect('/login');

  return (
    <AppShell session={session}>
      <DashboardClient session={session} data={data} />
    </AppShell>
  );
}
