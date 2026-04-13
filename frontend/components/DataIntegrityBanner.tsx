'use client';

import { AlertTriangle, Info, ShieldAlert } from 'lucide-react';

type Severity = 'info' | 'warning' | 'error';

interface DataIntegrityBannerProps {
  /** Short human-readable explanation shown to the user. */
  message?: string;
  /** Controls colour / icon. Defaults to 'warning'. */
  severity?: Severity;
  /** Optional className for layout overrides. */
  className?: string;
  /** Compact single-line mode (default false = block banner). */
  inline?: boolean;
}

const SEVERITY_STYLES: Record<Severity, { bg: string; border: string; text: string; icon: React.ElementType }> = {
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-800',
    icon: Info,
  },
  warning: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-800',
    icon: AlertTriangle,
  },
  error: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-800',
    icon: ShieldAlert,
  },
};

/**
 * Banner displayed when data is unavailable, unverified, or partially loaded.
 * Use this instead of silently falling back to fabricated placeholder values.
 */
export default function DataIntegrityBanner({
  message = 'Live data is currently unavailable. Figures shown may be incomplete.',
  severity = 'warning',
  className = '',
  inline = false,
}: DataIntegrityBannerProps) {
  const s = SEVERITY_STYLES[severity];
  const Icon = s.icon;

  if (inline) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 text-xs ${s.text} ${className}`}
        role="status"
      >
        <Icon size={14} className="flex-shrink-0" />
        <span>{message}</span>
      </span>
    );
  }

  return (
    <div
      className={`flex items-start gap-3 rounded-xl border p-3 ${s.bg} ${s.border} ${className}`}
      role="status"
    >
      <Icon size={18} className={`flex-shrink-0 mt-0.5 ${s.text}`} />
      <p className={`text-sm leading-relaxed ${s.text}`}>{message}</p>
    </div>
  );
}
