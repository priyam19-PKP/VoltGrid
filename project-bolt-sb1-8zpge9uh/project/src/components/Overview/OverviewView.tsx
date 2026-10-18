import React from 'react';
import {
  PlugZap,
  CalendarDays,
  CircleDollarSign,
  Activity,
  ArrowUpRight,
  AlertTriangle,
  PlusCircle,
} from 'lucide-react';
import { StatCard } from '@/components/Common/StatCard';
import { StatusBadge } from '@/components/Common/StatusBadge';
import type {
  ChargingStation,
  Booking,
  NetworkMetrics,
  MaintenanceRecord,
} from '@/types/database';
import { NavItemKey } from '@/components/Layout/Sidebar';

interface OverviewViewProps {
  metrics: NetworkMetrics;
  stations: ChargingStation[];
  recentBookings: Booking[];
  maintenanceRecords: MaintenanceRecord[];
  onNavigate: (key: NavItemKey) => void;
  onOpenNewBooking: () => void;
  onOpenNewStation: () => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  metrics,
  stations,
  recentBookings,
  maintenanceRecords,
  onNavigate,
  onOpenNewBooking,
  onOpenNewStation,
}) => {
  const activeMaintenance = maintenanceRecords.find(
    (m) => m.status === 'in_progress' || m.status === 'scheduled'
  );

  return (
    <div className="space-y-6">
      {/* Welcome Row & Page Actions */}
      <div className="page-view-header">
        <div>
          <div className="header-kicker" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="pulse-dot" /> Live Network Monitor
          </div>
          <h2>Operational Overview</h2>
          <p>Real-time metrics calculated from PostgreSQL relational records.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="secondary-button" onClick={onOpenNewStation}>
            <PlusCircle size={16} /> Add Station
          </button>
          <button className="primary-button" onClick={onOpenNewBooking}>
            <CalendarDays size={16} /> New Booking
          </button>
        </div>
      </div>

      {/* Computed Real Metrics Cards */}
      <div className="stats-grid">
        <StatCard
          label="Charging Stations"
          value={metrics.totalStations}
          detail={`${metrics.onlineStations} online · ${metrics.maintenanceStations} in maintenance`}
          icon={PlugZap}
          accent="mint"
          trend={`${metrics.uptimePercent}% uptime`}
        />
        <StatCard
          label="Slot Availability"
          value={`${metrics.availableSlots} / ${metrics.totalSlots}`}
          detail={`${metrics.occupiedSlots} slots currently occupied`}
          icon={Activity}
          accent="blue"
        />
        <StatCard
          label="Total Bookings"
          value={metrics.totalBookings}
          detail={`${metrics.activeSessionsCount} active charging session(s)`}
          icon={CalendarDays}
          accent="orange"
        />
        <StatCard
          label="Verified Revenue"
          value={`₹${metrics.totalRevenue.toLocaleString('en-IN')}`}
          detail={`₹${metrics.pendingRevenue.toLocaleString('en-IN')} pending settlement`}
          icon={CircleDollarSign}
          accent="rose"
        />
      </div>

      {/* Active Maintenance Alert If Applicable */}
      {activeMaintenance && (
        <div
          style={{
            background: 'rgba(251, 146, 60, 0.1)',
            border: '1px solid rgba(251, 146, 60, 0.3)',
            borderRadius: '10px',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(251, 146, 60, 0.2)',
                color: '#fb923c',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <AlertTriangle size={18} />
            </div>
            <div>
              <strong style={{ display: 'block', fontSize: '13px', color: 'var(--text-primary)' }}>
                Active Maintenance: {activeMaintenance.title} at {activeMaintenance.station_name}
              </strong>
              <small style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                Status: {activeMaintenance.status.toUpperCase()} · Started:{' '}
                {new Date(activeMaintenance.scheduled_start).toLocaleString([], {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </small>
            </div>
          </div>
          <button className="text-button" onClick={() => onNavigate('Maintenance')}>
            Manage Maintenance <ArrowUpRight size={14} />
          </button>
        </div>
      )}

      {/* Main Grid: Stations Status & Recent Bookings */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
        {/* Station Availability Breakdown */}
        <div className="panel">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">Network Fleet</span>
              <h3>Station Capacity & Utilization</h3>
            </div>
            <button className="text-button" onClick={() => onNavigate('Stations')}>
              All Stations <ArrowUpRight size={14} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {stations.map((st) => {
              const utilPercent =
                st.total_slots > 0
                  ? Math.round(((st.total_slots - st.available_slots) / st.total_slots) * 100)
                  : 0;

              return (
                <div
                  key={st.id}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    background: 'var(--bg-surface-sunken)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '8px',
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: '13px', color: 'var(--text-primary)', display: 'block' }}>
                        {st.name}
                      </strong>
                      <small style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                        {st.location} · {st.power_output}
                      </small>
                    </div>
                    <StatusBadge status={st.status} />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '5px' }}>
                    <span>{st.available_slots} of {st.total_slots} slots available</span>
                    <strong>{utilPercent}% load</strong>
                  </div>

                    <div className="progress-track">
                      <div
                        className="progress-bar"
                        style={{
                          width: `${utilPercent}%`,
                          background:
                            st.status !== 'online'
                              ? 'var(--status-warning)'
                              : utilPercent > 80
                              ? 'var(--status-danger)'
                              : 'var(--accent-primary)',
                        }}
                      />
                    </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Bookings Feed */}
        <div className="panel">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">Live Schedule</span>
              <h3>Recent Bookings</h3>
            </div>
            <button className="text-button" onClick={() => onNavigate('Bookings')}>
              Manage All <ArrowUpRight size={14} />
            </button>
          </div>

          {recentBookings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)' }}>
              No bookings recorded in the database yet.
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Customer & EV</th>
                    <th>Station</th>
                    <th>Schedule</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentBookings.slice(0, 5).map((booking) => (
                    <tr key={booking.id}>
                      <td>
                        <strong style={{ color: 'var(--text-primary)' }}>{booking.customer_name}</strong>
                        <small style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{booking.vehicle}</small>
                      </td>
                      <td>
                        <span style={{ color: 'var(--text-secondary)' }}>{booking.station_name}</span>
                        <small style={{ display: 'block', color: 'var(--text-muted)', fontSize: '10px' }}>
                          {booking.slot_label}
                        </small>
                      </td>
                      <td>
                        <span style={{ fontSize: '12px' }}>{booking.booking_date}</span>
                        <small style={{ display: 'block', color: 'var(--text-muted)', fontSize: '10px' }}>
                          {booking.start_time}
                        </small>
                      </td>
                      <td>
                        <strong style={{ color: 'var(--text-primary)' }}>₹{booking.amount}</strong>
                      </td>
                      <td>
                        <StatusBadge status={booking.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
