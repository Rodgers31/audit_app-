/**
 * POST /api/auth/reset-password
 *
 * Atomic password-reset endpoint that intentionally avoids ever
 * persisting a session in the user's browser. Inputs:
 *
 *   { code: string, password: string }
 *
 * where ``code`` is the PKCE code Supabase forwarded to /auth/callback
 * (passed through to /reset-password as a query param without being
 * exchanged — see app/auth/callback/route.ts for that decision).
 *
 * Why it lives here instead of being done client-side
 * ---------------------------------------------------
 * Doing the exchange + updateUser on the client (via the @supabase/ssr
 * browser client) writes session cookies the moment the exchange
 * succeeds, which:
 *
 *   1. Logs the user into the app while they're mid-reset (the
 *      "click email link, find myself signed in" UX surprise the
 *      user flagged on PR #95 and again afterwards).
 *   2. Starts the GoTrueClient's ``_autoRefreshTokenTick`` running on
 *      a 30s interval, fighting ``updateUser`` for the gotrue Web
 *      Lock — the actual cause of the duplicate ``PUT /auth/v1/user``
 *      → ``code: same_password`` error we've been chasing across
 *      PRs #87, #92, #93, #94, #95.
 *
 * The fix is to do the whole exchange→update→signOut sequence on the
 * server with a custom cookie adapter that READS the request's
 * ``sb-...-code-verifier`` cookie (set by the browser when it called
 * ``resetPasswordForEmail``) but DOES NOT write anything back. The
 * Supabase server client thinks it's setting cookies; we silently drop
 * them. So no session cookie ever reaches the browser, the auto-refresh
 * tick never starts, and the user ends the flow unauthenticated and is
 * prompted to sign in fresh with their new password.
 */
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  let body: { code?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const code = typeof body.code === 'string' ? body.code : null;
  const password = typeof body.password === 'string' ? body.password : null;

  if (!code) {
    return NextResponse.json(
      { error: 'Missing or invalid reset code. Please request a new reset link.' },
      { status: 400 }
    );
  }
  if (!password || password.length < 8) {
    return NextResponse.json(
      { error: 'Password must be at least 8 characters.' },
      { status: 400 }
    );
  }

  const cookieStore = await cookies();

  // Diagnostic: log cookie names received so a future
  // ``AuthPKCECodeVerifierMissingError`` is debuggable from the dev
  // server log without re-instrumenting. Values are deliberately not
  // logged (verifier is sensitive). Names alone tell us whether the
  // browser sent the verifier cookie with this request.
  const cookieNames = cookieStore.getAll().map((c) => c.name);
  // eslint-disable-next-line no-console
  console.log(
    `[api/auth/reset-password] received ${cookieNames.length} cookie(s)`,
    cookieNames.filter((n) => n.startsWith('sb-'))
  );

  // Read-only cookie adapter. ``getAll`` lets the SDK read the
  // ``sb-...-code-verifier`` cookie it needs to validate the PKCE
  // code; ``setAll`` is intentionally a no-op so any session cookies
  // the SDK tries to write during the exchange are silently dropped.
  // Net effect: the server can complete the exchange and updateUser,
  // but the browser's cookie jar is never touched.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {
          // intentional no-op: see file-level comment about why we
          // refuse to write any auth cookies to the response.
        },
      },
    }
  );

  // 1. Exchange the recovery code for an in-memory session.
  const { data: exchangeData, error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError || !exchangeData.session) {
    return NextResponse.json(
      {
        error:
          exchangeError?.message ??
          'The reset link is invalid or has expired. Please request a new one.',
      },
      { status: 400 }
    );
  }

  // 2. Update the password using the in-memory session.
  const { error: updateError } = await supabase.auth.updateUser({ password });

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message ?? 'Failed to update password.' },
      { status: 400 }
    );
  }

  // 3. Sign out for tidiness — invalidates the just-issued refresh
  // token server-side. No-op for the browser since we never wrote
  // any cookies, but it keeps the Supabase auth state clean.
  await supabase.auth.signOut().catch(() => {
    /* best-effort cleanup; the password update already succeeded */
  });

  return NextResponse.json({ ok: true });
}
