import React from 'react';

export const SkeletonText: React.FC<{
  width?: string;
  height?: string;
  className?: string;
  style?: React.CSSProperties;
}> = ({ width = '100%', height = '14px', className = '', style }) => {
  return (
    <div
      className={`skeleton-box ${className}`}
      style={{ width, height, ...style }}
      aria-hidden="true"
    />
  );
};

export const SkeletonKpiCard: React.FC = () => {
  return (
    <div className="stat-card skeleton-stat-card" aria-hidden="true">
      <div className="stat-topline">
        <div className="skeleton-box" style={{ width: '28px', height: '28px', borderRadius: 'var(--radius-sm)' }} />
        <div className="skeleton-box" style={{ width: '48px', height: '18px', borderRadius: 'var(--radius-sm)' }} />
      </div>
      <div className="skeleton-box" style={{ width: '60%', height: '24px', margin: '6px 0 4px', borderRadius: '4px' }} />
      <div className="skeleton-box" style={{ width: '45%', height: '14px', marginBottom: '8px', borderRadius: '3px' }} />
      <div className="skeleton-box" style={{ width: '75%', height: '11px', marginTop: 'auto', borderRadius: '3px' }} />
    </div>
  );
};

export const SkeletonTableRow: React.FC<{ columns: number }> = ({ columns }) => {
  return (
    <tr className="skeleton-table-row" aria-hidden="true">
      {Array.from({ length: columns }).map((_, idx) => (
        <td key={idx}>
          <div
            className="skeleton-box"
            style={{
              width: idx === 0 ? '70%' : idx === columns - 1 ? '40%' : '55%',
              height: '14px',
              borderRadius: '3px',
            }}
          />
        </td>
      ))}
    </tr>
  );
};

export const SkeletonTable: React.FC<{ rows?: number; columns?: number }> = ({
  rows = 5,
  columns = 6,
}) => {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {Array.from({ length: columns }).map((_, idx) => (
              <th key={idx}>
                <div
                  className="skeleton-box"
                  style={{ width: '60px', height: '11px', borderRadius: '2px' }}
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIdx) => (
            <SkeletonTableRow key={rowIdx} columns={columns} />
          ))}
        </tbody>
      </table>
    </div>
  );
};
