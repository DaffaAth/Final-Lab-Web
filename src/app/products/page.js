import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { getPaginatedProducts, getCategories } from '@/app/actions/master';
import AppShell from '@/components/AppShell';
import ProductClient from './ProductClient';

function queryValue(value, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

export default async function ProductsPage({ searchParams }) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role === 'supplier') redirect('/dashboard');

  const sp = await searchParams;
  const filters = {
    search: queryValue(sp?.search),
    categoryId: queryValue(sp?.categoryId),
    stockStatus: queryValue(sp?.stockStatus),
    sortBy: queryValue(sp?.sortBy, 'created_at'),
    page: queryValue(sp?.page, '1'),
  };

  const [productResult, categories] = await Promise.all([
    getPaginatedProducts(filters),
    getCategories(),
  ]);

  return (
    <AppShell session={session}>
      <ProductClient
        session={session}
        products={productResult.products}
        categories={categories}
        filters={filters}
        pagination={productResult}
      />
    </AppShell>
  );
}
