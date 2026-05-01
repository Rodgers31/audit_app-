/**
 * /admin/users/[userId] — single-user detail with mutation actions.
 *
 * Reads /admin/users/{id}; exposes:
 *  - Role toggles (calls PATCH /admin/users/{id}/roles)
 *  - "Send password reset" (POST /admin/users/{id}/send-reset)
 *  - "Delete user" (DELETE /admin/users/{id}) — gated behind a
 *    type-the-email confirm so it can't fire by accident.
 *
 * Uses ``useAuth`` to detect whether the calling admin is looking
 * at their own row, in which case the destructive actions are
 * disabled (the backend also enforces this; the client guard is
 * just for nicer UX).
 */
'use client';

import { useAuth } from '@/lib/auth/AuthProvider';
import api from '@/lib/api/axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Mail,
  Shield,
  Trash2,
  User as UserIcon,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useState } from 'react';

interface UserDetail {
  id: string;
  email: string | null;
  display_name: string | null;
  roles: string[];
  created_at: string | null;
  last_sign_in_at: string | null;
  email_confirmed: boolean;
  banned_until: string | null;
  app_metadata: Record<string, unknown>;
  user_metadata: Record<string, unknown>;
  updated_at: string | null;
}

const KNOWN_ROLES = ['citizen', 'admin'];

