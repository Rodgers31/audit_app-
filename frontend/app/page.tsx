'use client';

import {
  AuditReportsSection,
  AuditTransparencyCard,
  CountyDetailsPanel,
  CountyFinancesCard,
  FeatureNavCards,
  HeroSection,
  KenyanGovCard,
  LearningHubCTA,
  NationalDebtPanel,
  SummaryStrip,
} from '@/components/dashboard';
import InteractiveKenyaMap from '@/components/InteractiveKenyaMap';
import { ScenicBackgroundLayout } from '@/components/layout';
import { County } from '@/types';
import { motion } from 'framer-motion';
import { useState } from 'react';

/* ── Mock county data for the LOCKED map ── */
const MOCK_COUNTIES: County[] = [
  {
    id: '1',
    name: 'Nairobi',
    population: 4397073,
    budget_2025: 37800000000,
    financial_health_score: 72,
    audit_rating: 'B+',
    auditStatus: 'clean',
    budget: 37800000000,
    debt: 8200000000,
  },
  {
    id: '2',
    name: 'Mombasa',
    population: 1208333,
    budget_2025: 15200000000,
    financial_health_score: 65,
    audit_rating: 'B',
    auditStatus: 'qualified',
    budget: 15200000000,
    debt: 3400000000,
  },
  {
    id: '3',
    name: 'Kisumu',
    population: 1155574,
    budget_2025: 21220000000,
    financial_health_score: 58,
    audit_rating: 'B-',
    auditStatus: 'qualified',
    budget: 21220000000,
    debt: 5370000000,
  },
  {
    id: '4',
    name: 'Nakuru',
    population: 2162202,
    budget_2025: 18900000000,
    financial_health_score: 70,
    audit_rating: 'B+',
    auditStatus: 'clean',
    budget: 18900000000,
    debt: 4100000000,
  },
  {
    id: '5',
    name: 'Kajiado',
    population: 1117840,
    budget_2025: 16500000000,
    financial_health_score: 55,
    audit_rating: 'B-',
    auditStatus: 'adverse',
    budget: 16500000000,
    debt: 4800000000,
  },
  {
    id: '6',
    name: 'Kiambu',
    population: 2417735,
    budget_2025: 19800000000,
    financial_health_score: 68,
    audit_rating: 'B+',
    auditStatus: 'clean',
    budget: 19800000000,
    debt: 3900000000,
  },
  {
    id: '7',
    name: 'Machakos',
    population: 1421932,
    budget_2025: 14100000000,
    financial_health_score: 62,
    audit_rating: 'B',
    auditStatus: 'qualified',
    budget: 14100000000,
    debt: 2900000000,
  },
  {
    id: '8',
    name: 'Kilifi',
    population: 1453787,
    budget_2025: 13400000000,
    financial_health_score: 48,
    audit_rating: 'C+',
    auditStatus: 'adverse',
    budget: 13400000000,
    debt: 4200000000,
  },
  {
    id: '9',
    name: 'Uasin Gishu',
    population: 1163186,
    budget_2025: 15600000000,
    financial_health_score: 71,
    audit_rating: 'B+',
    auditStatus: 'clean',
    budget: 15600000000,
    debt: 2800000000,
  },
  {
    id: '10',
    name: 'Bungoma',
    population: 1670570,
    budget_2025: 12900000000,
    financial_health_score: 45,
    audit_rating: 'C',
    auditStatus: 'disclaimer',
    budget: 12900000000,
    debt: 5100000000,
  },
];

export default function HomeDashboard() {
  const [selectedCounty, setSelectedCounty] = useState<County | null>(null);
  const [countyIndex, setCountyIndex] = useState(0);

  // The county shown in the details panel: explicit selection OR the auto-rotating one
  const activeCounty = selectedCounty ?? MOCK_COUNTIES[countyIndex] ?? null;

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
            <NationalDebtPanel />
            <KenyanGovCard />
          </div>

          {/* ── Map (left) + County Details Panel (right) ── */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className='grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-5 items-stretch'>
            <InteractiveKenyaMap
              counties={MOCK_COUNTIES}
              onCountySelect={setSelectedCounty}
              selectedCounty={selectedCounty}
              currentCountyIndex={countyIndex}
              onCountyIndexChange={setCountyIndex}
            />
            <CountyDetailsPanel county={activeCounty} />
          </motion.div>

          {/* ── Latest Audit Reports ── */}
          <AuditReportsSection />

          {/* ── County Finances + Audit Transparency ── */}
          <div className='grid grid-cols-1 lg:grid-cols-2 gap-5'>
            <CountyFinancesCard />
            <AuditTransparencyCard />
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
