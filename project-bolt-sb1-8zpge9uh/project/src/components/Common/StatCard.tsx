import React from 'react';
import { LucideIcon } from 'lucide-react';
import { AnimatedKpi } from './AnimatedKpi';

interface StatCardProps {
  label: string;
  value: string | number;
  detail: string;
  icon: LucideIcon;
  accent?: 'mint' | 'blue' | 'orange' | 'rose';
  trend?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  detail,
  icon: Icon,
  accent = 'mint',
  trend,
}) => {
  return (
    <div className="stat-card">
      <div className="stat-topline">
        <span className={`stat-icon ${accent}`}>
          <Icon size={15} />
        </span>
        {trend && <span className="stat-badge">{trend}</span>}
      </div>
      <div className="stat-value">
        {typeof value === 'number' ? (
          <AnimatedKpi value={value} />
        ) : typeof value === 'string' && value.startsWith('₹') ? (
          <AnimatedKpi
            value={parseFloat(value.replace(/[^0-9.-]+/g, '')) || 0}
            prefix="₹"
          />
        ) : (
          value
        )}
      </div>
      <div className="stat-label">{label}</div>
      <div className="stat-detail">{detail}</div>
    </div>
  );
};
