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
 * DO NOT exchange the code here, AND we also clear any pre-existing
 * session cookies the browser already has. There are two distinct ways
 * a user can end up looking signed-in on /reset-password, and both
 * needed to be handled:
 *
 *   1. ``exchangeCodeForSession`` would create a fresh session for THIS
 *      click. We skip that — the code is forwarded to the page as a
 *      query param and only exchanged server-side at form-submit time
 *      (see /api/auth/reset-password/route.ts), with a read-only cookie
 *      adapter so even that exchange leaks no cookies to the browser.
 *
 *   2. The user might already be signed in from an unrelated prior
 *      login on this device — e.g. they logged in last week, never
 *      signed out, and now click a reset link. ``getSession()`` in
 *      AuthProvider would happily restore that session from cookies
 *      and the page would render as if they're signed in.
 *
 * Why we clear cookies manually instead of calling ``signOut()``
 * --------------------------------------------------------------
 * An earlier version of this handler called ``supabase.auth.signOut()``
 * to clear (1)'s session. In theory the SDK's ``signOut`` only removes
 * the ``sb-<ref>-auth-token`` cookie via its ``-auth-token`` storage
 * key, leaving the ``-code-verifier`` cookie alone. In practice users
 * reported ``AuthPKCECodeVerifierMissingError`` on the next form
 * submit — somehow the verifier was being lost between this handler
 * and /api/auth/reset-password.
 *
 * Rather than chase that side effect through the SSR/auth-js cookie
 * abstraction, we now clear cookies directly with a regex tight
 * enough to match ONLY the session cookies:
 *
 *     /-auth-token(\.\d+)?$/
 *
 * This matches ``sb-<ref>-auth-token`` and any chunked variants like
 * ``sb-<ref>-auth-token.0``, ``sb-<ref>-auth-token.1``, … but does
 * NOT match ``sb-<ref>-auth-token-code-verifier`` (which ends in
 * ``-code-verifier``, not ``-auth-token`` or ``-auth-token.<n>``).
 * The verifier survives, the form-submit exchange can find it, and
 * the user lands on the page unauthenticated.
 *
 * Other flows (email confirmation, magic-link sign-in) keep the
 * existing exchange-and-redirect behaviour because they DO want a
 * session to be established.
 */
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';

// Matches ``sb-<anything>-auth-token`` and chunked variants
// ``sb-<anything>-auth-token.0`` / ``.1`` / ... but explicitly NOT
// ``sb-<anything>-auth-token-code-verifier``. See the file-level
// comment for why this distinction matters.
const SESSION_COOKIE_TAIL = /-auth-token(\.\d+)?$/;

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  // Server log so anyone running ``npm run dev`` can verify which
  // branch this handler took. The "stuck on the old behaviour"
  // reports we kept getting were almost always "the dev server is
  // serving stale code"; this log makes that immediately obvious.
  // eslint-disable-next-line no-console
  console.log(
    `[auth/callback] hit — code=${code ? 'present' : 'missing'} next=${next}`
  );

  if (code) {
    // Recovery flow: forward the code without creating a new session,
    // AND clear any pre-existing session-cookie chunks so AuthProvider
    // doesn't restore a stale session on /reset-password mount. The
    // code-verifier cookie is intentionally left alone — the
    // form-submit exchange in /api/auth/reset-password needs it.
    if (next === '/reset-password') {
      const response = NextResponse.redirect(
        `${origin}/reset-password?code=${encodeURIComponent(code)}`
      );

      const cookieStore = await cookies();
      const cleared: string[] = [];
      cookieStore.getAll().forEach(({ name }) => {
        if (name.startsWith('sb-') && SESSION_COOKIE_TAIL.test(name)) {
          // Set with empty value + maxAge 0 to delete. Path must
          // match the path the cookie was originally set with
          // (DEFAULT_COOKIE_OPTIONS in @supabase/ssr uses '/').
          response.cookies.set(name, '', {
            maxAge: 0,
            path: '/',
            sameSite: 'lax',
          });
          cleared.push(name);
        }
      });

      // eslint-disable-next-line no-console
      console.log(
        `[auth/callback] recovery flow: forwarding code, cleared ${cleared.length} session cookie(s)${
          cleared.length ? ' [' + cleared.join(', ') + ']' : ''
        }`
      );
      return response;
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
