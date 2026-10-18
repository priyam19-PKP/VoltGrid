import React, { useState, useEffect } from 'react';
import {
  PlusCircle,
  MapPin,
  Edit2,
  Trash2,
  Layers,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  PowerOff,
  Loader2,
} from 'lucide-react';
import { StatusBadge } from '@/components/Common/StatusBadge';
import { Modal } from '@/components/Common/Modal';
import { EmptyState } from '@/components/Common/EmptyState';
import { CopyButton } from '@/components/Common/CopyButton';
import type { ChargingStation, ChargingSlot, StationStatus } from '@/types/database';
import {
  createStation,
  updateStation,
  deleteStation,
  fetchSlotsForStation,
  updateSlotStatus,
  checkStationDependencies,
  type StationDependencies,
} from '@/lib/api';

interface StationsViewProps {
  stations: ChargingStation[];
  searchQuery: string;
  onRefresh: () => void;
  isAddModalOpen: boolean;
  onCloseAddModal: () => void;
  onOpenAddModal: () => void;
}

export const StationsView: React.FC<StationsViewProps> = ({
  stations,
  searchQuery,
  onRefresh,
  isAddModalOpen,
  onCloseAddModal,
  onOpenAddModal,
}) => {
  const [statusFilter, setStatusFilter] = useState<'all' | StationStatus>('all');
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Add Station Form State
  const [newStation, setNewStation] = useState({
    name: '',
    location: '',
    total_slots: 6,
    power_output: '180 kW',
    status: 'online' as StationStatus,
  });

  // Edit Station State
  const [editingStation, setEditingStation] = useState<ChargingStation | null>(null);

  // Manage Slots State
  const [inspectingStation, setInspectingStation] = useState<ChargingStation | null>(null);
  const [stationSlots, setStationSlots] = useState<ChargingSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Delete Station Confirmation State
  const [deletingStation, setDeletingStation] = useState<ChargingStation | null>(null);
  const [deleteModalError, setDeleteModalError] = useState<string | null>(null);
  const [dependencyLoading, setDependencyLoading] = useState(false);
  const [dependencies, setDependencies] = useState<StationDependencies | null>(null);
  const [dependencyError, setDependencyError] = useState<string | null>(null);

  // Inspect relational dependencies whenever a station is selected for deletion
  useEffect(() => {
    if (!deletingStation) {
      setDependencies(null);
      setDependencyError(null);
      setDeleteModalError(null);
      setDependencyLoading(false);
      return;
    }

    let isMounted = true;
    setDependencyLoading(true);
    setDependencies(null);
    setDependencyError(null);
    setDeleteModalError(null);

    const check = async () => {
      const res = await checkStationDependencies(deletingStation.id);
      if (!isMounted) return;
      setDependencyLoading(false);
      if (res.error) {
        setDependencyError(res.error);
      } else {
        setDependencies(res.data);
      }
    };

    void check();

    return () => {
      isMounted = false;
    };
  }, [deletingStation]);

  // Filter stations by search and status
  const cleanQuery = searchQuery.trim().toLowerCase();
  const filteredStations = stations.filter((st) => {
    const matchesSearch =
      !cleanQuery ||
      st.name.toLowerCase().includes(cleanQuery) ||
      st.location.toLowerCase().includes(cleanQuery) ||
      st.power_output.toLowerCase().includes(cleanQuery) ||
      st.id.toLowerCase().includes(cleanQuery);

    const matchesStatus = statusFilter === 'all' || st.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Handlers
  const handleCreateStation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStation.name.trim() || !newStation.location.trim()) {
      setActionError('Station name and location are required fields.');
      return;
    }
    if (newStation.total_slots < 1) {
      setActionError('Total slots must be at least 1.');
      return;
    }

    setSubmitting(true);
    setActionError(null);
    const res = await createStation({
      name: newStation.name,
      location: newStation.location,
      total_slots: Number(newStation.total_slots),
      available_slots: Number(newStation.total_slots),
      power_output: newStation.power_output,
      utilization: 0,
      status: newStation.status,
    });

    setSubmitting(false);
    if (res.error) {
      setActionError(res.error);
    } else {
      setActionSuccess(`Station "${res.data?.name}" created with ${newStation.total_slots} initial slots.`);
      setNewStation({
        name: '',
        location: '',
        total_slots: 6,
        power_output: '180 kW',
        status: 'online',
      });
      onCloseAddModal();
      onRefresh();
      setTimeout(() => setActionSuccess(null), 5000);
    }
  };

  const handleUpdateStation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStation) return;
    if (!editingStation.name.trim() || !editingStation.location.trim()) {
      setActionError('Station name and location cannot be empty.');
      return;
    }

    setSubmitting(true);
    setActionError(null);
    const res = await updateStation(editingStation.id, {
      name: editingStation.name,
      location: editingStation.location,
      power_output: editingStation.power_output,
      status: editingStation.status,
    });

    setSubmitting(false);
    if (res.error) {
      setActionError(res.error);
    } else {
      setActionSuccess(`Station "${editingStation.name}" updated successfully.`);
      setEditingStation(null);
      onRefresh();
      setTimeout(() => setActionSuccess(null), 5000);
    }
  };

  const handleDeleteStation = async () => {
    if (!deletingStation) return;
    setSubmitting(true);
    setDeleteModalError(null);

    const res = await deleteStation(deletingStation.id);
    setSubmitting(false);
    if (res.error) {
      // Keep modal open and display error INSIDE the modal
      setDeleteModalError(res.error);
    } else {
      setActionSuccess(`Station "${deletingStation.name}" deleted from database.`);
      setDeletingStation(null);
      setDeleteModalError(null);
      onRefresh();
      setTimeout(() => setActionSuccess(null), 5000);
    }
  };

  const handleMarkOfflineInstead = async () => {
    if (!deletingStation) return;
    setSubmitting(true);
    setDeleteModalError(null);

    const res = await updateStation(deletingStation.id, { status: 'offline' });
    setSubmitting(false);
    if (res.error) {
      setDeleteModalError(res.error);
    } else {
      setActionSuccess(`Station "${deletingStation.name}" has been placed Offline to preserve historical records.`);
      setDeletingStation(null);
      setDeleteModalError(null);
      onRefresh();
      setTimeout(() => setActionSuccess(null), 5000);
    }
  };

  const handleInspectSlots = async (st: ChargingStation) => {
    setInspectingStation(st);
    setLoadingSlots(true);
    const res = await fetchSlotsForStation(st.id);
    setLoadingSlots(false);
    if (res.data) {
      setStationSlots(res.data);
    }
  };

  const handleToggleSlotStatus = async (slot: ChargingSlot) => {
    if (!inspectingStation) return;
    const nextStatus = slot.status === 'available' ? 'occupied' : 'available';
    const res = await updateSlotStatus(slot.id, nextStatus, inspectingStation.id);
    if (res.data) {
      setStationSlots((prev) =>
        prev.map((s) => (s.id === slot.id ? { ...s, status: nextStatus } : s))
      );
      onRefresh();
    }
  };

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
          <span className="header-kicker">Infrastructure Management</span>
          <h2>Charging Stations</h2>
          <p>Inspect, add, and monitor station hardware, capacity, and connector health.</p>
        </div>
        <button className="primary-button" onClick={onOpenAddModal}>
          <PlusCircle size={16} /> Add Station
        </button>
      </div>

      {/* Filter Chips */}
      <div className="filter-bar">
        <button
          className={`filter-chip ${statusFilter === 'all' ? 'active' : ''}`}
          onClick={() => setStatusFilter('all')}
        >
          All Stations <b>({stations.length})</b>
        </button>
        <button
          className={`filter-chip ${statusFilter === 'online' ? 'active' : ''}`}
          onClick={() => setStatusFilter('online')}
        >
          Online <b>({stations.filter((s) => s.status === 'online').length})</b>
        </button>
        <button
          className={`filter-chip ${statusFilter === 'maintenance' ? 'active' : ''}`}
          onClick={() => setStatusFilter('maintenance')}
        >
          Maintenance <b>({stations.filter((s) => s.status === 'maintenance').length})</b>
        </button>
        <button
          className={`filter-chip ${statusFilter === 'offline' ? 'active' : ''}`}
          onClick={() => setStatusFilter('offline')}
        >
          Offline <b>({stations.filter((s) => s.status === 'offline').length})</b>
        </button>
      </div>

      {/* Stations Data Table */}
      <div className="panel">
        <div className="panel-heading">
          <div>
            <span className="panel-kicker">Network Fleet</span>
            <h3>Registered Stations ({filteredStations.length})</h3>
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {filteredStations.length} of {stations.length} total stations
          </span>
        </div>

        {filteredStations.length === 0 ? (
          <EmptyState
            title="No charging stations found"
            description={
              cleanQuery
                ? `No stations match your search "${cleanQuery}".`
                : 'No charging stations currently registered in this filter.'
            }
            actionText="Add Charging Station"
            onAction={onOpenAddModal}
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Station</th>
                  <th>Location</th>
                  <th>Power Output</th>
                  <th>Total Slots</th>
                  <th>Availability & Load</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStations.map((station) => {
                  const util =
                    station.total_slots > 0
                      ? Math.round(((station.total_slots - station.available_slots) / station.total_slots) * 100)
                      : 0;

                  return (
                    <tr key={station.id}>
                      <td>
                        <strong style={{ color: 'var(--text-primary)', display: 'block' }}>
                          {station.name}
                        </strong>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <small style={{ color: 'var(--text-muted)', fontSize: '11px', fontFamily: 'monospace' }}>
                            {station.id.slice(0, 8)}...
                          </small>
                          <CopyButton text={station.id} title="Copy full station ID" size={10} />
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <MapPin size={12} style={{ color: 'var(--text-muted)' }} />
                          <span>{station.location}</span>
                        </div>
                      </td>
                      <td>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                          {station.power_output}
                        </span>
                      </td>
                      <td>
                        <span>{station.total_slots} bays</span>
                      </td>
                      <td>
                        <div style={{ minWidth: '130px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '3px' }}>
                            <span style={{ color: station.available_slots > 0 ? 'var(--status-online)' : 'var(--status-danger)' }}>
                              {station.available_slots} / {station.total_slots} avail
                            </span>
                            <span style={{ color: 'var(--text-muted)' }}>{util}%</span>
                          </div>
                          <div className="progress-track" style={{ height: '3px' }}>
                            <div
                              className="progress-bar"
                              style={{
                                width: `${util}%`,
                                background:
                                  station.status !== 'online'
                                    ? 'var(--status-warning)'
                                    : util > 85
                                    ? 'var(--status-danger)'
                                    : 'var(--accent-primary)',
                              }}
                            />
                          </div>
                        </div>
                      </td>
                      <td>
                        <StatusBadge status={station.status} />
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                          <button
                            className="secondary-button"
                            style={{ padding: '4px 8px', fontSize: '11px' }}
                            onClick={() => handleInspectSlots(station)}
                            title="Inspect & toggle individual bays"
                          >
                            <Layers size={12} /> Slots
                          </button>
                          <button
                            className="icon-button"
                            style={{ width: '28px', height: '28px' }}
                            title="Edit Station Details"
                            onClick={() => setEditingStation(station)}
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            className="icon-button"
                            style={{ width: '28px', height: '28px', color: 'var(--status-danger)' }}
                            title="Delete Station"
                            onClick={() => {
                              setDeletingStation(station);
                              setDeleteModalError(null);
                            }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: ADD STATION */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={onCloseAddModal}
        title="Add Charging Station"
        kicker="New Infrastructure"
      >
        <form onSubmit={handleCreateStation}>
          <div className="form-group">
            <label className="form-label">Station Name *</label>
            <input
              className="form-input"
              placeholder="e.g. Metro Express Hub"
              value={newStation.name}
              onChange={(e) => setNewStation({ ...newStation, name: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Location / Landmark *</label>
            <input
              className="form-input"
              placeholder="e.g. Bandra West · Highway Bay 4"
              value={newStation.location}
              onChange={(e) => setNewStation({ ...newStation, location: e.target.value })}
              required
            />
          </div>

          <div className="form-split">
            <div className="form-group">
              <label className="form-label">Total Slots (Physical Bays) *</label>
              <input
                className="form-input"
                type="number"
                min="1"
                max="32"
                value={newStation.total_slots}
                onChange={(e) => setNewStation({ ...newStation, total_slots: Number(e.target.value) })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Power Output *</label>
              <select
                className="form-select"
                value={newStation.power_output}
                onChange={(e) => setNewStation({ ...newStation, power_output: e.target.value })}
              >
                <option value="60 kW">60 kW DC Fast</option>
                <option value="120 kW">120 kW Supercharge</option>
                <option value="180 kW">180 kW Ultra Rapid</option>
                <option value="240 kW">240 kW Hyper Charge</option>
                <option value="360 kW">360 kW Mega Hub</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Initial Operational Status</label>
            <select
              className="form-select"
              value={newStation.status}
              onChange={(e) => setNewStation({ ...newStation, status: e.target.value as StationStatus })}
            >
              <option value="online">Online & Active</option>
              <option value="maintenance">Under Maintenance</option>
              <option value="offline">Offline / Standby</option>
            </select>
          </div>

          <div className="form-actions">
            <button type="button" className="secondary-button" onClick={onCloseAddModal}>
              Cancel
            </button>
            <button type="submit" className="primary-button" disabled={submitting}>
              {submitting ? 'Creating Station...' : 'Create Station'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: EDIT STATION */}
      <Modal
        isOpen={Boolean(editingStation)}
        onClose={() => setEditingStation(null)}
        title="Edit Charging Station"
        kicker="Update Details"
      >
        {editingStation && (
          <form onSubmit={handleUpdateStation}>
            <div className="form-group">
              <label className="form-label">Station Name</label>
              <input
                className="form-input"
                value={editingStation.name}
                onChange={(e) => setEditingStation({ ...editingStation, name: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Location</label>
              <input
                className="form-input"
                value={editingStation.location}
                onChange={(e) => setEditingStation({ ...editingStation, location: e.target.value })}
                required
              />
            </div>

            <div className="form-split">
              <div className="form-group">
                <label className="form-label">Total Slots (Hardware Bays)</label>
                <input
                  className="form-input"
                  type="number"
                  value={editingStation.total_slots}
                  readOnly
                  disabled
                  style={{ opacity: 0.65, cursor: 'not-allowed' }}
                />
                <small style={{ color: 'var(--text-muted)', fontSize: '10px', display: 'block', marginTop: '3px' }}>
                  Hardware bay capacity is fixed upon installation.
                </small>
              </div>
              <div className="form-group">
                <label className="form-label">Power Rating</label>
                <input
                  className="form-input"
                  value={editingStation.power_output}
                  onChange={(e) => setEditingStation({ ...editingStation, power_output: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Operational Status</label>
              <select
                className="form-select"
                value={editingStation.status}
                onChange={(e) =>
                  setEditingStation({
                    ...editingStation,
                    status: e.target.value as StationStatus,
                  })
                }
              >
                <option value="online">Online</option>
                <option value="maintenance">Maintenance</option>
                <option value="offline">Offline</option>
              </select>
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setEditingStation(null)}
              >
                Cancel
              </button>
              <button type="submit" className="primary-button" disabled={submitting}>
                {submitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* MODAL: VIEW & MANAGE SLOTS */}
      <Modal
        isOpen={Boolean(inspectingStation)}
        onClose={() => setInspectingStation(null)}
        title={`Slots: ${inspectingStation?.name}`}
        kicker="Charging Connectors"
        maxWidth="600px"
      >
        <div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '16px' }}>
            Individual connectors at this station. Click a slot's status to toggle availability.
          </p>

          {loadingSlots ? (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
              Loading slots from database...
            </div>
          ) : stationSlots.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
              No individual slot records configured for this station.
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Slot Label</th>
                    <th>Charger Type</th>
                    <th>Power Rating</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {stationSlots.map((slot) => (
                    <tr key={slot.id}>
                      <td>
                        <strong style={{ color: 'var(--text-primary)' }}>{slot.slot_label}</strong>
                      </td>
                      <td>{slot.charger_type}</td>
                      <td>{slot.power_rating}</td>
                      <td>
                        <StatusBadge status={slot.status} />
                      </td>
                      <td>
                        <button
                          className="secondary-button"
                          style={{ padding: '4px 8px', fontSize: '11px' }}
                          onClick={() => handleToggleSlotStatus(slot)}
                        >
                          Mark {slot.status === 'available' ? 'Occupied' : 'Available'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="form-actions" style={{ marginTop: '20px' }}>
            <button
              type="button"
              className="primary-button"
              onClick={() => setInspectingStation(null)}
            >
              Done
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL: CONFIRM DELETE STATION */}
      <Modal
        isOpen={Boolean(deletingStation)}
        onClose={() => {
          setDeletingStation(null);
          setDeleteModalError(null);
        }}
        title="Delete Charging Station"
        kicker="Database Deletion & Referential Integrity"
        maxWidth="520px"
      >
        <div>
          {/* Station Summary Identity Card */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '8px',
              background: 'var(--bg-surface-sunken)',
              border: '1px solid var(--border-subtle)',
              marginBottom: '16px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ color: 'var(--text-primary)', fontSize: '15px' }}>
                {deletingStation?.name}
              </strong>
              <StatusBadge status={deletingStation?.status || 'online'} />
            </div>
            <div style={{ display: 'flex', gap: '14px', color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <MapPin size={12} /> {deletingStation?.location}
              </span>
              <span>{deletingStation?.power_output}</span>
              <span>{deletingStation?.total_slots} bays</span>
            </div>
          </div>

          {/* Dependency Checking Indicator */}
          {dependencyLoading && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 14px',
                borderRadius: '8px',
                background: 'rgba(59, 130, 246, 0.08)',
                border: '1px solid rgba(59, 130, 246, 0.2)',
                color: 'var(--text-secondary)',
                fontSize: '12px',
                marginBottom: '16px',
              }}
            >
              <Loader2 size={16} className="animate-spin" style={{ color: '#3b82f6', flexShrink: 0 }} />
              <span>Inspecting database foreign-key dependencies (bookings, slots, maintenance)...</span>
            </div>
          )}

          {/* Dependency Check Error */}
          {dependencyError && !dependencyLoading && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: '8px',
                background: 'rgba(234, 179, 8, 0.1)',
                border: '1px solid rgba(234, 179, 8, 0.25)',
                color: '#eab308',
                fontSize: '12px',
                marginBottom: '16px',
                lineHeight: '1.4',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, marginBottom: '2px' }}>
                <AlertTriangle size={15} /> Dependency Pre-Check Incomplete
              </div>
              <div style={{ color: 'var(--text-secondary)' }}>
                {dependencyError}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '4px' }}>
                PostgreSQL server-side foreign-key constraints will still prevent invalid deletion.
              </div>
            </div>
          )}

          {/* Contextual Dependency Status */}
          {dependencies && !dependencyLoading && (
            <>
              {!dependencies.canDelete ? (
                /* Blocked by bookings (ON DELETE RESTRICT) */
                <div
                  style={{
                    padding: '14px',
                    borderRadius: '8px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    color: 'var(--text-primary)',
                    fontSize: '12px',
                    marginBottom: '16px',
                    lineHeight: '1.5',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--status-danger)', fontWeight: 600, marginBottom: '6px' }}>
                    <AlertTriangle size={16} /> Physical Deletion Restricted (ON DELETE RESTRICT)
                  </div>
                  <p style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    This station is referenced by <strong>{dependencies.bookingCount} active or historical booking(s)</strong>. PostgreSQL foreign key constraints preserve billing ledger and session audit integrity.
                  </p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '11px', marginBottom: '12px' }}>
                    Recommended alternative: Set this station to <strong>Offline</strong> to decommission it from the network while retaining audit compliance.
                  </p>
                  <button
                    type="button"
                    className="secondary-button"
                    style={{ width: '100%', justifyContent: 'center', gap: '6px' }}
                    onClick={handleMarkOfflineInstead}
                    disabled={submitting}
                  >
                    <PowerOff size={14} /> Mark Station as Offline Instead
                  </button>
                </div>
              ) : (
                /* Eligible for deletion (ON DELETE CASCADE on slots/maintenance) */
                <div
                  style={{
                    padding: '14px',
                    borderRadius: '8px',
                    background: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                    color: 'var(--text-primary)',
                    fontSize: '12px',
                    marginBottom: '16px',
                    lineHeight: '1.5',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-teal)', fontWeight: 600, marginBottom: '6px' }}>
                    <CheckCircle size={16} /> Eligible for Physical Deletion
                  </div>
                  <p style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    No bookings reference this station.
                  </p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                    Confirming deletion will permanently delete this station along with its <strong>{dependencies.slotCount} connector bay(s)</strong>{dependencies.maintenanceCount > 0 ? ` and ${dependencies.maintenanceCount} maintenance record(s)` : ''} via PostgreSQL <code>ON DELETE CASCADE</code>.
                  </p>
                </div>
              )}
            </>
          )}

          {/* Delete Mutation Error (if API call fails) */}
          {deleteModalError && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid var(--status-danger)',
                color: 'var(--text-primary)',
                fontSize: '12px',
                marginBottom: '16px',
                lineHeight: '1.5',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--status-danger)', fontWeight: 600, marginBottom: '4px' }}>
                <AlertCircle size={15} /> Deletion Failed
              </div>
              <div>{deleteModalError}</div>
              {deleteModalError.toLowerCase().includes('foreign key') && (
                <div style={{ marginTop: '10px' }}>
                  <button
                    type="button"
                    className="secondary-button"
                    style={{ width: '100%', justifyContent: 'center', gap: '6px' }}
                    onClick={handleMarkOfflineInstead}
                    disabled={submitting}
                  >
                    <PowerOff size={14} /> Mark Station as Offline Instead
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="form-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setDeletingStation(null);
                setDeleteModalError(null);
              }}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="danger-button"
              onClick={handleDeleteStation}
              disabled={
                submitting ||
                dependencyLoading ||
                (dependencies !== null && !dependencies.canDelete)
              }
              title={
                dependencies && !dependencies.canDelete
                  ? 'Deletion blocked: station has dependent bookings'
                  : 'Permanently delete station'
              }
            >
              {submitting ? 'Verifying & Deleting...' : 'Delete Station'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
