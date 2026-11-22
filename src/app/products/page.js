import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { getProducts, getCategories } from '@/app/actions/master';
import AppShell from '@/components/AppShell';
import ProductClient from './ProductClient';

export default async function ProductsPage({ searchParams }) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role === 'supplier') redirect('/dashboard');

  const sp = await searchParams;
  const filters = {
    search: sp?.search || '',
    categoryId: sp?.categoryId || '',
    stockStatus: sp?.stockStatus || '',
    sortBy: sp?.sortBy || 'created_at',
  };

  const [products, categories] = await Promise.all([
    getProducts(filters),
    getCategories(),
  ]);

  return (
    <AppShell session={session}>
      <ProductClient
        session={session}
        products={products}
        categories={categories}
        filters={filters}
      />
    </AppShell>
  );
}
