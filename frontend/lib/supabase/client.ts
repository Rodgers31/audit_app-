/**
 * Supabase browser client (singleton).
 *
 * Use this in Client Components (`'use client'`).
 * It reads the public env vars set in `.env.local`.
 *
 * Why we override ``lockAcquireTimeout``
 * --------------------------------------
 * GoTrueClient defaults to 5s for the auth-lock acquisition timeout.
 * On every auth call (``updateUser``, ``getSession``, ``refreshSession``
 * …) the SDK acquires a navigator-LockManager lock. If that timeout
 * fires while another holder is still in flight, the SDK assumes an
 * orphaned lock (e.g. from React Strict Mode's double-mount) and
 * recovers via ``navigator.locks.request(name, { steal: true })``,
 * which forcefully releases the existing lock and runs the operation
 * AGAIN on the new lock holder. See ``locks.js:163-206`` in
 * @supabase/auth-js and supabase/supabase#42505.
 *
 * On real-world password resets the call regularly takes longer than
 * 5s (token rotation + database round-trip + cold-start backend), so
 * the steal-recovery kicks in mid-call and re-fires ``updateUser``.
 * The first attempt actually succeeded — the password is changed —
 * but the duplicate hits the API with the same body, gets back
 * ``code: same_password`` ``message: New password should be
 * different from the old password``, and the user sees a misleading
 * error after their password actually changed. The original lock
 * holder also surfaces "Lock broken by another request with the
 * 'steal' option" in the console.
 *
 * Bump the timeout to 60s so a normal call has plenty of budget. The
 * steal recovery is still in place if a lock is genuinely orphaned
 * (it just won't fire on healthy slow calls). 60s also stays well
 * under any reasonable user-perceived "this is hung, refresh"
 * threshold.
 */
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // ``lockAcquireTimeout`` is a documented option on the
      // underlying GoTrueClient (see
      // node_modules/@supabase/auth-js/dist/module/lib/types.d.ts:119)
      // but ``SupabaseClientOptions['auth']`` in supabase-js re-exports
      // only a subset of those fields and omits this one. The runtime
      // passes auth options straight through to GoTrueClient so the
      // option works fine at runtime; we cast to satisfy the
      // narrower public type. Tracking issue:
      // https://github.com/supabase/supabase-js/issues — Supabase
      // hasn't surfaced this in the public type yet.
      auth: {
        lockAcquireTimeout: 60_000, // 60 seconds (default 5s)
      } as any,
    }
  );
}
