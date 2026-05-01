/**
 * /admin – shared shell for the admin section.
 *
 * Wraps every admin route in <AdminGuard>, which redirects non-admins
 * to "/" client-side. Server-side enforcement still lives in the
 * Next.js middleware (matches /admin/* and rejects via the same role
 * check), and the backend endpoints all carry require_roles(["admin"])
 * — so this guard is the third layer rather than the only one.
 *
 * Renders a sticky nav bar with the section links so navigating between
 * Overview / Ingestion / Status doesn't require a full page reload.
 */
'use client';

import { AdminGuard } from '@/lib/auth/admin';
import { Activity, BarChart3, Database, ListChecks } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/admin', label: 'Overview', icon: BarChart3, exact: true },
  { href: '/admin/ingestion', label: 'Ingestion Jobs', icon: ListChecks },
  { href: '/status', label: 'Pipeline Status', icon: Activity },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGuard>
      <div className='min-h-screen bg-gov-cream'>
        <AdminNav />
        {children}
      </div>
    </AdminGuard>
  );
}

function AdminNav() {
  const pathname = usePathname();

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <nav className='sticky top-0 z-30 bg-gov-dark border-b border-gov-forest/40 shadow-md'>
      <div className='max-w-6xl mx-auto px-4 sm:px-6'>
        <div className='flex items-center gap-1 sm:gap-2 overflow-x-auto'>
          <div className='flex items-center gap-2 py-3 pr-4 border-r border-gov-forest/40 mr-2 shrink-0'>
            <Database className='w-4 h-4 text-gov-gold' />
            <span className='text-sm font-semibold text-white whitespace-nowrap'>Admin</span>
          </div>
          {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
            const active = isActive(href, exact);
            return (
              <Link
                key={href}
                href={href}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-gov-gold/20 text-gov-gold font-medium'
                    : 'text-gov-sage/70 hover:text-white hover:bg-gov-forest/40'
                }`}>
                <Icon className='w-4 h-4' />
                {label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
