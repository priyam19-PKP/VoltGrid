import React from 'react';
import { Menu, X, Search, RefreshCw, Database, AlertCircle, Sun, Moon, Shield, LogOut } from 'lucide-react';
import { NavItemKey } from './Sidebar';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';

export type DbConnectionStatus = 'connected' | 'connecting' | 'error' | 'demo';

interface HeaderProps {
  activeNav: NavItemKey;
  mobileMenuOpen: boolean;
  onToggleMobileMenu: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onRefreshData: () => void;
  isRefreshing?: boolean;
  dbStatus: DbConnectionStatus;
}

export const Header: React.FC<HeaderProps> = ({
  activeNav,
  mobileMenuOpen,
  onToggleMobileMenu,
  searchQuery,
  onSearchChange,
  onRefreshData,
  isRefreshing = false,
  dbStatus,
}) => {
  const { theme, toggleTheme } = useTheme();
  const { user, signOut } = useAuth();

  const titles: Record<NavItemKey, string> = {
    Overview: 'Network Overview',
    Stations: 'Charging Stations',
    Bookings: 'Reservations & Sessions',
    Payments: 'Payment Transactions',
    Reviews: 'Driver Feedback',
    Maintenance: 'Station Maintenance',
    Customers: 'Customers & Registered EVs',
    Analytics: 'Network Analytics',
    Database: 'Database Schema & Query Explorer',
  };

  const searchPlaceholders: Partial<Record<NavItemKey, string>> = {
    Stations: 'Search stations by name, location, power...',
    Bookings: 'Search bookings by customer, vehicle, station...',
    Payments: 'Search payments by customer, ID, vehicle...',
    Customers: 'Search customers by name, phone, email, EV...',
    Maintenance: 'Search maintenance by task, station...',
    Reviews: 'Search reviews by customer, station, comment...',
  };

  const isSearchable = Boolean(searchPlaceholders[activeNav]);

  return (
    <header className="topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          className="icon-button lg:hidden"
          onClick={onToggleMobileMenu}
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? <X size={15} /> : <Menu size={15} />}
        </button>
        <div className="breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <img
            src="/voltgrid-logo.jpg"
            alt="VoltGrid"
            style={{ width: '18px', height: '18px', borderRadius: '3px', objectFit: 'cover' }}
          />
          <span style={{ fontWeight: 600 }}>VoltGrid</span>
          <span style={{ color: 'var(--border-strong)' }}>/</span>
          <strong>{titles[activeNav] || activeNav}</strong>
        </div>
      </div>

      <div className="top-actions">
        {isSearchable ? (
          <div className="search-box">
            <Search size={14} />
            <input
              type="text"
              placeholder={searchPlaceholders[activeNav]}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
        ) : null}

        <button
          className="icon-button"
          onClick={toggleTheme}
          title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
        >
          {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
        </button>

        <button
          className="icon-button"
          onClick={onRefreshData}
          title="Refresh live database records"
          aria-label="Refresh database records"
          disabled={isRefreshing}
        >
          <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
        </button>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '11px',
            padding: '4px 9px',
            borderRadius: 'var(--radius-sm)',
            background:
              dbStatus === 'connected'
                ? 'var(--accent-subtle)'
                : dbStatus === 'connecting'
                ? 'var(--status-warning-bg)'
                : 'var(--status-danger-bg)',
            border: `1px solid ${
              dbStatus === 'connected'
                ? 'var(--accent-border)'
                : dbStatus === 'connecting'
                ? 'var(--status-warning-border)'
                : 'var(--status-danger-border)'
            }`,
            color:
              dbStatus === 'connected'
                ? 'var(--accent-primary)'
                : dbStatus === 'connecting'
                ? 'var(--status-warning)'
                : 'var(--status-danger)',
            fontWeight: 500,
          }}
        >
          {dbStatus === 'error' ? <AlertCircle size={12} /> : <Database size={12} />}
          <span>
            {dbStatus === 'connected'
              ? 'PostgreSQL Live'
              : dbStatus === 'connecting'
              ? 'Connecting...'
              : dbStatus === 'demo'
              ? 'Demo Mode'
              : 'Connection Error'}
          </span>
        </div>

        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderLeft: '1px solid var(--border-medium)', paddingLeft: '8px' }}>
            <span className="admin-badge" title={`Signed in as: ${user.user_metadata?.name || user.email} (${user.user_metadata?.role || user.role || 'Admin'})`}>
              <Shield size={12} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
              <span>{user.user_metadata?.name || user.email || 'Admin'}</span>
              {(user.user_metadata?.role || user.role) && (
                <span style={{ fontSize: '10px', opacity: 0.7, textTransform: 'capitalize' }}>
                  • {user.user_metadata?.role || user.role}
                </span>
              )}
            </span>

            <button
              className="icon-button"
              onClick={() => void signOut()}
              title="Sign Out of Admin Portal"
              aria-label="Sign Out"
              style={{ color: 'var(--status-danger)' }}
            >
              <LogOut size={13} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
