import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { getCategories } from '@/app/actions/master';
import AppShell from '@/components/AppShell';
import CategoryClient from './CategoryClient';

export default async function CategoriesPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!['admin', 'warehouse_manager'].includes(session.role)) redirect('/dashboard');

  const categories = await getCategories();

  return (
    <AppShell session={session}>
      <CategoryClient categories={categories} />
    </AppShell>
  );
}
