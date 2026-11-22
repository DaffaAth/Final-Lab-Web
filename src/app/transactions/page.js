import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { getTransactions, getAvailableReceivedPOs } from '@/app/actions/workflow';
import { getApprovedSuppliers, getProducts } from '@/app/actions/master';
import AppShell from '@/components/AppShell';
import TransactionClient from './TransactionClient';

export default async function TransactionsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role === 'supplier') redirect('/dashboard');

  const [transactions, suppliers, products, receivedPOs] = await Promise.all([
    getTransactions(),
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
      />
    </AppShell>
  );
}