export default function UserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = use(params);
  const { authUser } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const isSelf = authUser?.id === userId;

  const { data, isLoading, error, refetch } = useQuery<UserDetail>({
    queryKey: ['admin', 'user', userId],
    queryFn: async () => (await api.get(`/admin/users/${userId}`)).data,
    staleTime: 15_000,
  });

  const [pendingRoles, setPendingRoles] = useState<string[] | null>(null);
  const effectiveRoles = pendingRoles ?? data?.roles ?? [];
  const dirty =
    pendingRoles !== null && JSON.stringify(pendingRoles) !== JSON.stringify(data?.roles ?? []);

  const saveRoles = useMutation<UserDetail, unknown, string[]>({
    mutationFn: async (roles) =>
      (await api.patch(`/admin/users/${userId}/roles`, { roles })).data,
    onSuccess: (updated) => {
      qc.setQueryData(['admin', 'user', userId], updated);
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      qc.invalidateQueries({ queryKey: ['admin', 'audit-log'] });
      setPendingRoles(null);
    },
  });

  const sendReset = useMutation({
    mutationFn: async () =>
      (await api.post(`/admin/users/${userId}/send-reset`, {})).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'audit-log'] }),
  });

  const deleteUser = useMutation({
    mutationFn: async () => (await api.delete(`/admin/users/${userId}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      qc.invalidateQueries({ queryKey: ['admin', 'audit-log'] });
      router.replace('/admin/users');
    },
  });

  if (isLoading) {
    return (
      <div className='max-w-4xl mx-auto py-32 flex justify-center'>
        <Loader2 className='w-6 h-6 text-gov-sage animate-spin' />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className='max-w-4xl mx-auto px-6 py-16 text-center'>
        <XCircle className='w-10 h-10 text-red-500 mx-auto' />
        <p className='text-red-600 mt-3 text-sm'>User not found or failed to load.</p>
        <Link
          href='/admin/users'
          className='inline-flex items-center gap-1 mt-6 text-sm text-gov-sage hover:text-gov-forest'>
          <ArrowLeft className='w-4 h-4' />
          Back to users
        </Link>
      </div>
    );
  }

  return (
    <div className='max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-5'>
      <Link
        href='/admin/users'
        className='inline-flex items-center gap-1 text-sm text-gov-sage hover:text-gov-forest'>
        <ArrowLeft className='w-4 h-4' />
        Back to users
      </Link>

      {/* ── Header card ── */}
      <div className='bg-white border border-gov-sage/20 rounded-xl p-6 shadow-sm'>
        <div className='flex items-start gap-4'>
          <div className='w-14 h-14 rounded-full bg-gov-sage/15 flex items-center justify-center shrink-0'>
            {data.roles.includes('admin') ? (
              <Shield className='w-7 h-7 text-gov-sage' />
            ) : (
              <UserIcon className='w-7 h-7 text-gov-forest/50' />
            )}
          </div>
          <div className='flex-1 min-w-0'>
            <h1 className='text-xl font-bold text-gov-dark'>
              {data.display_name ?? data.email ?? 'Unknown user'}
            </h1>
            <p className='text-sm text-gov-forest/70'>{data.email ?? '—'}</p>
            <p className='text-xs text-gov-forest/40 font-mono mt-1'>{data.id}</p>
            {isSelf && (
              <p className='inline-flex items-center gap-1 mt-2 text-[10px] uppercase tracking-wide font-semibold bg-gov-gold/20 text-gov-forest px-2 py-0.5 rounded-full'>
                This is you
              </p>
            )}
          </div>
        </div>

        <div className='grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gov-sage/10'>
          <Field label='Account created' value={formatDate(data.created_at)} />
          <Field label='Last sign-in' value={formatDate(data.last_sign_in_at)} />
          <Field
            label='Email verified'
            value={data.email_confirmed ? 'Yes' : 'No'}
            tone={data.email_confirmed ? 'ok' : 'warn'}
          />
          <Field
            label='Banned until'
            value={data.banned_until ? formatDate(data.banned_until) : '—'}
            tone={data.banned_until ? 'bad' : 'muted'}
          />
        </div>
      </div>

      {/* ── Roles ── */}
      <section className='bg-white border border-gov-sage/20 rounded-xl p-5 shadow-sm'>
        <header className='flex items-center justify-between mb-4'>
          <h2 className='text-sm font-semibold text-gov-dark'>Roles</h2>
          {dirty && (
            <div className='flex items-center gap-2'>
              <button
                onClick={() => setPendingRoles(null)}
                className='text-xs text-gov-forest/60 hover:text-gov-forest'>
                Cancel
              </button>
              <button
                onClick={() => saveRoles.mutate(pendingRoles!)}
                disabled={saveRoles.isPending}
                className='inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-md bg-gov-sage text-white hover:bg-gov-sage/90 disabled:opacity-50'>
                {saveRoles.isPending ? (
                  <Loader2 className='w-3 h-3 animate-spin' />
                ) : (
                  <CheckCircle2 className='w-3 h-3' />
                )}
                Save changes
              </button>
            </div>
          )}
        </header>
        <div className='flex flex-wrap gap-2'>
          {KNOWN_ROLES.map((role) => {
            const has = effectiveRoles.includes(role);
            return (
              <button
                key={role}
                onClick={() => {
                  const base = pendingRoles ?? data.roles;
                  setPendingRoles(has ? base.filter((r) => r !== role) : [...base, role]);
                }}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  has
                    ? 'bg-gov-sage/20 text-gov-forest border border-gov-sage/30'
                    : 'bg-white text-gov-forest/60 border border-gov-sage/20 hover:border-gov-sage/40'
                }`}>
                {has && <CheckCircle2 className='w-3 h-3' />}
                {role}
              </button>
            );
          })}
        </div>
        {saveRoles.isError && (
          <p className='text-xs text-red-600 mt-3'>
            <AlertTriangle className='inline w-3 h-3 mr-1' />
            {(saveRoles.error as { response?: { data?: { detail?: string } } })?.response?.data
              ?.detail || 'Failed to update roles.'}
          </p>
        )}
      </section>

      {/* ── Actions ── */}
      <section className='bg-white border border-gov-sage/20 rounded-xl p-5 shadow-sm space-y-4'>
        <h2 className='text-sm font-semibold text-gov-dark'>Actions</h2>

        {/* Send reset */}
        <ActionRow
          icon={Mail}
          title='Send password-reset email'
          description="Triggers Supabase's recovery email so the user can set a new password themselves."
          button={
            <button
              onClick={() => sendReset.mutate()}
              disabled={sendReset.isPending || !data.email}
              className='inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-md border border-gov-sage/30 hover:border-gov-sage text-gov-forest disabled:opacity-50'>
              {sendReset.isPending ? <Loader2 className='w-3 h-3 animate-spin' /> : 'Send'}
            </button>
          }
          status={
            sendReset.isSuccess ? (
              <p className='text-xs text-emerald-700 inline-flex items-center gap-1'>
                <CheckCircle2 className='w-3 h-3' />
                Email queued.
              </p>
            ) : sendReset.isError ? (
              <p className='text-xs text-red-700 inline-flex items-center gap-1'>
                <AlertTriangle className='w-3 h-3' />
                Failed to send.
              </p>
            ) : null
          }
        />

        {/* Delete (with confirm) */}
        <DeleteAction
          email={data.email ?? ''}
          isSelf={isSelf}
          isPending={deleteUser.isPending}
          isError={deleteUser.isError}
          errorMessage={
            (deleteUser.error as { response?: { data?: { detail?: string } } })?.response?.data
              ?.detail
          }
          onConfirm={() => deleteUser.mutate()}
        />
      </section>

      {/* ── Raw metadata (collapsed by default) ── */}
      <details className='bg-white border border-gov-sage/20 rounded-xl shadow-sm'>
        <summary className='cursor-pointer px-5 py-3 text-sm font-semibold text-gov-dark'>
          Raw Supabase metadata
        </summary>
        <div className='px-5 pb-5 grid grid-cols-1 md:grid-cols-2 gap-4'>
          <div>
            <p className='text-[10px] uppercase tracking-wide text-gov-forest/60 font-semibold mb-1'>
              app_metadata
            </p>
            <pre className='text-xs font-mono bg-gov-cream/50 border border-gov-sage/10 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all text-gov-dark'>
              {JSON.stringify(data.app_metadata, null, 2)}
            </pre>
          </div>
          <div>
            <p className='text-[10px] uppercase tracking-wide text-gov-forest/60 font-semibold mb-1'>
              user_metadata
            </p>
            <pre className='text-xs font-mono bg-gov-cream/50 border border-gov-sage/10 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all text-gov-dark'>
              {JSON.stringify(data.user_metadata, null, 2)}
            </pre>
          </div>
        </div>
      </details>
    </div>
  );
}

