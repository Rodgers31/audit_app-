'use client';

import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { ResponsiveContainer, Tooltip, Treemap } from 'recharts';

interface CategoryBreakdown {
  category: string;
  label: string;
  outstanding: number;
  share: number;
  lenders?: Array<{
    lender: string;
    outstanding: number;
    rate?: number | string | null;
    annual_service_cost?: number | null;
  }>;
}

interface LenderTreemapProps {
  categories: CategoryBreakdown[];
  totalOutstanding: number;
}

const COPPER_SHADES = ['#C94A4A', '#B13C3C', '#8C2E2E', '#732626', '#E07070'];
const SAGE_SHADES = ['#4A7C5C', '#3F6D4F', '#2E5A3E', '#1E3F2B', '#6E9B7E'];
const GOLD_SHADES = ['#D9A441', '#BA8B33', '#8F6A1F', '#F0C675'];

function categoryColor(cat: string, depth: number): string {
  const externalKeys = ['external', 'multilateral', 'bilateral', 'commercial', 'eurobond'];
  const domesticKeys = ['domestic', 'bond', 'tbill', 'cbk', 'overdraft', 'legacy'];
  const pendingKeys = ['pending'];
  const key = cat.toLowerCase();
  const palette = pendingKeys.some((p) => key.includes(p))
    ? GOLD_SHADES
    : externalKeys.some((p) => key.includes(p))
      ? COPPER_SHADES
      : domesticKeys.some((p) => key.includes(p))
        ? SAGE_SHADES
        : SAGE_SHADES;
  return palette[depth % palette.length];
}

function fmtT(val: number): string {
  if (val >= 1_000_000_000_000) return `${(val / 1_000_000_000_000).toFixed(2)}T`;
  if (val >= 1_000_000_000) return `${(val / 1_000_000_000).toFixed(1)}B`;
  return val.toLocaleString();
}

function CustomTooltipContent({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d || !d.name) return null;
  return (
    <div className='rounded-xl bg-white border border-neutral-border/60 shadow-elevated px-4 py-3 text-xs max-w-xs'>
      <p className='font-display text-sm text-gov-dark mb-1'>{d.fullName || d.name}</p>
      <div className='space-y-1 text-neutral-muted'>
        <div className='flex justify-between gap-6'>
          <span>Outstanding</span>
          <span className='font-bold text-gov-dark tabular-nums'>KES {fmtT(d.value || 0)}</span>
        </div>
        {d.share != null && (
          <div className='flex justify-between gap-6'>
            <span>Share of total</span>
            <span className='font-semibold text-gov-copper tabular-nums'>{d.share.toFixed(1)}%</span>
          </div>
        )}
      </div>
    </div>
  );
}

function CustomizedContent(props: any) {
  const { x, y, width, height, name, value, fillColor, share } = props;
  if (width < 2 || height < 2) return null;
  // Tiered label visibility — even tiny tiles get at least a tooltip via outer recharts
  const tier: 'full' | 'compact' | 'mini' | 'none' =
    width > 150 && height > 90
      ? 'full'
      : width > 90 && height > 55
        ? 'compact'
        : width > 55 && height > 30
          ? 'mini'
          : 'none';

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{
          fill: fillColor,
          stroke: '#ffffff',
          strokeWidth: 3,
        }}
      />
      {tier === 'full' && (
        <>
          <text
            x={x + 14}
            y={y + 24}
            fill='#ffffff'
            fontSize={13}
            fontWeight={700}
            letterSpacing='0.2'>
            {name}
          </text>
          <text
            x={x + 14}
            y={y + 50}
            fill='#ffffff'
            fontSize={22}
            fontWeight={800}
            className='tabular-nums'>
            KES {fmtT(value)}
          </text>
          {share != null && (
            <text
              x={x + 14}
              y={y + 70}
              fill='rgba(255,255,255,0.88)'
              fontSize={11}
              fontWeight={500}
              className='tabular-nums'>
              {share.toFixed(1)}% of total
            </text>
          )}
        </>
      )}
      {tier === 'compact' && (
        <>
          <text
            x={x + 10}
            y={y + 20}
            fill='#ffffff'
            fontSize={11}
            fontWeight={700}>
            {name}
          </text>
          <text
            x={x + 10}
            y={y + 40}
            fill='#ffffff'
            fontSize={15}
            fontWeight={800}
            className='tabular-nums'>
            {fmtT(value)}
          </text>
          {share != null && (
            <text
              x={x + 10}
              y={y + 56}
              fill='rgba(255,255,255,0.85)'
              fontSize={10}
              className='tabular-nums'>
              {share.toFixed(1)}%
            </text>
          )}
        </>
      )}
      {tier === 'mini' && (
        <>
          <text
            x={x + 8}
            y={y + 16}
            fill='#ffffff'
            fontSize={10}
            fontWeight={700}>
            {name.length > 14 ? name.slice(0, 13) + '…' : name}
          </text>
          <text
            x={x + 8}
            y={y + height - 8}
            fill='rgba(255,255,255,0.95)'
            fontSize={10}
            fontWeight={700}
            className='tabular-nums'>
            {fmtT(value)}
          </text>
        </>
      )}
    </g>
  );
}

