'use client';

import { useLang } from '@/lib/i18n/LangProvider';
import type { TranslationKey } from '@/lib/i18n/messages';
import { motion } from 'framer-motion';
import { BarChart3, Globe, Map, Search } from 'lucide-react';
import Link from 'next/link';

interface Feature {
  titleKey: TranslationKey;
  subKey: TranslationKey;
  icon: typeof Globe;
  href: string;
  emoji: string;
}

const features: Feature[] = [
  { titleKey: 'home.features.debt.title', subKey: 'home.features.debt.sub', icon: Globe, href: '/debt', emoji: '🇰🇪' },
  { titleKey: 'home.features.budget.title', subKey: 'home.features.budget.sub', icon: BarChart3, href: '/budget', emoji: '📊' },
  { titleKey: 'home.features.explore.title', subKey: 'home.features.explore.sub', icon: Map, href: '/counties', emoji: '🗺️' },
  { titleKey: 'home.features.audits.title', subKey: 'home.features.audits.sub', icon: Search, href: '/audits', emoji: '🔍' },
];

/**
 * Zone 7: Feature Navigation Strip
 * Four light navigation surfaces — NOT dashboard widgets.
 * Hover → slight elevation lift.
 */
export default function FeatureNavCards() {
  const { t } = useLang();
  return (
    <div className='grid grid-cols-2 lg:grid-cols-4 gap-4'>
      {features.map((feat, i) => (
        <motion.div
          key={feat.titleKey}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.5, delay: 0.08 * i }}>
          <Link href={feat.href}>
            <div
              className='group relative bg-white/70 dark:bg-surface-elevated backdrop-blur-sm border border-neutral-border/40 rounded-2xl p-5 sm:p-6 text-center
                            transition-all duration-300
                            hover:shadow-elevated hover:-translate-y-1 hover:border-gov-sage/30
                            cursor-pointer'>
              {/* Icon */}
              <div
                className='w-12 h-12 mx-auto mb-3 rounded-xl bg-gov-sage/8 flex items-center justify-center
                              group-hover:bg-gov-sage/15 transition-colors duration-300'>
                <span className='text-2xl' suppressHydrationWarning>
                  {feat.emoji}
                </span>
              </div>

              <h4 className='text-sm font-semibold text-gov-dark dark:text-white leading-snug mb-1'>
                {t(feat.titleKey)}
              </h4>
              <span className='inline-block text-[11px] text-neutral-muted bg-gov-sand/60 dark:bg-emerald-100/10 dark:text-emerald-100/90 px-3 py-1 rounded-full'>
                {t(feat.subKey)}
              </span>
            </div>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}
