/**
 * PopularQuestions — expandable FAQ for the Learn hub.
 *
 * One question open at a time. Clicking the active row collapses it.
 * Deep-links pass an article number back to the ConstitutionBook via a
 * parent callback so it opens the referenced article in place.
 */
'use client';

import { POPULAR_QUESTIONS, type PopularQuestion } from '@/data/popularQuestions';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ExternalLink, HelpCircle, ScrollText } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

const CATEGORY_STYLE: Record<PopularQuestion['category'], string> = {
  Budget: 'bg-emerald-100 text-emerald-700',
  Audit: 'bg-amber-100 text-amber-700',
  Debt: 'bg-rose-100 text-rose-700',
  Devolution: 'bg-sky-100 text-sky-700',
  Citizens: 'bg-violet-100 text-violet-700',
  Constitution: 'bg-gov-gold/20 text-gov-dark',
};

interface Props {
  /** Scrolls to ConstitutionBook and opens the given article, if set. */
  onOpenArticle?: (articleNumber: number) => void;
}

export default function PopularQuestions({ onOpenArticle }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <section
      aria-labelledby='popular-questions-heading'
      className='rounded-3xl border border-white/60 bg-white/65 p-5 shadow-surface backdrop-blur sm:p-7'>
      <div className='mb-5 flex items-center gap-3'>
        <span className='flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gov-forest/10 text-gov-forest'>
          <HelpCircle size={20} />
        </span>
        <div>
          <h2
            id='popular-questions-heading'
            className='font-display text-xl leading-tight text-gov-dark sm:text-2xl'>
            Popular questions
          </h2>
          <p className='text-xs text-neutral-muted sm:text-sm'>
            What other Kenyans are asking about budgets, audits, and accountability.
          </p>
        </div>
      </div>

      <ul className='divide-y divide-neutral-border/60 overflow-hidden rounded-2xl border border-neutral-border/60 bg-white/80'>
        {POPULAR_QUESTIONS.map((q) => {
          const isOpen = openId === q.id;
          return (
            <li key={q.id} className='group'>
              <button
                type='button'
                onClick={() => setOpenId(isOpen ? null : q.id)}
                aria-expanded={isOpen}
                className='flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-gov-forest/5 sm:px-5'>
                <span
                  className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider ${CATEGORY_STYLE[q.category]}`}>
                  {q.category}
                </span>
                <span className='min-w-0 flex-1 text-sm font-semibold text-neutral-text sm:text-[15px]'>
                  {q.question}
                </span>
                <motion.span
                  animate={{ rotate: isOpen ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  className='mt-0.5 shrink-0 text-neutral-muted group-hover:text-gov-forest'>
                  <ChevronDown size={18} />
                </motion.span>
              </button>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    key='a'
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className='overflow-hidden'>
                    <div className='px-4 pb-4 sm:px-5'>
                      <p className='pl-[88px] text-[14px] leading-relaxed text-neutral-text sm:pl-[104px]'>
                        {q.answer}
                      </p>
                      {(q.articleNumber || q.learnMoreHref) && (
                        <div className='mt-3 flex flex-wrap gap-2 pl-[88px] sm:pl-[104px]'>
                          {q.articleNumber && onOpenArticle && (
                            <button
                              type='button'
                              onClick={() => onOpenArticle(q.articleNumber!)}
                              className='inline-flex items-center gap-1.5 rounded-full bg-gov-forest px-3 py-1 text-xs font-semibold text-white hover:bg-gov-dark'>
                              <ScrollText size={12} />
                              Read Article {q.articleNumber}
                            </button>
                          )}
                          {q.learnMoreHref && (
                            <Link
                              href={q.learnMoreHref}
                              className='inline-flex items-center gap-1.5 rounded-full bg-gov-forest/10 px-3 py-1 text-xs font-semibold text-gov-forest hover:bg-gov-forest/15'>
                              Learn more
                              <ExternalLink size={11} />
                            </Link>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
