'use client';

import { motion } from 'framer-motion';
import React from 'react';

/**
 * PageShell
 *
 * Consistent page layout for all inner pages (debt, budget, counties, learn).
 * NO top scenic image — only the home page has that.
 * Provides:
 *   - Dark-green header band (matches scrolled nav) with white title text
 *   - Cream gov-sand body
 *   - Translucent glass container for data content
 *   - Bottom scenic (Kenyan flag) image visible when scrolled down
 */

interface PageShellProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}

const NEUTRAL_RGB = '245,240,232'; // gov-sand #F5F0E8

export default function PageShell({ title, subtitle, children, className = '' }: PageShellProps) {
  return (
    <div className='relative min-h-screen' style={{ backgroundColor: `rgb(${NEUTRAL_RGB})` }}>
      {/* ═══ Bottom scenic image (Kenyan flag) — pinned to bottom ═══ */}
      <div
        className='absolute bottom-0 left-0 right-0'
        aria-hidden='true'
        style={{ height: '45vh', zIndex: 0 }}>
        <img
          src='/kenya_bg_bottom.jpg'
          alt=''
          className='absolute inset-0 w-full h-full object-cover'
          style={{ objectPosition: 'center 75%' }}
          loading='lazy'
          decoding='async'
        />
        {/* Cinematic tint */}
        <div
          className='absolute inset-0'
          style={{
            background: `linear-gradient(180deg,
              rgba(15,26,18,0.60) 0%,
              rgba(15,26,18,0.18) 40%,
              rgba(15,26,18,0.32) 100%
            )`,
          }}
        />
        {/* Top-edge fade into cream */}
        <div className='absolute top-0 left-0 right-0' style={{ height: '50%' }}>
          <div
            className='absolute inset-0'
            style={{
              background: `linear-gradient(to top,
                transparent 0%,
                rgba(${NEUTRAL_RGB},0.07) 15%,
                rgba(${NEUTRAL_RGB},0.21) 30%,
                rgba(${NEUTRAL_RGB},0.39) 45%,
                rgba(${NEUTRAL_RGB},0.61) 60%,
                rgba(${NEUTRAL_RGB},0.77) 75%,
                rgba(${NEUTRAL_RGB},0.88) 88%,
                rgba(${NEUTRAL_RGB},0.94) 100%
              )`,
            }}
          />
        </div>
      </div>

      {/* ═══ Content layer (above the bottom image) ═══ */}
      <div className='relative z-[1]'>
        {/* ── Dark-green header band ── */}
        <div className='bg-gov-dark'>
          {/* Spacer for the fixed navigation bar */}
          <div className='h-[72px]' />
          <div className='max-w-[1340px] mx-auto px-5 lg:px-8 pt-8 pb-10'>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className='max-w-3xl'>
              <h1 className='font-display text-3xl sm:text-4xl lg:text-[2.75rem] text-white leading-[1.12] mb-2 drop-shadow-lg'>
                {title}
              </h1>
              {subtitle && (
                <p className='text-base sm:text-lg text-white/70 font-light tracking-wide drop-shadow-md'>
                  {subtitle}
                </p>
              )}
            </motion.div>
          </div>
        </div>

        {/* ── Glass container ── */}
        <div className='max-w-[1340px] mx-auto px-5 lg:px-8 py-8'>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
            className={`rounded-2xl bg-white/40 backdrop-blur-xl border border-white/50 shadow-[0_8px_40px_rgba(0,0,0,0.08)] p-4 sm:p-6 space-y-6 ${className}`}>
            {children}
          </motion.div>
        </div>

        {/* Spacer so bottom scenic image peeks through */}
        <div className='h-24' />
      </div>
    </div>
  );
}
