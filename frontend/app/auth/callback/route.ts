/**
 * /auth/callback – Supabase email-link handler
 *
 * When a user clicks any Supabase-generated email link (password reset,
 * magic-link, email confirmation), Supabase appends a `code` query
 * parameter. This route exchanges the code for a session, then
 * redirects to the intended destination (e.g. /reset-password).
 */
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (code) {
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
