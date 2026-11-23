import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { getRestockOrders } from '@/app/actions/workflow';
import { getApprovedSuppliers, getProducts } from '@/app/actions/master';
import AppShell from '@/components/AppShell';
import RestockClient from './RestockClient';

export default async function RestockPage({ searchParams }) {
  const session = await getSession();
  if (!session) redirect('/login');
  const params = await searchParams;
  const suggestedProductId = params?.productId || '';

  const [orders, suppliers, products] = await Promise.all([
    getRestockOrders(),
    session.role === 'warehouse_manager' ? getApprovedSuppliers() : Promise.resolve([]),
    session.role === 'warehouse_manager' ? getProducts() : Promise.resolve([]),
  ]);

  return (
    <AppShell session={session}>
      <RestockClient
        session={session}
        orders={orders}
        suppliers={suppliers}
        products={products}
        suggestedProductId={suggestedProductId}
      />
    </AppShell>
  );
}