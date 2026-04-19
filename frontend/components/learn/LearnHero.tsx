/**
 * LearnHero — the opening of the Learn hub.
 *
 * Search-forward layout: a single prominent search field that scrolls the
 * user straight into the Constitution book and forwards their query. The
 * stat chips translate the scale of the content into a human sentence.
 */
'use client';

import { CONSTITUTION_META, TOTAL_ARTICLES } from '@/data/constitution';
import { POPULAR_QUESTIONS } from '@/data/popularQuestions';
import { TOTAL_QUESTIONS } from '@/data/quizData';
import { motion } from 'framer-motion';
import { ArrowRight, BookOpen, Brain, GraduationCap, HelpCircle, Search, Sparkles } from 'lucide-react';
import { useState } from 'react';

interface LearnHeroProps {
  /** Forward the query to the Constitution book and scroll it into view. */
  onSearchSubmit: (query: string) => void;
}

const EXAMPLE_QUERIES = ['Article 229', 'Auditor General', 'Chapter 6', 'Public debt', 'Devolution'];

export default function LearnHero({ onSearchSubmit }: LearnHeroProps) {
  const [value, setValue] = useState('');

  const submit = (q: string) => {
    const clean = q.trim();
    if (!clean) return;
    onSearchSubmit(clean);
  };

  return (
    <section
      aria-labelledby='learn-hero-heading'
      className='relative overflow-hidden rounded-3xl border border-white/60 bg-gradient-to-br from-gov-forest via-gov-dark to-gov-forest p-5 text-white shadow-elevated sm:p-8 lg:p-10'>
      {/* Decorative rings */}
      <div className='pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full border border-white/10' />
      <div className='pointer-events-none absolute -right-2 bottom-10 h-24 w-24 rounded-full border border-white/5' />
      <div className='pointer-events-none absolute -left-12 -bottom-12 h-48 w-48 rounded-full bg-gov-gold/10 blur-2xl' />

      <div className='relative grid gap-6 lg:grid-cols-[1.3fr_1fr] lg:items-center'>
        {/* Left — copy + search */}
        <div className='min-w-0 max-w-2xl'>
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className='mb-4 inline-flex max-w-full items-center gap-2 overflow-hidden rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-gov-gold ring-1 ring-white/10 sm:tracking-widest'>
            <Sparkles size={12} className='shrink-0' />
            <span className='truncate'>Civic learning · built on real data</span>
          </motion.div>

          <motion.h1
            id='learn-hero-heading'
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.05 }}
            className='font-display text-[1.75rem] leading-[1.12] text-white drop-shadow sm:text-4xl lg:text-[2.9rem]'>
            Understand Kenya&rsquo;s
            <span className='block text-gov-gold'>
              money, law &amp; power
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.12 }}
            className='mt-4 max-w-xl text-[15.5px] leading-relaxed text-white/80 sm:text-base'>
            Plain-language explainers, a searchable Constitution, and quick quizzes —
            all built from the same audited facts that power the rest of the dashboard.
          </motion.p>

          {/* Search */}
          <motion.form
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.2 }}
            onSubmit={(e) => {
              e.preventDefault();
              submit(value);
            }}
            className='mt-6 flex w-full max-w-xl items-center gap-2 rounded-2xl bg-white/95 p-1.5 shadow-elevated ring-1 ring-white/20'>
            <Search size={18} className='ml-3 text-gov-forest/70' />
            <input
              type='search'
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder='Search the Constitution or civic topics…'
              className='min-w-0 flex-1 bg-transparent py-2.5 text-sm text-gov-dark outline-none placeholder:text-neutral-muted sm:text-[15px]'
              aria-label='Search civic topics or the Constitution'
            />
            <button
              type='submit'
              className='inline-flex items-center gap-1.5 rounded-xl bg-gov-forest px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gov-dark'>
              Search
              <ArrowRight size={15} />
            </button>
          </motion.form>

          {/* Example chips */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className='mt-3 flex flex-wrap items-center gap-1.5 text-xs text-white/60'>
            <span>Try:</span>
            {EXAMPLE_QUERIES.map((q) => (
              <button
                key={q}
                type='button'
                onClick={() => {
                  setValue(q);
                  submit(q);
                }}
                className='rounded-full bg-white/10 px-2.5 py-1 text-[11.5px] font-medium text-white/85 hover:bg-white/20'>
                {q}
              </button>
            ))}
          </motion.div>
        </div>

        {/* Right — stat cards */}
        <div className='grid min-w-0 grid-cols-2 gap-3 sm:gap-4'>
          <StatCard
            icon={BookOpen}
            value={CONSTITUTION_META.length}
            label='Chapters published'
            accent='text-gov-gold'
          />
          <StatCard
            icon={GraduationCap}
            value={TOTAL_ARTICLES}
            label='Articles to read'
            accent='text-white'
          />
          <StatCard
            icon={Brain}
            value={TOTAL_QUESTIONS}
            label='Quiz questions'
            accent='text-gov-gold'
          />
          <StatCard
            icon={HelpCircle}
            value={POPULAR_QUESTIONS.length}
            label='Popular Q&As'
            accent='text-white'
          />
        </div>
      </div>
    </section>
  );
}

function StatCard({
  icon: Icon,
  value,
  label,
  accent,
}: {
  icon: React.ElementType;
  value: number;
  label: string;
  accent: string;
}) {
  return (
    <motion.div
      whileHover={{ y: -3 }}
      className='rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur transition-colors hover:bg-white/15'>
      <Icon size={16} className={`mb-1.5 ${accent}`} />
      <div className={`font-display text-2xl font-bold ${accent}`}>{value}</div>
      <div className='text-[11px] text-white/70 sm:text-xs'>{label}</div>
    </motion.div>
  );
}
