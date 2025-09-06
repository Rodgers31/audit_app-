/**
 * Status badge component for audit reports
 */
import { getStatusBadges } from './auditUtils';

interface StatusBadgeProps {
  auditStatus: string;
}

export default function StatusBadge({ auditStatus }: StatusBadgeProps) {
  const badges = getStatusBadges();
  const badge = badges[auditStatus as keyof typeof badges] || badges.pending;

  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${badge.bg} ${badge.text_color} ${badge.border}`}>
      {badge.text}
    </span>
  );
}
