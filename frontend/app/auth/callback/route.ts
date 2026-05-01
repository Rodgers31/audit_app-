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
 *      and the page would render as if they're signed in. We fix
 *      this by calling ``signOut()`` here, which clears the auth-token
 *      cookie via the SSR client. The PKCE ``code-verifier`` cookie is
 *      preserved (it's needed by the form-submit exchange), and the
 *      cleared cookies are explicitly attached to the redirect response
 *      so the Set-Cookie headers actually reach the browser.
 *
 * Other flows (email confirmation, magic-link sign-in) keep the
 * existing exchange-and-redirect behaviour because they DO want a
 * session to be established.
 */
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';

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
    // AND clear any pre-existing session so the user lands on the
    // form unauthenticated.
    if (next === '/reset-password') {
      // Build a redirect response up-front so we can mutate its
      // cookies directly. We do this via the SSR client's ``setAll``
      // adapter, which writes to ``response.cookies`` instead of
      // request-scoped ``cookies()`` — that's the reliable way to
      // get Set-Cookie headers attached to a NextResponse.redirect.
      const response = NextResponse.redirect(
        `${origin}/reset-password?code=${encodeURIComponent(code)}`
      );

      const cookieStore = await cookies();
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll: () => cookieStore.getAll(),
            setAll: (cookiesToSet) => {
              cookiesToSet.forEach(({ name, value, options }) => {
                response.cookies.set(name, value, options);
              });
            },
          },
        }
      );

      // Best-effort: signOut hits Supabase's ``DELETE /logout`` to
      // invalidate the session server-side, and clears the
      // auth-token cookie via setAll above. If the user has no
      // active session, this errors silently — that's fine, we
      // just want the cleared-cookie side effect.
      await supabase.auth.signOut().catch((err) => {
        // eslint-disable-next-line no-console
        console.warn('[auth/callback] recovery signOut failed', err);
      });

      // eslint-disable-next-line no-console
      console.log(
        '[auth/callback] recovery flow: cleared session, forwarding code to /reset-password'
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
