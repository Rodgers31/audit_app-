'use client';

import { motion } from 'framer-motion';
import { BookOpen, DollarSign, FileText, Home, MapPin, Menu, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navigation() {
  const pathname = usePathname();

  const navItems = [
    {
      href: '/',
      label: 'Dashboard',
      icon: Home,
      description: 'County Overview',
    },
    {
      href: '/debt',
      label: 'National Debt',
      icon: TrendingUp,
      description: 'Financial Overview',
    },
    {
      href: '/budget',
      label: 'Budget & Spending',
      icon: DollarSign,
      description: 'Annual Allocations',
    },
    {
      href: '/counties',
      label: 'County Explorer',
      icon: MapPin,
      description: 'Explore Counties',
    },
    {
      href: '/reports',
      label: 'Audit Reports',
      icon: FileText,
      description: 'Transparency Reports',
    },
    {
      href: '/learn',
      label: 'Learning Hub',
      icon: BookOpen,
      description: 'Learn & Engage',
    },
  ];

  return (
    <motion.nav
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className='bg-white/90 backdrop-blur-lg shadow-lg border-b border-white/20 sticky top-0 z-50'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        <div className='flex items-center justify-between h-16'>
          {/* Logo/Brand */}
          <Link href='/' className='flex items-center space-x-3'>
            <div className='text-2xl'>🇰🇪</div>
            <div>
              <h1 className='text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent'>
                Kenya Audit Dashboard
              </h1>
              <p className='text-xs text-slate-600'>Government Transparency Portal</p>
            </div>
          </Link>

          {/* Navigation Items */}
          <div className='hidden md:flex items-center space-x-1'>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    relative flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200
                    ${
                      isActive
                        ? 'bg-blue-100 text-blue-700 shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }
                  `}>
                  <Icon size={18} />
                  <div className='flex flex-col'>
                    <span className='text-sm font-medium'>{item.label}</span>
                    <span className='text-xs opacity-75'>{item.description}</span>
                  </div>

                  {isActive && (
                    <motion.div
                      layoutId='activeTab'
                      className='absolute inset-0 bg-blue-100 rounded-lg -z-10'
                      transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Mobile menu button */}
          <div className='md:hidden'>
            <button className='text-slate-600 hover:text-slate-900 p-2'>
              <Menu size={20} />
            </button>
          </div>
        </div>
      </div>
    </motion.nav>
  );
}
