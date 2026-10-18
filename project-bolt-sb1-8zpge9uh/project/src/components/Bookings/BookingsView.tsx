import React, { useState, useEffect } from 'react';
import {
  CalendarDays,
  PlusCircle,
  CheckCircle,
  AlertCircle,
  Play,
  CheckCheck,
  XCircle,
  Trash2,
  Clock,
  CarFront,
} from 'lucide-react';
import { StatusBadge } from '@/components/Common/StatusBadge';
import { Modal } from '@/components/Common/Modal';
import { EmptyState } from '@/components/Common/EmptyState';
import { CopyButton } from '@/components/Common/CopyButton';
import type {
  Booking,
  BookingStatus,
  ChargingStation,
  Customer,
  Vehicle,
  ChargingSlot,
} from '@/types/database';
import {
  createBooking,
  updateBookingStatus,
  deleteBooking,
  fetchCustomers,
  fetchVehicles,
  fetchSlotsForStation,
} from '@/lib/api';

interface BookingsViewProps {
  bookings: Booking[];
  stations: ChargingStation[];
  searchQuery: string;
  onRefresh: () => void;
  isNewBookingOpen: boolean;
  onCloseNewBooking: () => void;
  onOpenNewBooking: () => void;
}

export const BookingsView: React.FC<BookingsViewProps> = ({
  bookings,
  stations,
  searchQuery,
  onRefresh,
  isNewBookingOpen,
  onCloseNewBooking,
  onOpenNewBooking,
}) => {
  const [statusFilter, setStatusFilter] = useState<'all' | BookingStatus>('all');
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Relational Form Data loaded from DB
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [availableSlots, setAvailableSlots] = useState<ChargingSlot[]>([]);

  // Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [selectedStationId, setSelectedStationId] = useState('');
  const [selectedSlotId, setSelectedSlotId] = useState('');
  const [bookingDate, setBookingDate] = useState(new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState('11:00');
  const [amount, setAmount] = useState(450);

  // Delete modal state
  const [deletingBooking, setDeletingBooking] = useState<Booking | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Load Customers on mount
  useEffect(() => {
    const loadRelationalData = async () => {
      const [custRes, vehRes] = await Promise.all([fetchCustomers(), fetchVehicles()]);
      if (custRes.data && custRes.data.length > 0) {
        setCustomers(custRes.data);
        setSelectedCustomerId(custRes.data[0].id);
      }
      if (vehRes.data) {
        setVehicles(vehRes.data);
      }
      if (stations.length > 0) {
        const firstOnline = stations.find((s) => s.status === 'online') || stations[0];
        setSelectedStationId(firstOnline.id);
      }
    };
    loadRelationalData();
  }, [stations]);

  // When customer changes, filter vehicles to this customer
  const customerVehicles = vehicles.filter((v) => v.customer_id === selectedCustomerId);
  useEffect(() => {
    const matching = vehicles.filter((v) => v.customer_id === selectedCustomerId);
    if (matching.length > 0) {
      setSelectedVehicleId(matching[0].id);
    } else {
      setSelectedVehicleId('');
    }
  }, [selectedCustomerId, vehicles]);

  // When station changes, fetch real slots from DB
  useEffect(() => {
    if (!selectedStationId) return;
    const loadSlots = async () => {
      const res = await fetchSlotsForStation(selectedStationId);
      if (res.data) {
        const available = res.data.filter((s) => s.status === 'available');
        setAvailableSlots(available);
        if (available.length > 0) {
          setSelectedSlotId(available[0].id);
        } else {
          setSelectedSlotId('');
        }
      }
    };
    loadSlots();
  }, [selectedStationId]);

  // Filter Bookings with multi-field search and status combining
  const filteredBookings = bookings.filter((b) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      b.customer_name?.toLowerCase().includes(q) ||
      b.vehicle?.toLowerCase().includes(q) ||
      b.station_name?.toLowerCase().includes(q) ||
      b.slot_label?.toLowerCase().includes(q) ||
      b.id?.toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'all' || b.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Handlers
  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId || !selectedVehicleId || !selectedStationId || !selectedSlotId) {
      setActionError('Please select a customer, registered EV, station, and available charging bay.');
      return;
    }

    const customerObj = customers.find((c) => c.id === selectedCustomerId);
    const vehicleObj = vehicles.find((v) => v.id === selectedVehicleId);
    const stationObj = stations.find((s) => s.id === selectedStationId);
    const slotObj = availableSlots.find((s) => s.id === selectedSlotId);

    if (!customerObj || !vehicleObj || !stationObj || !slotObj) {
      setActionError('Invalid relational reference. Please ensure an active bay is selected.');
      return;
    }

    setSubmitting(true);
    setActionError(null);

    const res = await createBooking({
      customer_id: customerObj.id,
      vehicle_id: vehicleObj.id,
      station_id: stationObj.id,
      slot_id: slotObj.id,
      customer_name: customerObj.name,
      vehicle: `${vehicleObj.vehicle_model} (${vehicleObj.vehicle_number})`,
      station_name: stationObj.name,
      slot_label: slotObj.slot_label,
      booking_date: bookingDate,
      start_time: startTime,
      amount: Number(amount),
      status: 'confirmed',
    });

    setSubmitting(false);
    if (res.error) {
      setActionError(res.error);
    } else {
      setActionSuccess(`Booking confirmed for ${customerObj.name} at ${stationObj.name} (${slotObj.slot_label}).`);
      onCloseNewBooking();
      onRefresh();
      setTimeout(() => setActionSuccess(null), 5000);
    }
  };

  const handleStatusTransition = async (booking: Booking, newStatus: BookingStatus) => {
    setSubmitting(true);
    setActionError(null);
    const res = await updateBookingStatus(booking.id, newStatus, booking);
    setSubmitting(false);

    if (res.error) {
      setActionError(res.error);
    } else {
      setActionSuccess(`Booking status changed to ${newStatus.toUpperCase()}.`);
      onRefresh();
      setTimeout(() => setActionSuccess(null), 4000);
    }
  };

  const handleDeleteBooking = async () => {
    if (!deletingBooking) return;
    setSubmitting(true);
    setDeleteError(null);
    const res = await deleteBooking(deletingBooking.id);
    setSubmitting(false);

    if (res.error) {
      setDeleteError(res.error);
    } else {
      setActionSuccess('Booking deleted successfully.');
      setDeletingBooking(null);
      setDeleteError(null);
      onRefresh();
      setTimeout(() => setActionSuccess(null), 4000);
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
          <span className="header-kicker">Reservation Operations</span>
          <h2>Network Bookings</h2>
          <p>Manage EV appointments, start charging sessions, and track slot allocations.</p>
        </div>
        <button className="primary-button" onClick={onOpenNewBooking}>
          <PlusCircle size={16} /> New Booking
        </button>
      </div>

      {/* Filter Chips */}
      <div className="filter-bar">
        <button
          className={`filter-chip ${statusFilter === 'all' ? 'active' : ''}`}
          onClick={() => setStatusFilter('all')}
        >
          All Bookings <b>({bookings.length})</b>
        </button>
        <button
          className={`filter-chip ${statusFilter === 'confirmed' ? 'active' : ''}`}
          onClick={() => setStatusFilter('confirmed')}
        >
          Confirmed <b>({bookings.filter((b) => b.status === 'confirmed').length})</b>
        </button>
        <button
          className={`filter-chip ${statusFilter === 'charging' ? 'active' : ''}`}
          onClick={() => setStatusFilter('charging')}
        >
          Charging <b>({bookings.filter((b) => b.status === 'charging').length})</b>
        </button>
        <button
          className={`filter-chip ${statusFilter === 'upcoming' ? 'active' : ''}`}
          onClick={() => setStatusFilter('upcoming')}
        >
          Upcoming <b>({bookings.filter((b) => b.status === 'upcoming').length})</b>
        </button>
        <button
          className={`filter-chip ${statusFilter === 'completed' ? 'active' : ''}`}
          onClick={() => setStatusFilter('completed')}
        >
          Completed <b>({bookings.filter((b) => b.status === 'completed').length})</b>
        </button>
        <button
          className={`filter-chip ${statusFilter === 'cancelled' ? 'active' : ''}`}
          onClick={() => setStatusFilter('cancelled')}
        >
          Cancelled <b>({bookings.filter((b) => b.status === 'cancelled').length})</b>
        </button>
      </div>

      {/* Bookings Table Panel */}
      <div className="panel">
        {filteredBookings.length === 0 ? (
          <EmptyState
            title="No bookings match criteria"
            description={
              searchQuery
                ? `No records found matching "${searchQuery}".`
                : 'No bookings recorded in this category.'
            }
            actionText="Create New Booking"
            onAction={onOpenNewBooking}
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Vehicle Details</th>
                  <th>Station & Connector</th>
                  <th>Schedule</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Lifecycle Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBookings.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <strong style={{ color: 'var(--text-primary)', display: 'block' }}>{b.customer_name}</strong>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <small style={{ color: 'var(--text-muted)', fontSize: '10px', fontFamily: 'monospace' }}>
                          {b.id.slice(0, 8)}...
                        </small>
                        <CopyButton text={b.id} title="Copy booking UUID" size={10} />
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <CarFront size={14} style={{ color: 'var(--accent-teal)' }} />
                        <span>{b.vehicle}</span>
                      </div>
                    </td>
                    <td>
                      <strong style={{ color: 'var(--text-primary)' }}>{b.station_name}</strong>
                      <small style={{ color: 'var(--accent-teal)', fontSize: '11px', display: 'block' }}>
                        {b.slot_label}
                      </small>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <CalendarDays size={12} style={{ color: 'var(--text-muted)' }} />
                        <span>{b.booking_date}</span>
                      </div>
                      <small style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--text-muted)', fontSize: '11px', marginTop: '2px' }}>
                        <Clock size={11} /> {b.start_time}
                      </small>
                    </td>
                    <td>
                      <strong style={{ color: 'var(--text-primary)', fontSize: '14px' }}>
                        ₹{b.amount}
                      </strong>
                    </td>
                    <td>
                      <StatusBadge status={b.status} />
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {/* Status transition shortcuts */}
                        {b.status === 'upcoming' && (
                          <button
                            className="secondary-button"
                            style={{ padding: '4px 8px', fontSize: '11px' }}
                            title="Confirm Booking"
                            onClick={() => handleStatusTransition(b, 'confirmed')}
                          >
                            <CheckCircle size={12} /> Confirm
                          </button>
                        )}
                        {b.status === 'confirmed' && (
                          <button
                            className="primary-button"
                            style={{ padding: '4px 8px', fontSize: '11px' }}
                            title="Start Charging Session"
                            onClick={() => handleStatusTransition(b, 'charging')}
                          >
                            <Play size={12} /> Start Charging
                          </button>
                        )}
                        {b.status === 'charging' && (
                          <button
                            className="primary-button"
                            style={{ padding: '4px 8px', fontSize: '11px' }}
                            title="Complete Charging & Bill"
                            onClick={() => handleStatusTransition(b, 'completed')}
                          >
                            <CheckCheck size={12} /> Complete
                          </button>
                        )}
                        {(b.status === 'upcoming' || b.status === 'confirmed') && (
                          <button
                            className="danger-button"
                            style={{ padding: '4px 8px', fontSize: '11px' }}
                            title="Cancel Booking & Free Slot"
                            onClick={() => handleStatusTransition(b, 'cancelled')}
                          >
                            <XCircle size={12} /> Cancel
                          </button>
                        )}
                        {b.status === 'completed' && (
                          <span
                            style={{
                              fontSize: '11px',
                              color: 'var(--text-muted)',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              background: 'var(--bg-surface-sunken)',
                              border: '1px solid var(--border-subtle)',
                              cursor: 'help',
                            }}
                            title="Completed booking is protected by database referential integrity for billing audit history"
                          >
                            Audit Protected
                          </span>
                        )}
                        {b.status === 'cancelled' && (
                          <button
                            className="icon-button"
                            style={{ width: '28px', height: '28px', color: 'var(--status-danger)' }}
                            title="Delete Cancelled Record"
                            onClick={() => {
                              setDeleteError(null);
                              setDeletingBooking(b);
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: CREATE BOOKING WITH LIVE RELATIONAL INTEGRITY */}
      <Modal
        isOpen={isNewBookingOpen}
        onClose={onCloseNewBooking}
        title="Create EV Charging Booking"
        kicker="Database Insert (Relational)"
        maxWidth="540px"
      >
        <form onSubmit={handleCreateBooking}>
          {/* Customer Selection */}
          <div className="form-group">
            <label className="form-label">Select Customer (customers table) *</label>
            <select
              className="form-select"
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              required
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.phone ? `(${c.phone})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Vehicle Selection - filtered by customer foreign key */}
          <div className="form-group">
            <label className="form-label">Registered EV (vehicles table · FK) *</label>
            {customerVehicles.length === 0 ? (
              <div style={{ color: 'var(--status-warning)', fontSize: '12px', padding: '6px 0' }}>
                No vehicle registered for this customer.
              </div>
            ) : (
              <select
                className="form-select"
                value={selectedVehicleId}
                onChange={(e) => setSelectedVehicleId(e.target.value)}
                required
              >
                {customerVehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.vehicle_model} — {v.vehicle_number} ({v.battery_capacity} kWh)
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Station Selection */}
          <div className="form-group">
            <label className="form-label">Charging Station (charging_stations table) *</label>
            <select
              className="form-select"
              value={selectedStationId}
              onChange={(e) => setSelectedStationId(e.target.value)}
              required
            >
              {stations.map((s) => (
                <option
                  key={s.id}
                  value={s.id}
                  disabled={s.status !== 'online' || s.available_slots < 1}
                >
                  {s.name} ({s.location}) — {s.available_slots} / {s.total_slots} free{' '}
                  {s.status !== 'online' ? `[${s.status.toUpperCase()}]` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Slot Selection - dynamically loaded for station */}
          <div className="form-group">
            <label className="form-label">Available Bay (charging_slots table · FK) *</label>
            {availableSlots.length === 0 ? (
              <div
                style={{
                  color: 'var(--status-warning)',
                  fontSize: '12px',
                  background: 'rgba(234, 179, 8, 0.08)',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid rgba(234, 179, 8, 0.2)',
                }}
              >
                All bays currently occupied or under maintenance. Please select another station.
              </div>
            ) : (
              <select
                className="form-select"
                value={selectedSlotId}
                onChange={(e) => setSelectedSlotId(e.target.value)}
                required
              >
                {availableSlots.map((slot) => (
                  <option key={slot.id} value={slot.id}>
                    {slot.slot_label} ({slot.charger_type} · {slot.power_rating})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Date & Time */}
          <div className="form-split">
            <div className="form-group">
              <label className="form-label">Booking Date *</label>
              <input
                type="date"
                className="form-input"
                min={new Date().toISOString().slice(0, 10)}
                value={bookingDate}
                onChange={(e) => setBookingDate(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Start Time *</label>
              <input
                type="time"
                className="form-input"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Estimated Session Cost (₹)</label>
            <input
              type="number"
              className="form-input"
              min="50"
              step="10"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              required
            />
          </div>

          <div className="form-actions">
            <button type="button" className="secondary-button" onClick={onCloseNewBooking}>
              Cancel
            </button>
            <button
              type="submit"
              className="primary-button"
              disabled={submitting || customerVehicles.length === 0 || availableSlots.length === 0 || !selectedSlotId}
            >
              {submitting ? 'Confirming...' : 'Confirm & Save Booking'}
            </button>
          </div>
        </form>
      </Modal>

      {/* CONFIRM DELETE MODAL WITH IN-MODAL ERROR HANDLING */}
      <Modal
        isOpen={Boolean(deletingBooking)}
        onClose={() => {
          setDeletingBooking(null);
          setDeleteError(null);
        }}
        title="Delete Booking Record"
        kicker="Database Delete (Referential Check)"
      >
        <div>
          {deleteError && (
            <div
              className="form-error"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                marginBottom: '16px',
                padding: '10px 12px',
                fontSize: '12px',
                lineHeight: '1.4',
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ display: 'block', marginBottom: '2px' }}>Deletion Restricted:</strong>
                <span>{deleteError}</span>
              </div>
            </div>
          )}

          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.5', marginBottom: '12px' }}>
            Are you sure you want to delete this booking for{' '}
            <strong style={{ color: 'var(--text-primary)' }}>{deletingBooking?.customer_name}</strong>?
          </p>

          <p style={{ color: 'var(--text-muted)', fontSize: '11px', lineHeight: '1.4', marginBottom: '16px' }}>
            PostgreSQL relational integrity rules protect active sessions and historical payments from being orphaned.
          </p>

          <div className="form-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setDeletingBooking(null);
                setDeleteError(null);
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="danger-button"
              onClick={handleDeleteBooking}
              disabled={submitting}
            >
              {submitting ? 'Deleting...' : 'Delete Booking'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
