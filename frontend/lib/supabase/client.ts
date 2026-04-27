/**
 * Supabase browser client (true singleton).
 *
 * Use this in Client Components (`'use client'`).
 * It reads the public env vars set in `.env.local`.
 *
 * Why a real singleton — and not "fresh client per call"
 * ------------------------------------------------------
 * The previous implementation returned a NEW ``createBrowserClient``
 * on every ``createClient()`` invocation. With ``@supabase/ssr``, the
 * function returns a brand-new ``GoTrueClient`` each time — every
 * one of those has its own in-memory auth lock, even though they all
 * share the same cookies for session storage. Multiple call sites in
 * the codebase (``AuthProvider``, ``lib/api/auth``, ``lib/api/axios``)
 * each held their own client and lock.
 *
 * That setup reproduces the canonical Supabase lock-contention
 * symptom: when one client does ``updateUser``, another client doing
 * any auth call (e.g. ``getSession`` from the axios request
 * interceptor) acquires the lock with ``steal: true`` and aborts the
 * first call with "Lock broken by another request with the 'steal'
 * option". On password reset this manifested as TWO PUT
 * /auth/v1/user requests — the first preempted, the second hitting
 * the API after the first had already updated the password, so the
 * server (correctly) rejected the duplicate write with
 * ``code: same_password``. Net: user sees a misleading error and
 * the lock-steal trace, even though their password actually
 * changed.
 *
 * Returning a single shared instance keeps every call site on the
 * same lock, so the SDK's own queueing serialises auth ops instead
 * of letting them race.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/ssr';

let client: SupabaseClient | undefined;

export function createClient(): SupabaseClient {
  if (client) return client;
  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  return client;
}
