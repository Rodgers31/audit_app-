'use client';

import AccountDashboard from '@/components/account/AccountDashboard';
import PageShell from '@/components/layout/PageShell';
import { useAuth } from '@/lib/auth/AuthProvider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AccountPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  // Redirect unauthenticated users to home
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <PageShell title='Account'>
        <div className='flex items-center justify-center py-32'>
          <div className='w-8 h-8 border-3 border-gov-sage/30 border-t-gov-sage rounded-full animate-spin' />
        </div>
      </PageShell>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <PageShell title='My Account' subtitle='Manage your watchlist, alerts, and preferences'>
      <AccountDashboard />
    </PageShell>
  );
}
