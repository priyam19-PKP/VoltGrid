import React from 'react';
import {
  Gauge,
  Activity,
  CircleDollarSign,
  BatteryCharging,
  CarFront,
  Zap,
} from 'lucide-react';
import { StatCard } from '@/components/Common/StatCard';
import type {
  ChargingStation,
  Booking,
  PaymentWithDetails,
  ChargingSession,
  Vehicle,
} from '@/types/database';

interface AnalyticsViewProps {
  stations: ChargingStation[];
  bookings: Booking[];
  payments: PaymentWithDetails[];
  sessions: ChargingSession[];
  vehicles: Vehicle[];
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  stations,
  bookings,
  payments,
  sessions,
  vehicles,
}) => {
  // Real database-derived aggregations (GROUP BY & AGGREGATE functions)

  // 1. Revenue calculations
  const totalRevenue = payments
    .filter((p) => p.payment_status === 'paid')
    .reduce((acc, p) => acc + p.amount, 0);

  const pendingRevenue = payments
    .filter((p) => p.payment_status === 'pending')
    .reduce((acc, p) => acc + p.amount, 0);

  const avgRevenuePerSession =
    payments.length > 0 ? Math.round(totalRevenue / payments.length) : 0;

  // 2. Energy delivery
  const totalEnergyKWh = sessions.reduce((acc, s) => acc + Number(s.units_consumed || 0), 0);
  const avgEnergyPerSession =
    sessions.length > 0 ? (totalEnergyKWh / sessions.length).toFixed(1) : '0';

  // 3. Bookings grouped by status (SQL: SELECT status, COUNT(*) FROM bookings GROUP BY status)
  const bookingStatusCounts: Record<string, number> = {};
  bookings.forEach((b) => {
    bookingStatusCounts[b.status] = (bookingStatusCounts[b.status] || 0) + 1;
  });

  // 4. Vehicle distribution (SQL: SELECT vehicle_model, COUNT(*) FROM vehicles GROUP BY vehicle_model)
  const vehicleModelCounts: Record<string, number> = {};
  vehicles.forEach((v) => {
    vehicleModelCounts[v.vehicle_model] = (vehicleModelCounts[v.vehicle_model] || 0) + 1;
  });
  const topVehicles = Object.entries(vehicleModelCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // 5. Station Ranking by Booking Count (SQL: SELECT station_name, COUNT(*) FROM bookings GROUP BY station_name)
  const stationBookingCounts: Record<string, number> = {};
  bookings.forEach((b) => {
    stationBookingCounts[b.station_name] = (stationBookingCounts[b.station_name] || 0) + 1;
  });

  return (
    <div className="space-y-6">
      <div className="page-view-header">
        <div>
          <span className="header-kicker">Network Intelligence</span>
          <h2>Aggregated Network Analytics</h2>
          <p>
            Computed directly from PostgreSQL database records via aggregate queries (<code>SUM</code>,{' '}
            <code>COUNT</code>, <code>AVG</code>, <code>GROUP BY</code>).
          </p>
        </div>
      </div>

      {/* Aggregate Stats */}
      <div className="stats-grid">
        <StatCard
          label="Realized Revenue"
          value={`₹${totalRevenue.toLocaleString('en-IN')}`}
          detail={`From ${payments.filter((p) => p.payment_status === 'paid').length} settled payment records`}
          icon={CircleDollarSign}
          accent="mint"
        />
        <StatCard
          label="Total Energy Delivered"
          value={`${totalEnergyKWh} kWh`}
          detail={`Avg ${avgEnergyPerSession} kWh across ${sessions.length} recorded sessions`}
          icon={BatteryCharging}
          accent="blue"
        />
        <StatCard
          label="Average Ticket Size"
          value={`₹${avgRevenuePerSession}`}
          detail="Calculated per payment record"
          icon={Gauge}
          accent="orange"
        />
        <StatCard
          label="Registered Fleet Size"
          value={vehicles.length}
          detail="EVs registered across customer profiles"
          icon={CarFront}
          accent="rose"
        />
      </div>

      {/* Grid: Station Load & Booking Status Breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
        {/* Booking Distribution by Status */}
        <div className="panel">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">SQL GROUP BY Status</span>
              <h3>Bookings Breakdown by State</h3>
            </div>
            <Activity size={18} style={{ color: 'var(--accent-teal)' }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '10px' }}>
            {['confirmed', 'charging', 'upcoming', 'completed', 'cancelled'].map((status) => {
              const count = bookingStatusCounts[status] || 0;
              const pct = bookings.length > 0 ? Math.round((count / bookings.length) * 100) : 0;

              return (
                <div key={status}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '12px',
                      marginBottom: '4px',
                    }}
                  >
                    <span style={{ textTransform: 'capitalize', color: 'var(--text-primary)', fontWeight: 500 }}>
                      {status}
                    </span>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      <strong>{count}</strong> ({pct}%)
                    </span>
                  </div>
                  <div className="progress-track" style={{ height: '4px' }}>
                    <div
                      className="progress-bar"
                      style={{
                        width: `${pct}%`,
                        background:
                          status === 'charging'
                            ? 'var(--status-warning)'
                            : status === 'cancelled'
                            ? 'var(--status-danger)'
                            : status === 'completed'
                            ? 'var(--status-info)'
                            : 'var(--accent-primary)',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Station Popularity Ranking */}
        <div className="panel">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">Station Demand</span>
              <h3>Bookings Distribution by Station</h3>
            </div>
            <Zap size={18} style={{ color: 'var(--accent-teal)' }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '10px' }}>
            {stations.map((st, index) => {
              const count = stationBookingCounts[st.name] || 0;
              const pct = bookings.length > 0 ? Math.round((count / bookings.length) * 100) : 0;

              return (
                <div
                  key={st.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '8px 12px',
                    background: 'var(--bg-surface-sunken)',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>
                    0{index + 1}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                      <strong style={{ color: 'var(--text-primary)' }}>{st.name}</strong>
                      <span style={{ color: 'var(--accent-teal)' }}>{count} bookings</span>
                    </div>
                    <div className="progress-track" style={{ marginTop: '5px' }}>
                      <div className="progress-bar" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Vehicle Model Distribution & Financial Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
        {/* EV Model Distribution */}
        <div className="panel">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">Fleet Profiling</span>
              <h3>Registered EV Models</h3>
            </div>
            <CarFront size={18} style={{ color: 'var(--status-info)' }} />
          </div>

          {topVehicles.length === 0 ? (
            <div style={{ padding: '20px', color: 'var(--text-muted)', textAlign: 'center' }}>
              No vehicles registered yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {topVehicles.map(([model, count]) => {
                const pct = vehicles.length > 0 ? Math.round((count / vehicles.length) * 100) : 0;
                return (
                  <div
                    key={model}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      background: 'var(--bg-surface-sunken)',
                      borderRadius: '8px',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{model}</strong>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '13px', color: 'var(--accent-teal)', fontWeight: 600 }}>
                        {count} EV(s)
                      </span>
                      <small style={{ display: 'block', fontSize: '10px', color: 'var(--text-muted)' }}>
                        {pct}% of fleet
                      </small>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Revenue Status Distribution */}
        <div className="panel">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">Financial Distribution</span>
              <h3>Receivables & Settlements</h3>
            </div>
            <CircleDollarSign size={18} style={{ color: 'var(--status-online)' }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '10px' }}>
            <div
              style={{
                padding: '14px',
                borderRadius: '8px',
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Settled Collections
                </span>
                <strong style={{ display: 'block', fontSize: '18px', color: 'var(--accent-teal)' }}>
                  ₹{totalRevenue.toLocaleString('en-IN')}
                </strong>
              </div>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                {payments.filter((p) => p.payment_status === 'paid').length} invoices
              </span>
            </div>

            <div
              style={{
                padding: '14px',
                borderRadius: '8px',
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.2)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Pending Invoices
                </span>
                <strong style={{ display: 'block', fontSize: '18px', color: 'var(--status-warning)' }}>
                  ₹{pendingRevenue.toLocaleString('en-IN')}
                </strong>
              </div>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                {payments.filter((p) => p.payment_status === 'pending').length} invoices
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
