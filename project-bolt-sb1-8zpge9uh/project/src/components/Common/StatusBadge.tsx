import React from 'react';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '' }) => {
  const normalized = status?.toLowerCase().replace(/\s+/g, '_') || 'unknown';

  const formatLabel = (val: string) => {
    return val
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <span className={`status-pill ${normalized} ${className}`}>
      <i />
      <span>{formatLabel(normalized)}</span>
    </span>
  );
};
