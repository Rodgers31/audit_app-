'use client';

import { motion } from 'framer-motion';
import { CheckCircle2, Clock, FileWarning, XCircle } from 'lucide-react';
import { useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

const countyTabs = ['Kajiado', 'Kisumu', 'Mombasa'];

const auditStatuses = [
  { label: 'Clean', count: 47, icon: CheckCircle2, color: '#4A7C5C' },
  { label: 'Disclaimer', count: 5, icon: FileWarning, color: '#D97706' },
  { label: 'Adverse', count: 47, icon: XCircle, color: '#C94A4A' },
  { label: 'Pending', count: 3, icon: Clock, color: '#9CA3AF' },
];

const revenueBreakdown = [
  { name: 'Domestic Revenue', value: 72, color: '#1B3A2A' },
  { name: 'External', value: 28, color: '#4A7C5C' },
];

const debtServicing = [
  { name: 'Medium Term', value: 37, color: '#D9A441' },
  { name: 'Short Term', value: 40, color: '#C94A4A' },
  { name: 'Long Term', value: 23, color: '#4A7C5C' },
];

/**
 * Zone 6 RIGHT: Latest Audit Reports — tabbed county auditscw
 * Asymmetric (narrower than debt overview). Contains status rows + pie charts.
 */
export default function AuditReportsSection() {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, delay: 0.25 }}
      className='glass-card p-6 sm:p-8 flex flex-col'>
      <h3 className='font-display text-xl text-gov-dark mb-4'>Latest Audit Reports</h3>

      {/* County tabs */}
      <div className='flex gap-2 mb-5'>
        {countyTabs.map((tab, i) => (
          <button
            key={tab}
            onClick={() => setActiveTab(i)}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-200
              ${
                activeTab === i
                  ? 'bg-gov-forest text-white shadow-sm'
                  : 'bg-white/60 text-neutral-muted hover:bg-white/90 border border-neutral-border/40'
              }`}>
            {tab}
          </button>
        ))}
        <span className='text-neutral-muted/50 text-xs flex items-center ml-1'>…</span>
      </div>

      {/* Audit status rows */}
      <div className='grid grid-cols-2 gap-x-4 gap-y-2 mb-6'>
        {auditStatuses.map(({ label, count, icon: Icon, color }) => (
          <div key={label} className='flex items-center gap-2'>
            <Icon className='w-4 h-4 flex-shrink-0' style={{ color }} />
            <span className='text-xs text-neutral-muted'>{label}</span>
            <span className='ml-auto text-sm font-semibold tabular-nums' style={{ color }}>
              {count}
            </span>
          </div>
        ))}
      </div>

      {/* Mini pie charts row */}
      <div className='grid grid-cols-2 gap-4 flex-1'>
        <PieMini title='Revenue Distribution' data={revenueBreakdown} />
        <PieMini title='Debt Servicing' data={debtServicing} />
      </div>

      <button className='btn-secondary w-full mt-5 text-sm'>View Detailed Report</button>
    </motion.div>
  );
}

function PieMini({
  title,
  data,
}: {
  title: string;
  data: { name: string; value: number; color: string }[];
}) {
  return (
    <div>
      <p className='text-xs font-medium text-neutral-muted mb-2'>{title}</p>
      <div className='h-28'>
        <ResponsiveContainer width='100%' height='100%'>
          <PieChart>
            <Pie
              data={data}
              cx='50%'
              cy='50%'
              innerRadius={22}
              outerRadius={42}
              paddingAngle={3}
              dataKey='value'
              stroke='none'>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: 'rgba(255,255,255,0.9)',
                border: '1px solid #E2DDD5',
                borderRadius: '8px',
                fontSize: '11px',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className='flex flex-wrap gap-x-3 gap-y-1 mt-1'>
        {data.map((d) => (
          <div key={d.name} className='flex items-center gap-1'>
            <div className='w-2 h-2 rounded-full' style={{ background: d.color }} />
            <span className='text-[10px] text-neutral-muted'>{d.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
