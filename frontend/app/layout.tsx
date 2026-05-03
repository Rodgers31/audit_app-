import Footer from '@/components/Footer';
import Navigation from '@/components/Navigation';
import { AuthProvider } from '@/lib/auth/AuthProvider';
import { WatchlistProvider } from '@/lib/auth/WatchlistProvider';
import { LangProvider } from '@/lib/i18n/LangProvider';
import NavTrailTracker from '@/lib/navigation/NavTrailTracker';
import { QueryProvider } from '@/lib/react-query/QueryProvider';
import { Suspense } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'AuditGava — Kenya Public Money Tracker',
    template: '%s | AuditGava',
  },
  description: 'Where your taxes go, in real time — Government Financial Transparency Dashboard',
  keywords: [
    'government',
    'transparency',
    'audit',
    'kenya',
    'budget',
    'spending',
    'national debt',
    'county finances',
  ],
  metadataBase: new URL('https://auditgava.com'),
  openGraph: {
    title: 'AuditGava — Kenya Public Money Tracker',
    description:
      "Track Kenya's national debt, county budgets, and government spending in real time.",
    url: 'https://auditgava.com',
    siteName: 'AuditGava',
    images: [
      {
        url: '/og-image.png',
        width: 1536,
        height: 1024,
        alt: 'AuditGava — Kenya Public Money Tracker',
      },
    ],
    locale: 'en_KE',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AuditGava — Kenya Public Money Tracker',
    description:
      "Track Kenya's national debt, county budgets, and government spending in real time.",
    images: ['/og-image.png'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Derive API origin once so preconnect/dns-prefetch can warm the TCP + TLS
  // handshake before the first React Query fetch fires on the client.
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
  let apiOrigin = '';
  try {
    if (apiUrl) apiOrigin = new URL(apiUrl).origin;
  } catch {
    // Swallow URL parse errors — falls back to no preconnect.
  }
  return (
    <html lang='en' suppressHydrationWarning>
      <head>
        {apiOrigin && (
          <>
            <link rel='preconnect' href={apiOrigin} crossOrigin='anonymous' />
            <link rel='dns-prefetch' href={apiOrigin} />
          </>
        )}
        {/* Above-the-fold LCP image — preload so it begins downloading
            in parallel with the CSS / JS chunks. The ``media`` attribute
            ensures only the variant matching the user's current colour
            scheme is downloaded — no double-fetch on dark-mode systems. */}
        <link
          rel='preload'
          as='image'
          href='/kenya_bg_top.jpg'
          media='(prefers-color-scheme: light)'
        />
        <link
          rel='preload'
          as='image'
          href='/kenya_bg_top_dk.jpg'
          media='(prefers-color-scheme: dark)'
        />
      </head>
      <body
        className='bg-gov-sand dark:bg-[#0a1410] antialiased'
        suppressHydrationWarning>
        {/* Skip-to-main link. Sighted users never see this (sr-only
            until focused); keyboard users can jump past the fixed
            header in one Tab press. Lands on #main-content which
            PageShell and the home dashboard mark up. */}
        <a
          href='#main-content'
          className='sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:bg-gov-forest focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-white'>
          Skip to main content
        </a>
        <QueryProvider>
          <LangProvider>
            <AuthProvider>
              <WatchlistProvider>
                {/* Records every client-side navigation into sessionStorage
                    so "back" links on detail pages can decide whether
                    to pop history (restoring state) or push a fresh URL. */}
                <Suspense fallback={null}>
                  <NavTrailTracker />
                </Suspense>
                <Navigation />
                <div id='main-content' className='relative z-[1]'>
                  {children}
                </div>
                <Footer />
              </WatchlistProvider>
            </AuthProvider>
          </LangProvider>
        </QueryProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
