import React from 'react';
import {
  LayoutDashboard,
  MapPin,
  CalendarDays,
  CircleDollarSign,
  Star,
  Gauge,
  Wrench,
  Users,
  Database,
  Zap,
} from 'lucide-react';
import type { DbConnectionStatus } from './Header';

export type NavItemKey =
  | 'Overview'
  | 'Stations'
  | 'Bookings'
  | 'Payments'
  | 'Reviews'
  | 'Maintenance'
  | 'Customers'
  | 'Analytics'
  | 'Database';

interface SidebarProps {
  activeNav: NavItemKey;
  onSelectNav: (key: NavItemKey) => void;
  isOpen: boolean;
  onCloseMobile: () => void;
  bookingCount?: number;
  dbStatus: DbConnectionStatus;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeNav,
  onSelectNav,
  isOpen,
  onCloseMobile,
  bookingCount = 0,
  dbStatus,
}) => {
  const operationsNav = [
    { key: 'Overview' as NavItemKey, label: 'Overview', icon: LayoutDashboard },
    { key: 'Stations' as NavItemKey, label: 'Stations', icon: MapPin },
    { key: 'Bookings' as NavItemKey, label: 'Bookings', icon: CalendarDays, count: bookingCount },
    { key: 'Payments' as NavItemKey, label: 'Payments', icon: CircleDollarSign },
    { key: 'Reviews' as NavItemKey, label: 'Reviews', icon: Star },
  ];

  const managementNav = [
    { key: 'Maintenance' as NavItemKey, label: 'Maintenance', icon: Wrench },
    { key: 'Customers' as NavItemKey, label: 'Customers & EVs', icon: Users },
    { key: 'Analytics' as NavItemKey, label: 'Analytics', icon: Gauge },
    { key: 'Database' as NavItemKey, label: 'Database Explorer', icon: Database },
  ];

  const handleNavClick = (key: NavItemKey) => {
    onSelectNav(key);
    onCloseMobile();
  };

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="brand" style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '0 4px 16px' }}>
        <img
          src="/voltgrid-logo.jpg"
          alt="VoltGrid Logo"
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '6px',
            objectFit: 'cover',
            border: '1px solid var(--border-medium)',
            flexShrink: 0,
          }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <span className="brand-font" style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: '1.1' }}>
            Volt<span style={{ color: 'var(--accent-primary)' }}>Grid</span>
          </span>
          <span style={{ fontSize: '9px', letterSpacing: '0.04em', color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '2px', whiteSpace: 'nowrap' }}>
            Clean Energy Grid
          </span>
        </div>
      </div>

      <div className="workspace-badge">
        <div className="workspace-badge-avatar">
          <Zap size={12} fill="currentColor" />
        </div>
        <div>
          <strong style={{ fontSize: '11px', display: 'block', color: 'var(--text-primary)', fontWeight: 600 }}>
            EV Network Fleet
          </strong>
          <small style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            Enterprise Operations
          </small>
        </div>
      </div>

      <div className="nav-section-title">Network Operations</div>
      <nav className="nav-list">
        {operationsNav.map(({ key, label, icon: Icon, count }) => (
          <button
            key={key}
            className={`nav-item ${activeNav === key ? 'active' : ''}`}
            onClick={() => handleNavClick(key)}
          >
            <Icon size={15} />
            <span>{label}</span>
            {count !== undefined && count > 0 && <span className="nav-count">{count}</span>}
          </button>
        ))}
      </nav>

      <div className="nav-section-title">Infrastructure & Data</div>
      <nav className="nav-list">
        {managementNav.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            className={`nav-item ${activeNav === key ? 'active' : ''}`}
            onClick={() => handleNavClick(key)}
          >
            <Icon size={15} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <div className="db-status-card">
          <div className="db-status-header">
            <span
              className={`pulse-dot ${
                dbStatus === 'connected'
                  ? ''
                  : dbStatus === 'connecting'
                  ? 'warning'
                  : 'danger'
              }`}
            />
            <span>
              {dbStatus === 'connected'
                ? 'PostgreSQL Connected'
                : dbStatus === 'connecting'
                ? 'Connecting to DB...'
                : dbStatus === 'demo'
                ? 'Demo Mode (Offline)'
                : 'Connection Error'}
            </span>
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
            {dbStatus === 'connected'
              ? 'Supabase Cloud RLS Active'
              : dbStatus === 'connecting'
              ? 'Verifying handshake'
              : 'Check API configuration'}
          </div>
        </div>
      </div>
    </aside>
  );
};
