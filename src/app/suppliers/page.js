import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { getSuppliers } from '@/app/actions/master';
import AppShell from '@/components/AppShell';
import SupplierClient from './SupplierClient';

export default async function SuppliersPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'admin') redirect('/dashboard');

  const suppliers = await getSuppliers();

  return (
    <AppShell session={session}>
      <SupplierClient suppliers={suppliers} />
    </AppShell>
  );
}
