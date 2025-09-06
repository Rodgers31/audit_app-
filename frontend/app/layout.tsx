import Navigation from '@/components/Navigation';
import { QueryProvider } from '@/lib/react-query/QueryProvider';
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Kenya Audit Transparency',
  description: 'Government Financial Transparency and Audit Platform',
  keywords: ['government', 'transparency', 'audit', 'kenya', 'budget', 'spending'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='en'>
      <body>
        <QueryProvider>
          <Navigation />
          {children}
        </QueryProvider>
      </body>
    </html>
  );
}
