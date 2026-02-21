import Navigation from '@/components/Navigation';
import { QueryProvider } from '@/lib/react-query/QueryProvider';
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Kenya Public Money Tracker',
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
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='en' suppressHydrationWarning>
      <body className='bg-gov-sand antialiased' suppressHydrationWarning>
        <QueryProvider>
          <Navigation />
          <div className='relative z-[1]'>{children}</div>
        </QueryProvider>
      </body>
    </html>
  );
}
