import React, { useState } from 'react';
import {
  PlusCircle,
  CheckCircle,
  AlertCircle,
  Calendar,
  CheckCheck,
} from 'lucide-react';
import { StatusBadge } from '@/components/Common/StatusBadge';
import { Modal } from '@/components/Common/Modal';
import { EmptyState } from '@/components/Common/EmptyState';
import type { MaintenanceRecord, ChargingStation } from '@/types/database';
import { scheduleMaintenance, completeMaintenance } from '@/lib/api';

interface MaintenanceViewProps {
  records: MaintenanceRecord[];
  stations: ChargingStation[];
  searchQuery: string;
  onRefresh: () => void;
}

export const MaintenanceView: React.FC<MaintenanceViewProps> = ({
  records,
  stations,
  searchQuery,
  onRefresh,
}) => {
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Form State
  const [stationId, setStationId] = useState(stations[0]?.id || '');
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 16));
  const [endDate, setEndDate] = useState('');

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !stationId) {
      setActionError('Station and title are required fields.');
      return;
    }

    setSubmitting(true);
    setActionError(null);

    const res = await scheduleMaintenance({
      station_id: stationId,
      title: title.trim(),
      scheduled_start: new Date(startDate).toISOString(),
      scheduled_end: endDate ? new Date(endDate).toISOString() : null,
    });

    setSubmitting(false);
    if (res.error) {
      setActionError(res.error);
    } else {
      setActionSuccess(`Maintenance scheduled. Station status set to "maintenance".`);
      setIsScheduleOpen(false);
      setTitle('');
      onRefresh();
      setTimeout(() => setActionSuccess(null), 5000);
    }
  };

  const handleComplete = async (rec: MaintenanceRecord) => {
    setSubmitting(true);
    setActionError(null);
    const res = await completeMaintenance(rec.id, rec.station_id);
    setSubmitting(false);

    if (res.error) {
      setActionError(res.error);
    } else {
      setActionSuccess(`Maintenance completed. Station restored to "online" status.`);
      onRefresh();
      setTimeout(() => setActionSuccess(null), 5000);
    }
  };

  // Filter records by search query
  const filteredRecords = records.filter((rec) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (rec.title || '').toLowerCase().includes(q) ||
      (rec.station_name ? rec.station_name.toLowerCase().includes(q) : false) ||
      (rec.station_location ? rec.station_location.toLowerCase().includes(q) : false) ||
      (rec.status || '').toLowerCase().includes(q)
    );
  });

  return (
    <div>
      {/* Notifications */}
      {actionSuccess && (
        <div className="form-success" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle size={16} />
          <span>{actionSuccess}</span>
        </div>
      )}
      {actionError && (
        <div className="form-error" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={16} />
          <span>{actionError}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="page-view-header">
        <div>
          <span className="header-kicker">Network Reliability</span>
          <h2>Station Maintenance</h2>
          <p>Schedule hardware servicing, firmware upgrades, and inspect active work orders.</p>
        </div>
        <button className="primary-button" onClick={() => setIsScheduleOpen(true)}>
          <PlusCircle size={16} /> Schedule Maintenance
        </button>
      </div>

      {/* Maintenance Table */}
      <div className="panel">
        <div className="panel-heading">
          <div>
            <span className="panel-kicker">Database Records</span>
            <h3>Maintenance Work Orders</h3>
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {filteredRecords.length} of {records.length} record(s) logged
          </span>
        </div>

        {filteredRecords.length === 0 ? (
          <EmptyState
            title={searchQuery ? 'No maintenance tasks match' : 'No maintenance tasks scheduled'}
            description={
              searchQuery
                ? `No work orders found matching "${searchQuery}".`
                : 'All charging stations are currently running in normal operational mode.'
            }
            actionText="Schedule Maintenance"
            onAction={() => setIsScheduleOpen(true)}
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Station Target</th>
                  <th>Task Description</th>
                  <th>Scheduled Window</th>
                  <th>Current Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((rec) => (
                  <tr key={rec.id}>
                    <td>
                      <strong style={{ color: 'var(--text-primary)' }}>{rec.station_name}</strong>
                      <small style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                        {rec.station_location}
                      </small>
                    </td>
                    <td>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                        {rec.title}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}>
                        <Calendar size={12} style={{ color: 'var(--text-muted)' }} />
                        <span>
                          {new Date(rec.scheduled_start).toLocaleString([], {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </span>
                      </div>
                      {rec.scheduled_end && (
                        <small style={{ display: 'block', color: 'var(--text-muted)', fontSize: '10px', marginTop: '2px' }}>
                          Ends:{' '}
                          {new Date(rec.scheduled_end).toLocaleString([], {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </small>
                      )}
                    </td>
                    <td>
                      <StatusBadge status={rec.status} />
                    </td>
                    <td>
                      {rec.status !== 'completed' ? (
                        <button
                          className="primary-button"
                          style={{ padding: '4px 10px', fontSize: '11px' }}
                          disabled={submitting}
                          onClick={() => handleComplete(rec)}
                          title="Complete task and return station to online"
                        >
                          <CheckCheck size={13} /> Mark Completed
                        </button>
                      ) : (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Finished</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SCHEDULE MODAL */}
      <Modal
        isOpen={isScheduleOpen}
        onClose={() => setIsScheduleOpen(false)}
        title="Schedule Station Maintenance"
        kicker="Work Order"
      >
        <form onSubmit={handleSchedule}>
          <div className="form-group">
            <label className="form-label">Station *</label>
            <select
              className="form-select"
              value={stationId}
              onChange={(e) => setStationId(e.target.value)}
              required
            >
              {stations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.location})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Maintenance Title / Purpose *</label>
            <input
              className="form-input"
              placeholder="e.g. CCS2 Connector Replacement & Firmware Flash"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="form-split">
            <div className="form-group">
              <label className="form-label">Scheduled Start *</label>
              <input
                type="datetime-local"
                className="form-input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Scheduled End (Optional)</label>
              <input
                type="datetime-local"
                className="form-input"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'rgba(251, 146, 60, 0.1)',
              border: '1px solid rgba(251, 146, 60, 0.3)',
              color: '#fb923c',
              fontSize: '12px',
              marginBottom: '16px',
            }}
          >
            <strong>ADM Workflow Note:</strong> Scheduling maintenance will automatically update the target station's operational status to <code>maintenance</code> in PostgreSQL.
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => setIsScheduleOpen(false)}
            >
              Cancel
            </button>
            <button type="submit" className="primary-button" disabled={submitting}>
              {submitting ? 'Scheduling...' : 'Confirm Schedule'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
