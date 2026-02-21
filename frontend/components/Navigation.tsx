'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Grid, Menu, User, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function Navigation() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Handle scroll effect for glassmorphism intensity
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navItems = [
    { href: '/', label: 'Dashboard' },
    { href: '/debt', label: 'National Debt' },
    { href: '/budget', label: 'Budget & Spending' },
    { href: '/counties', label: 'County Explorer' },
  ];

  return (
    <>
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled
            ? 'bg-gov-dark/95 backdrop-blur-xl shadow-[0_1px_12px_rgba(0,0,0,0.25)] py-3'
            : 'bg-transparent py-6'
        }`}>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between'>
          {/* Left: Brand */}
          <Link href='/' className='flex items-center space-x-3 group relative z-50'>
            <div className='w-10 h-10 rounded-full bg-white/10 flex items-center justify-center border border-white/20 backdrop-blur-sm group-hover:bg-white/20 transition-colors relative overflow-hidden shadow-lg'>
              <span className='text-xl relative z-10' suppressHydrationWarning>
                🇰🇪
              </span>
              {/* Shine effect */}
              <div className='absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent translate-y-full group-hover:translate-y-0 transition-transform duration-500' />
            </div>
            <span className='text-white font-bold tracking-tight text-lg drop-shadow-md hidden sm:block'>
              Kenya Public Money
            </span>
          </Link>

          {/* Center: Desktop Navigation */}
          <nav className='hidden md:flex items-center space-x-1 bg-white/5 backdrop-blur-md px-2 py-1.5 rounded-full border border-white/10 shadow-lg'>
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative px-5 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                    isActive ? 'text-gov-dark' : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}>
                  {isActive && (
                    <motion.div
                      layoutId='nav-pill'
                      className='absolute inset-0 bg-gov-sage shadow-sm rounded-full'
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    />
                  )}
                  <span className='relative z-10'>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right: Profile & Menu */}
          <div className='flex items-center space-x-3 md:space-x-4 relative z-50'>
            <button className='p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/80 hover:text-white transition-colors border border-white/10 backdrop-blur-sm hidden sm:flex items-center justify-center group'>
              <Grid className='w-5 h-5 group-hover:rotate-90 transition-transform duration-300' />
            </button>

            <div className='relative group cursor-pointer'>
              <div className='w-10 h-10 rounded-full bg-gradient-to-br from-gov-forest to-gov-dark border-2 border-white/20 flex items-center justify-center shadow-lg overflow-hidden relative transition-transform hover:scale-105 active:scale-95'>
                <User className='w-5 h-5 text-white/90' />
              </div>
              {/* Status Dot */}
              <div className='absolute bottom-0 right-0 w-3 h-3 bg-gov-warning rounded-full border-2 border-gov-dark animate-pulse'></div>
            </div>

            <button
              className='md:hidden p-2 text-white/90 hover:text-white bg-white/10 rounded-full backdrop-blur-md'
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X className='w-6 h-6' /> : <Menu className='w-6 h-6' />}
            </button>
          </div>
        </div>
      </motion.header>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className='fixed inset-0 z-40 bg-gov-dark/98 backdrop-blur-xl pt-24 px-6 md:hidden flex flex-col items-center space-y-8'>
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className='text-2xl font-bold text-white/90 hover:text-gov-warning transition-colors'
                onClick={() => setMobileMenuOpen(false)}>
                {item.label}
              </Link>
            ))}
            <div className='w-16 h-1 bg-white/10 rounded-full mt-8' />
            <div className='text-white/40 text-sm font-medium uppercase tracking-widest'>
              Republic of Kenya
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
