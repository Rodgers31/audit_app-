/**
 * getBaseUrl – returns the base URL for the current environment.
 *
 * Resolution order:
 *   1. window.location.origin  (client-side — always matches the domain
 *      the user is on, critical for multi-domain setups)
 *   2. NEXT_PUBLIC_SITE_URL    (server-side explicit override)
 *   3. NEXT_PUBLIC_VERCEL_URL  (auto-set by Vercel)
 *   4. http://localhost:3000   (server-side fallback)
 *
 * This is critical for Supabase auth redirect URLs — Supabase validates
 * the `redirect_to` parameter against the project's Redirect URL allowlist.
 * If the URL isn't in the allowlist, Supabase silently falls back to the
 * Site URL setting (which may be localhost).
 *
 * Multi-domain support: because all auth functions (resetPassword, signUp,
 * changeEmail) run client-side, window.location.origin is always available
 * and automatically resolves to whichever domain the user is currently on.
 */
export function getBaseUrl(): string {
  // Client-side: always use the browser origin so redirect URLs
  // match the domain the user is actually on (works with multiple domains)
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  // Server-side: explicit production URL
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, '');
  }

  // Vercel auto-injects this for preview and production deployments
  if (process.env.NEXT_PUBLIC_VERCEL_URL) {
    return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`;
  }

  // Server-side fallback (local dev)
  return 'http://localhost:3000';
}
