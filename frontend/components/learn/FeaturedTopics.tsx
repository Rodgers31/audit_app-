/**
 * FeaturedTopics — mixed-layout card grid that introduces the learning modes.
 *
 * Visual layout (desktop ≥ lg):
 *   ┌─────────────────────┬───────────┐
 *   │ FEATURED — Const.   │ Budget    │
 *   │  big hero-style     ├───────────┤
 *   │  card with gold     │ Audits    │
 *   │  accent             ├───────────┤
 *   ├────────┬────────────┤ Devolution│
 *   │ Quiz   │ Glossary   ├───────────┤
 *   └────────┴────────────┴───────────┘
 */
'use client';

import { motion } from 'framer-motion';
import {
  ArrowRight,
  BookOpen,
  Coins,
  Gavel,
  Landmark,
  Library,
  Scale,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import type { ComponentType } from 'react';

interface Topic {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: ComponentType<{ size?: number | string; className?: string }>;
  variant: 'featured' | 'small' | 'column';
  accent: 'gold' | 'sage' | 'copper' | 'sky' | 'violet' | 'emerald';
  tag?: string;
}

const TOPICS: Topic[] = [
  {
    id: 'constitution',
    title: 'The Constitution, unlocked',
    description:
      'Read Chapter 12 on Public Finance or jump straight to Article 229. Page-turn animations, keyword search, and plain-English notes on what each article actually means for public money.',
    href: '#constitution-book',
    icon: BookOpen,
    variant: 'featured',
    accent: 'gold',
    tag: 'New interactive book',
  },
  {
    id: 'budget',
    title: 'Budget & Debt',
    description: 'How the national budget is built and why public debt matters.',
    href: '/budget',
    icon: Coins,
    variant: 'column',
    accent: 'emerald',
  },
  {
    id: 'audits',
    title: 'Audits explained',
    description: 'What the Auditor-General looks for and how to read a report.',
    href: '/audits',
    icon: Scale,
    variant: 'column',
    accent: 'copper',
  },
  {
    id: 'devolution',
    title: 'Devolved government',
    description: 'How the 47 counties get and spend money.',
    href: '/counties',
    icon: Landmark,
    variant: 'column',
    accent: 'sky',
  },
  {
    id: 'quiz',
    title: 'Test yourself',
    description: 'Short quizzes across 6 civic categories.',
    href: '/learn/quiz',
    icon: Gavel,
    variant: 'small',
    accent: 'violet',
  },
  {
    id: 'glossary',
    title: 'Jargon, translated',
    description: 'Procurement, CoB, PFM — every term you meet, in plain Kenyan English.',
    href: '/learn/glossary',
    icon: Library,
    variant: 'small',
    accent: 'sage',
  },
];

const ACCENT: Record<
  Topic['accent'],
  { bg: string; text: string; ring: string; chip: string }
> = {
  gold: {
    bg: 'bg-gradient-to-br from-gov-gold/95 via-gov-gold to-amber-500',
    text: 'text-gov-dark',
    ring: 'ring-gov-gold/40',
    chip: 'bg-gov-dark text-gov-gold',
  },
  sage: {
    bg: 'bg-gradient-to-br from-emerald-50 to-gov-sage/20',
    text: 'text-gov-forest',
    ring: 'ring-gov-sage/30',
    chip: 'bg-gov-sage/20 text-gov-forest',
  },
  copper: {
    bg: 'bg-gradient-to-br from-amber-50 to-orange-100',
    text: 'text-amber-900',
    ring: 'ring-amber-300/40',
    chip: 'bg-amber-200 text-amber-900',
  },
  sky: {
    bg: 'bg-gradient-to-br from-sky-50 to-indigo-100',
    text: 'text-sky-900',
    ring: 'ring-sky-300/40',
    chip: 'bg-sky-200 text-sky-900',
  },
  violet: {
    bg: 'bg-gradient-to-br from-violet-50 to-purple-100',
    text: 'text-violet-900',
    ring: 'ring-violet-300/40',
    chip: 'bg-violet-200 text-violet-900',
  },
  emerald: {
    bg: 'bg-gradient-to-br from-emerald-50 to-teal-100',
    text: 'text-emerald-900',
    ring: 'ring-emerald-300/40',
    chip: 'bg-emerald-200 text-emerald-900',
  },
};

function Card({ t, index }: { t: Topic; index: number }) {
  const a = ACCENT[t.accent];
  const Icon = t.icon;

  if (t.variant === 'featured') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.5, delay: index * 0.04 }}
        className='row-span-2 lg:col-span-1'>
        <Link
          href={t.href}
          className={`group relative flex h-full flex-col justify-between overflow-hidden rounded-3xl p-6 shadow-elevated ring-1 sm:p-8 ${a.bg} ${a.text} ${a.ring}`}>
          <div>
            <div className='mb-4 inline-flex items-center gap-2'>
              <span className={`rounded-xl bg-white/40 p-2 ${a.text}`}>
                <Icon size={22} />
              </span>
              {t.tag && (
                <span className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-widest ${a.chip}`}>
                  <Sparkles size={11} className='-mt-0.5 mr-1 inline' />
                  {t.tag}
                </span>
              )}
            </div>
            <h3 className='font-display text-2xl leading-tight sm:text-[1.75rem]'>{t.title}</h3>
            <p className='mt-3 max-w-md text-[14.5px] leading-relaxed opacity-90'>
              {t.description}
            </p>
          </div>
          <div className='mt-5 inline-flex items-center gap-1.5 text-sm font-semibold underline-offset-4 group-hover:underline'>
            Open the book
            <ArrowRight size={15} className='transition-transform group-hover:translate-x-0.5' />
          </div>
          {/* Decorative */}
          <div className='pointer-events-none absolute -right-8 -bottom-8 h-40 w-40 rounded-full bg-white/20 blur-2xl' />
        </Link>
      </motion.div>
    );
  }

  if (t.variant === 'column') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.45, delay: index * 0.04 }}>
        <Link
          href={t.href}
          className={`group flex items-start gap-3 rounded-2xl p-4 ring-1 transition-all hover:-translate-y-0.5 hover:shadow-elevated sm:p-5 ${a.bg} ${a.text} ${a.ring}`}>
          <span className='flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/70'>
            <Icon size={18} />
          </span>
          <div className='min-w-0 flex-1'>
            <div className='font-display text-base font-semibold sm:text-lg'>{t.title}</div>
            <p className='mt-0.5 text-[12.5px] leading-snug opacity-85 sm:text-[13.5px]'>
              {t.description}
            </p>
          </div>
          <ArrowRight
            size={14}
            className='mt-1.5 shrink-0 opacity-60 transition-transform group-hover:translate-x-0.5 group-hover:opacity-100'
          />
        </Link>
      </motion.div>
    );
  }

  // small
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.45, delay: index * 0.04 }}>
      <Link
        href={t.href}
        className={`group flex h-full flex-col justify-between rounded-2xl p-4 ring-1 transition-all hover:-translate-y-0.5 hover:shadow-elevated sm:p-5 ${a.bg} ${a.text} ${a.ring}`}>
        <span className='inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/70'>
          <Icon size={18} />
        </span>
        <div>
          <div className='mt-4 font-display text-base font-semibold sm:text-lg'>{t.title}</div>
          <p className='mt-1 text-[12.5px] leading-snug opacity-85 sm:text-[13px]'>
            {t.description}
          </p>
          <div className='mt-3 inline-flex items-center gap-1 text-[12px] font-semibold underline-offset-4 group-hover:underline'>
            Open
            <ArrowRight size={12} className='transition-transform group-hover:translate-x-0.5' />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export default function FeaturedTopics() {
  const featured = TOPICS.find((t) => t.variant === 'featured')!;
  const columns = TOPICS.filter((t) => t.variant === 'column');
  const smalls = TOPICS.filter((t) => t.variant === 'small');

  return (
    <section aria-labelledby='featured-topics-heading' className='space-y-4'>
      <div className='flex items-end justify-between gap-4'>
        <div>
          <h2
            id='featured-topics-heading'
            className='font-display text-2xl leading-tight text-gov-dark sm:text-[1.7rem]'>
            Start with a topic
          </h2>
          <p className='text-sm text-neutral-muted'>
            Pick a door. Each one connects back to live data on the dashboard.
          </p>
        </div>
      </div>

      <div className='grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_1fr]'>
        {/* Left column = featured tall card */}
        <Card t={featured} index={0} />

        {/* Right column = 3 stacked column cards + 2 small cards in a row below */}
        <div className='flex flex-col gap-4'>
          <div className='grid grid-cols-1 gap-3'>
            {columns.map((t, i) => (
              <Card key={t.id} t={t} index={i + 1} />
            ))}
          </div>
          <div className='grid grid-cols-2 gap-3'>
            {smalls.map((t, i) => (
              <Card key={t.id} t={t} index={columns.length + i + 1} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
