/**
 * /admin/users — list + search users.
 *
 * Reads /admin/users (server-side combines Supabase auth.users with
 * the profiles table). Search is a substring match on email; the
 * input syncs to the URL ``?q=`` so the page is shareable.
 */
'use client';

import api from '@/lib/api/axios';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  Loader2,
  Pause,
  RefreshCcw,
  Search,
  Shield,
  User,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';

interface UserSummary {
  id: string;
  email: string | null;
  display_name: string | null;
  roles: string[];
  created_at: string | null;
  last_sign_in_at: string | null;
  email_confirmed: boolean;
  banned_until: string | null;
}

interface UserList {
  users: UserSummary[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

const PAGE_SIZE = 20;

export default function UsersListPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <UsersListInner />
    </Suspense>
  );
}

function UsersListInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const q = searchParams.get('q') ?? '';
  const page = Number(searchParams.get('page') ?? '1');

  const [searchInput, setSearchInput] = useState(q);
  // Debounce: only sync the URL after the user pauses typing for 300ms.
  useEffect(() => {
    const t = setTimeout(() => {
      if (searchInput !== q) {
        const next = new URLSearchParams(searchParams);
        if (searchInput) next.set('q', searchInput);
        else next.delete('q');
        next.delete('page');
        router.replace(`/admin/users${next.size ? '?' + next.toString() : ''}`);
      }
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const setPage = useCallback(
    (p: number) => {
      const next = new URLSearchParams(searchParams);
      next.set('page', String(p));
      router.replace(`/admin/users?${next.toString()}`);
    },
    [router, searchParams]
  );

  const { data, isLoading, error, refetch, isFetching } = useQuery<UserList>({
    queryKey: ['admin', 'users', { q, page }],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, page_size: PAGE_SIZE };
      if (q) params.q = q;
      return (await api.get('/admin/users', { params })).data;
    },
    staleTime: 15_000,
  });

  return (
    <div className='max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-5'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <Link
            href='/admin'
            className='inline-flex items-center gap-1 text-xs text-gov-sage hover:text-gov-forest mb-1'>
            <ArrowLeft className='w-3 h-3' />
            Back to overview
          </Link>
          <h1 className='text-2xl sm:text-3xl font-bold text-gov-dark'>Users</h1>
          <p className='text-gov-forest/60 text-sm mt-1'>
            Manage roles, send password resets, and remove users.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className='inline-flex items-center gap-2 px-3 py-2 bg-white border border-gov-sage/30 hover:border-gov-sage text-gov-forest rounded-lg text-sm transition-colors disabled:opacity-50'>
          <RefreshCcw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Search */}
      <div className='bg-white border border-gov-sage/20 rounded-xl p-4 shadow-sm'>
        <div className='relative'>
          <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gov-forest/40' />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder='Search by email…'
            className='w-full pl-10 pr-3 py-2 text-sm rounded-lg border border-gov-sage/30 focus:outline-none focus:ring-2 focus:ring-gov-sage/40 bg-gov-cream/30'
          />
        </div>
      </div>

      {/* Body */}
      {isLoading ? (
        <BodyState>
          <Loader2 className='w-6 h-6 text-gov-sage animate-spin' />
          <p className='text-gov-forest/60 text-sm'>Loading users…</p>
        </BodyState>
      ) : error ? (
        <BodyState>
          <XCircle className='w-8 h-8 text-red-500' />
          <p className='text-red-600 text-sm'>Could not load users.</p>
        </BodyState>
      ) : !data || data.users.length === 0 ? (
        <BodyState>
          <Pause className='w-8 h-8 text-gov-forest/30' />
          <p className='text-gov-forest/60 text-sm'>No users match.</p>
        </BodyState>
      ) : (
        <>
          <ul className='bg-white border border-gov-sage/20 rounded-xl divide-y divide-gov-sage/10 shadow-sm overflow-hidden'>
            {data.users.map((u) => (
              <li key={u.id}>
                <Link
                  href={`/admin/users/${u.id}`}
                  className='flex items-center gap-4 px-5 py-4 hover:bg-gov-cream/50 transition-colors'>
                  <div className='w-10 h-10 rounded-full bg-gov-sage/15 flex items-center justify-center shrink-0'>
                    {u.roles.includes('admin') ? (
                      <Shield className='w-5 h-5 text-gov-sage' />
                    ) : (
                      <User className='w-5 h-5 text-gov-forest/50' />
                    )}
                  </div>
                  <div className='flex-1 min-w-0'>
                    <div className='flex items-center gap-2 flex-wrap'>
                      <span className='font-medium text-gov-dark text-sm truncate'>
                        {u.display_name ?? u.email ?? u.id.slice(0, 8) + '…'}
                      </span>
                      {u.roles.map((role) => (
                        <span
                          key={role}
                          className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] uppercase tracking-wide font-semibold ${
                            role === 'admin'
                              ? 'bg-gov-sage/20 text-gov-forest'
                              : 'bg-gov-cream text-gov-forest/60'
                          }`}>
                          {role}
                        </span>
                      ))}
                      {u.banned_until && (
                        <span className='inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] uppercase tracking-wide font-semibold bg-red-100 text-red-800'>
                          banned
                        </span>
                      )}
                    </div>
                    <p className='text-xs text-gov-forest/60 truncate mt-0.5'>{u.email ?? '—'}</p>
                  </div>
                  <div className='hidden sm:block text-right text-xs text-gov-forest/60'>
                    <p>Created {formatShort(u.created_at)}</p>
                    <p className='mt-0.5'>Last sign-in {formatShort(u.last_sign_in_at)}</p>
                  </div>
                  <ChevronRight className='w-4 h-4 text-gov-forest/30 shrink-0' />
                </Link>
              </li>
            ))}
          </ul>

          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={data.total}
            hasMore={data.has_more}
            onChange={setPage}
          />
        </>
      )}
    </div>
  );
}

function Pagination({
  page,
  pageSize,
  total,
  hasMore,
  onChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
  onChange: (page: number) => void;
}) {
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  return (
    <div className='flex items-center justify-between text-sm'>
      <span className='text-gov-forest/60'>
        Showing <span className='font-medium text-gov-dark'>{start.toLocaleString()}</span>–
        <span className='font-medium text-gov-dark'>{end.toLocaleString()}</span> of{' '}
        <span className='font-medium text-gov-dark'>~{total.toLocaleString()}</span>
      </span>
      <div className='flex items-center gap-2'>
        <button
          onClick={() => onChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className='inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gov-sage/30 hover:border-gov-sage text-gov-forest disabled:opacity-40 disabled:hover:border-gov-sage/30'>
          <ArrowLeft className='w-3.5 h-3.5' />
          Prev
        </button>
        <span className='text-gov-forest/60'>Page {page}</span>
        <button
          onClick={() => onChange(page + 1)}
          disabled={!hasMore}
          className='inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gov-sage/30 hover:border-gov-sage text-gov-forest disabled:opacity-40 disabled:hover:border-gov-sage/30'>
          Next
          <ArrowRight className='w-3.5 h-3.5' />
        </button>
      </div>
    </div>
  );
}

function BodyState({ children }: { children: React.ReactNode }) {
  return (
    <div className='bg-white border border-gov-sage/20 rounded-xl py-16 flex flex-col items-center justify-center gap-3 shadow-sm'>
      {children}
    </div>
  );
}

function PageLoader() {
  return (
    <div className='max-w-6xl mx-auto py-32 flex justify-center'>
      <Loader2 className='w-6 h-6 text-gov-sage animate-spin' />
    </div>
  );
}

function formatShort(iso: string | null): string {
  if (!iso) return 'never';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