export default function LenderTreemap({ categories, totalOutstanding }: LenderTreemapProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const treeData = useMemo(() => {
    return categories
      .filter((c) => c.outstanding > 0)
      .map((c, i) => ({
        name: c.label,
        fullName: c.label,
        value: c.outstanding,
        share: c.share,
        category: c.category,
        fillColor: categoryColor(c.category, i),
      }));
  }, [categories]);

  if (!treeData.length) {
    return (
      <div className='rounded-xl bg-white/70 border border-white/60 p-8 text-center text-sm text-neutral-muted'>
        No lender breakdown available yet.
      </div>
    );
  }

  const external = categories.filter(
    (c) => c.category.includes('external') || c.category.includes('commercial')
  );
  const domestic = categories.filter(
    (c) =>
      c.category.includes('domestic') ||
      c.category.includes('bond') ||
      c.category.includes('tbill') ||
      c.category.includes('cbk') ||
      c.category.includes('legacy')
  );
  const externalSum = external.reduce((s, c) => s + c.outstanding, 0);
  const domesticSum = domestic.reduce((s, c) => s + c.outstanding, 0);
  const externalShare = totalOutstanding > 0 ? (externalSum / totalOutstanding) * 100 : 0;
  const domesticShare = totalOutstanding > 0 ? (domesticSum / totalOutstanding) * 100 : 0;

  return (
    <div className='space-y-4'>
      {/* External vs Domestic split summary */}
      <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          className='relative rounded-2xl bg-white border border-gov-copper/30 shadow-surface p-5 overflow-hidden'>
          <div className='absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-gov-copper via-gov-copper/70 to-gov-copper/30' />
          <div className='flex items-center justify-between mb-2'>
            <span className='text-[11px] font-semibold uppercase tracking-[0.15em] text-gov-copper'>
              External debt
            </span>
            <span className='text-sm font-bold text-gov-copper tabular-nums bg-gov-copper/10 px-2 py-0.5 rounded-full'>
              {externalShare.toFixed(1)}%
            </span>
          </div>
          <div className='text-3xl font-extrabold text-gov-dark tabular-nums tracking-tight'>
            KES {fmtT(externalSum)}
          </div>
          <p className='text-[11px] text-neutral-muted mt-2 leading-relaxed'>
            Foreign-currency exposure — World Bank, China Exim, Eurobonds. FX risk on the shilling.
          </p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          className='relative rounded-2xl bg-white border border-gov-sage/30 shadow-surface p-5 overflow-hidden'>
          <div className='absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-gov-sage via-gov-sage/70 to-gov-sage/30' />
          <div className='flex items-center justify-between mb-2'>
            <span className='text-[11px] font-semibold uppercase tracking-[0.15em] text-gov-sage'>
              Domestic debt
            </span>
            <span className='text-sm font-bold text-gov-sage tabular-nums bg-gov-sage/10 px-2 py-0.5 rounded-full'>
              {domesticShare.toFixed(1)}%
            </span>
          </div>
          <div className='text-3xl font-extrabold text-gov-dark tabular-nums tracking-tight'>
            KES {fmtT(domesticSum)}
          </div>
          <p className='text-[11px] text-neutral-muted mt-2 leading-relaxed'>
            Treasury Bonds &amp; Bills held in-country by banks &amp; pension funds. Rate risk.
          </p>
        </motion.div>
      </div>

      {/* Treemap */}
      <div className='rounded-2xl overflow-hidden bg-white border border-neutral-border/40 shadow-surface'>
        <ResponsiveContainer width='100%' height={400}>
          <Treemap
            data={treeData}
            dataKey='value'
            stroke='#ffffff'
            animationDuration={600}
            content={<CustomizedContent />}>
            <Tooltip content={<CustomTooltipContent />} />
          </Treemap>
        </ResponsiveContainer>
      </div>

      {/* Legend & drill-down */}
      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2'>
        {categories
          .filter((c) => c.outstanding > 0)
          .sort((a, b) => b.outstanding - a.outstanding)
          .map((cat, i) => {
            const isOpen = expanded === cat.category;
            const color = categoryColor(cat.category, i);
            return (
              <div key={cat.category} className='rounded-lg bg-white border border-neutral-border/30 shadow-sm'>
                <button
                  onClick={() => setExpanded(isOpen ? null : cat.category)}
                  className='w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-gov-sand/40 transition-colors rounded-lg'>
                  <span
                    className='w-3 h-3 rounded-sm flex-shrink-0'
                    style={{ backgroundColor: color }}
                  />
                  <div className='flex-1 min-w-0'>
                    <div className='flex items-baseline justify-between gap-2'>
                      <span className='text-xs font-semibold text-gov-dark truncate'>
                        {cat.label}
                      </span>
                      <span className='text-[11px] text-gov-copper font-bold tabular-nums'>
                        {cat.share.toFixed(1)}%
                      </span>
                    </div>
                    <div className='text-[11px] text-neutral-muted tabular-nums'>
                      KES {fmtT(cat.outstanding)}
                    </div>
                  </div>
                </button>
                {isOpen && cat.lenders && cat.lenders.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className='px-3 pb-3 pt-1 border-t border-neutral-border/30 space-y-1'>
                    {cat.lenders.slice(0, 6).map((l) => (
                      <div key={l.lender} className='flex justify-between text-[11px] gap-2'>
                        <span className='text-neutral-muted truncate'>{l.lender}</span>
                        <span className='text-gov-dark font-medium tabular-nums flex-shrink-0'>
                          {fmtT(l.outstanding)}
                        </span>
                      </div>
                    ))}
                  </motion.div>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}
