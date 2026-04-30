/**
 * /auth/callback – Supabase email-link handler
 *
 * When a user clicks any Supabase-generated email link (password reset,
 * magic-link, email confirmation), Supabase appends a `code` query
 * parameter. This route normally exchanges the code for a session, then
 * redirects to the intended destination.
 *
 * Special case: password recovery
 * -------------------------------
 * For the password-reset flow (``next=/reset-password``) we deliberately
 * DO NOT exchange the code here. Exchanging would write Supabase auth
 * cookies and the user would land on /reset-password already logged in
 * — which is what produced the "click email link, get auto-logged-in"
 * behaviour the user flagged on PR #95, and is the underlying source of
 * the duplicate ``PUT /auth/v1/user`` lock contention (the SDK's
 * ``_autoRefreshTokenTick`` starts running the moment a session exists).
 *
 * Instead, we forward the code to /reset-password as a query param.
 * The page itself never logs the user in: when they submit the form,
 * a server-side route (``/api/auth/reset-password``) does the exchange,
 * the password update, and the sign-out atomically with a read-only
 * cookie adapter, so no auth cookies ever reach the browser. The user
 * stays unauthenticated end-to-end and has to log in afterwards with
 * their new password.
 *
 * Other flows (email confirmation, magic-link sign-in) keep the
 * existing exchange-and-redirect behaviour because they DO want a
 * session to be established.
 */
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (code) {
    // Recovery flow: forward the code without creating a session.
    // The reset-password page will POST it to /api/auth/reset-password
    // along with the new password, and that endpoint does the exchange
    // server-side without leaking cookies back to the browser.
    if (next === '/reset-password') {
      return NextResponse.redirect(
        `${origin}/reset-password?code=${encodeURIComponent(code)}`
      );
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Successfully exchanged — redirect to the intended page
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // If code is missing or exchange failed, send user to an error page
  return NextResponse.redirect(
    `${origin}/reset-password?error=${encodeURIComponent(
      'The reset link is invalid or has expired. Please request a new one.'
    )}`
  );
}
