import Footer from '@/components/Footer';
import Navigation from '@/components/Navigation';
import { AuthProvider } from '@/lib/auth/AuthProvider';
import { WatchlistProvider } from '@/lib/auth/WatchlistProvider';
import { QueryProvider } from '@/lib/react-query/QueryProvider';
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
    locale: 'en_KE',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AuditGava — Kenya Public Money Tracker',
    description:
      "Track Kenya's national debt, county budgets, and government spending in real time.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='en' suppressHydrationWarning>
      <body className='bg-gov-sand antialiased' suppressHydrationWarning>
        <QueryProvider>
          <AuthProvider>
            <WatchlistProvider>
              <Navigation />
              <div className='relative z-[1]'>{children}</div>
              <Footer />
            </WatchlistProvider>
          </AuthProvider>
        </QueryProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