function Field({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'ok' | 'bad' | 'warn' | 'muted' | 'default';
}) {
  const colour = {
    ok: 'text-emerald-600',
    bad: 'text-red-600',
    warn: 'text-amber-600',
    muted: 'text-gov-forest/50',
    default: 'text-gov-dark',
  }[tone];
  return (
    <div>
      <p className='text-[10px] uppercase tracking-wide text-gov-forest/60 font-semibold'>
        {label}
      </p>
      <p className={`text-sm font-medium mt-0.5 ${colour}`}>{value}</p>
    </div>
  );
}

function ActionRow({
  icon: Icon,
  title,
  description,
  button,
  status,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  button: React.ReactNode;
  status?: React.ReactNode;
}) {
  return (
    <div className='flex items-start gap-3'>
      <Icon className='w-4 h-4 text-gov-sage mt-1 shrink-0' />
      <div className='flex-1'>
        <p className='text-sm font-medium text-gov-dark'>{title}</p>
        <p className='text-xs text-gov-forest/60 mt-0.5'>{description}</p>
        {status && <div className='mt-1'>{status}</div>}
      </div>
      <div className='shrink-0'>{button}</div>
    </div>
  );
}

function DeleteAction({
  email,
  isSelf,
  isPending,
  isError,
  errorMessage,
  onConfirm,
}: {
  email: string;
  isSelf: boolean;
  isPending: boolean;
  isError: boolean;
  errorMessage?: string;
  onConfirm: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const canConfirm = !isSelf && typed === email && email.length > 0;

  return (
    <div className='border-t border-gov-sage/10 pt-4'>
      <div className='flex items-start gap-3'>
        <Trash2 className='w-4 h-4 text-red-600 mt-1 shrink-0' />
        <div className='flex-1'>
          <p className='text-sm font-medium text-gov-dark'>Delete user</p>
          <p className='text-xs text-gov-forest/60 mt-0.5'>
            Permanently removes the user from Supabase and cascades their profile row. This
            cannot be undone.
          </p>
          {isSelf && (
            <p className='text-xs text-amber-700 mt-1 inline-flex items-center gap-1'>
              <AlertTriangle className='w-3 h-3' />
              You can&apos;t delete your own account.
            </p>
          )}
          {open && !isSelf && (
            <div className='mt-3 space-y-2'>
              <p className='text-xs text-gov-forest/70'>
                Type <span className='font-mono font-medium text-gov-dark'>{email}</span> to
                confirm:
              </p>
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={email}
                className='w-full max-w-sm px-3 py-1.5 text-sm rounded-lg border border-red-300 focus:outline-none focus:ring-2 focus:ring-red-300 bg-red-50/40 font-mono'
                autoFocus
              />
              <div className='flex items-center gap-2'>
                <button
                  onClick={() => {
                    setOpen(false);
                    setTyped('');
                  }}
                  className='text-xs text-gov-forest/60 hover:text-gov-forest'>
                  Cancel
                </button>
                <button
                  onClick={onConfirm}
                  disabled={!canConfirm || isPending}
                  className='inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed'>
                  {isPending ? <Loader2 className='w-3 h-3 animate-spin' /> : <Trash2 className='w-3 h-3' />}
                  Delete permanently
                </button>
              </div>
              {isError && (
                <p className='text-xs text-red-700 inline-flex items-center gap-1'>
                  <AlertTriangle className='w-3 h-3' />
                  {errorMessage || 'Delete failed.'}
                </p>
              )}
            </div>
          )}
        </div>
        {!open && !isSelf && (
          <button
            onClick={() => setOpen(true)}
            className='shrink-0 inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-md border border-red-300 text-red-700 hover:bg-red-50'>
            <Trash2 className='w-3 h-3' />
            Delete…
          </button>
        )}
      </div>
    </div>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return 'never';
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
