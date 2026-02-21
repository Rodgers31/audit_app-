/**
 * Homepage client component.
 *
 * This is the pure-UI part of the homepage. It reads prefetched data
 * from the React Query hydration boundary (populated server-side in
 * the parent page.tsx) so there are zero loading spinners on first paint.
 *
 * If the cache is somehow empty (e.g. prefetch failed), the hooks
 * gracefully fall back to client-side fetching.
 */
'use client';

import {
  AuditReportsSection,
  BudgetSnapshotCard,
  CountyDetailsPanel,
  FeatureNavCards,
  HeroSection,
  KenyanGovCard,
  LearningHubCTA,
  NationalDebtCard,
  NationalLoansCard,
  SummaryStrip,
} from '@/components/dashboard';
import InteractiveKenyaMap from '@/components/InteractiveKenyaMap';
import { ScenicBackgroundLayout } from '@/components/layout';
import { useCounties } from '@/lib/react-query';
import { County } from '@/types';
import { motion } from 'framer-motion';
import { useCallback, useState } from 'react';

export default function HomeDashboardClient() {
  /* ── Dynamic county data from the database ── */
  const { data: counties = [] } = useCounties();

  const [selectedCounty, setSelectedCounty] = useState<County | null>(null);
  const [hoveredCounty, setHoveredCounty] = useState<County | null>(null);
  const [countyIndex, setCountyIndex] = useState(0);

  // Hover callback for the map — shows hovered county in the side panel
  const handleCountyHover = useCallback((county: County | null) => {
    setHoveredCounty(county);
  }, []);

  // Priority: hover > explicit click > auto-rotate
  const activeCounty = hoveredCounty ?? selectedCounty ?? counties[countyIndex] ?? null;

  return (
    <ScenicBackgroundLayout
      topImage='/kenya_bg_top.jpg'
      bottomImage='/kenya_bg_bottom.jpg'
      topHeight='50vh'
      bottomHeight='50vh'
      readabilityMode='light'
      intensity={0.94}>
      {/* Hero title — scenic image visible behind */}
      <HeroSection />

      {/* ══════════════════════════════════════════════════
          ONE GLASS CONTAINER — wraps ALL dashboard content.
          Background transitions (scenic → neutral → scenic)
          show through the translucent glass as you scroll.
          ══════════════════════════════════════════════════ */}
      <div className='max-w-[1340px] mx-auto px-5 lg:px-8 pb-12'>
        <motion.div
          initial={{ opacity: 0, y: 36 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.4 }}
          className='rounded-2xl bg-white/20 backdrop-blur-xl border border-white/25 shadow-[0_8px_40px_rgba(0,0,0,0.12)] p-4 sm:p-6 space-y-6'>
          {/* ── Summary strip ── */}
          <SummaryStrip />

          {/* ── Debt chart + Kenyan Government card ── */}
          <div className='grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4 items-stretch'>
            <NationalDebtCard />
            <KenyanGovCard />
          </div>

          {/* ── Map + County Details — unified container ── */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className='grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-0 items-stretch rounded-xl bg-gray-50/60 border border-gray-200/40 overflow-hidden'>
            <InteractiveKenyaMap
              counties={counties}
              onCountySelect={setSelectedCounty}
              onCountyHover={handleCountyHover}
              selectedCounty={selectedCounty}
              currentCountyIndex={countyIndex}
              onCountyIndexChange={setCountyIndex}
              className='p-4'
            />
            <div className='border-t lg:border-t-0 lg:border-l border-gray-200/50'>
              <CountyDetailsPanel
                county={activeCounty}
                className='h-full rounded-none border-0 shadow-none'
              />
            </div>
          </motion.div>

          {/* ── Latest Audit Reports ── */}
          <AuditReportsSection />

          {/* ── Budget Snapshot + National Loans ── */}
          <div className='grid grid-cols-1 lg:grid-cols-2 gap-5'>
            <BudgetSnapshotCard />
            <NationalLoansCard />
          </div>

          {/* ── Feature Navigation Cards ── */}
          <FeatureNavCards />

          {/* ── Learning Hub CTA ── */}
          <LearningHubCTA />
        </motion.div>
      </div>

      {/* Spacer for bottom scenic image to show below glass */}
      <div className='h-20' />
    </ScenicBackgroundLayout>
  );
}
