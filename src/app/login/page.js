import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { getTransactions, getAvailableReceivedPOs } from '@/app/actions/workflow';
import { getApprovedSuppliers, getProducts } from '@/app/actions/master';
import AppShell from '@/components/AppShell';
import TransactionClient from './TransactionClient';

function queryValue(value, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

export default async function TransactionsPage({ searchParams }) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role === 'supplier') redirect('/dashboard');
  const params = await searchParams;
  const filters = {
    type: queryValue(params?.type),
    status: queryValue(params?.status),
    dateFrom: queryValue(params?.dateFrom),
    dateTo: queryValue(params?.dateTo),
    party: queryValue(params?.party),
    sortBy: queryValue(params?.sortBy, 'date_desc'),
  };

  const [transactions, suppliers, products, receivedPOs] = await Promise.all([
    getTransactions(filters),
    session.role === 'staff_gudang' ? getApprovedSuppliers() : Promise.resolve([]),
    session.role === 'staff_gudang' ? getProducts() : Promise.resolve([]),
    session.role === 'staff_gudang' ? getAvailableReceivedPOs() : Promise.resolve([]),
  ]);

  return (
    <AppShell session={session}>
      <TransactionClient
        session={session}
        transactions={transactions}
        suppliers={suppliers}
        products={products}
        receivedPOs={receivedPOs}
        filters={filters}
      />
    </AppShell>
  );
}
