import React, { useState } from 'react';
import {
  CarFront,
  PlusCircle,
  CheckCircle,
  AlertCircle,
  Phone,
  Mail,
  BatteryCharging,
} from 'lucide-react';
import { Modal } from '@/components/Common/Modal';
import { EmptyState } from '@/components/Common/EmptyState';
import { CopyButton } from '@/components/Common/CopyButton';
import type { Customer, Vehicle } from '@/types/database';
import { createCustomerWithVehicle } from '@/lib/api';

interface CustomersViewProps {
  customers: Customer[];
  vehicles: Vehicle[];
  searchQuery: string;
  onRefresh: () => void;
}

export const CustomersView: React.FC<CustomersViewProps> = ({
  customers,
  vehicles,
  searchQuery,
  onRefresh,
}) => {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [batteryCapacity, setBatteryCapacity] = useState(60);

  const handleAddCustomerWithVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !vehicleNumber.trim() || !vehicleModel.trim()) {
      setActionError('Name, vehicle registration number, and model are required.');
      return;
    }
    if (batteryCapacity <= 0) {
      setActionError('Battery capacity must be greater than 0 kWh.');
      return;
    }

    setSubmitting(true);
    setActionError(null);

    const res = await createCustomerWithVehicle({
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      vehicle_number: vehicleNumber.trim(),
      vehicle_model: vehicleModel.trim(),
      battery_capacity: Number(batteryCapacity),
    });

    setSubmitting(false);
    if (res.error) {
      setActionError(res.error);
    } else {
      setActionSuccess(`Customer "${res.data?.customer.name}" and EV "${res.data?.vehicle.vehicle_model}" created successfully.`);
      setIsAddOpen(false);
      setName('');
      setPhone('');
      setEmail('');
      setVehicleNumber('');
      setVehicleModel('');
      setBatteryCapacity(60);
      onRefresh();
      setTimeout(() => setActionSuccess(null), 5000);
    }
  };

  // Filter customers and linked vehicles by search query
  const filteredCustomers = customers.filter((c) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const custVehicles = vehicles.filter((v) => v.customer_id === c.id);
    const matchesCustomer =
      c.name.toLowerCase().includes(q) ||
      (c.phone && c.phone.toLowerCase().includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      c.id.toLowerCase().includes(q);
    const matchesVehicle = custVehicles.some(
      (v) =>
        v.vehicle_model.toLowerCase().includes(q) ||
        v.vehicle_number.toLowerCase().includes(q)
    );
    return matchesCustomer || matchesVehicle;
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
          <span className="header-kicker">Driver Directory & Fleet</span>
          <h2>Customers & Registered EVs</h2>
          <p>Inspect customer accounts and 1-to-many linked electric vehicles.</p>
        </div>
        <button className="primary-button" onClick={() => setIsAddOpen(true)}>
          <PlusCircle size={16} /> Register Customer & EV
        </button>
      </div>

      {/* Customer Directory Table */}
      <div className="panel">
        <div className="panel-heading">
          <div>
            <span className="panel-kicker">Relational Entity</span>
            <h3>Customer Profiles & Vehicles (1 : N Relationship)</h3>
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {filteredCustomers.length} of {customers.length} customer(s)
          </span>
        </div>

        {filteredCustomers.length === 0 ? (
          <EmptyState
            title={searchQuery ? 'No customer or EV records match' : 'No customers registered'}
            description={
              searchQuery
                ? `No customer or vehicle records found matching "${searchQuery}".`
                : 'Add your first customer and linked electric vehicle.'
            }
            actionText="Register Customer & EV"
            onAction={() => setIsAddOpen(true)}
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Customer Name</th>
                  <th>Contact Details</th>
                  <th>Linked EV(s) (vehicles table)</th>
                  <th>Registration No.</th>
                  <th>Battery Capacity</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((c) => {
                  const custVehicles = vehicles.filter((v) => v.customer_id === c.id);

                  return (
                    <tr key={c.id}>
                      <td>
                        <strong style={{ color: 'var(--text-primary)', fontSize: '14px' }}>
                          {c.name}
                        </strong>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <small style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
                            ID: {c.id.slice(0, 8)}...
                          </small>
                          <CopyButton text={c.id} title="Copy customer ID" size={10} />
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '12px' }}>
                          {c.phone && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <Phone size={11} style={{ color: 'var(--text-muted)' }} /> {c.phone}
                              <CopyButton text={c.phone} title="Copy phone number" size={10} />
                            </span>
                          )}
                          {c.email && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--text-muted)' }}>
                              <Mail size={11} /> {c.email}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        {custVehicles.length === 0 ? (
                          <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                            No vehicle linked
                          </span>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {custVehicles.map((v) => (
                              <div
                                key={v.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  fontSize: '12px',
                                  color: 'var(--text-primary)',
                                }}
                              >
                                <CarFront size={13} style={{ color: 'var(--accent-teal)' }} />
                                <strong>{v.vehicle_model}</strong>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td>
                        {custVehicles.map((v) => (
                          <code
                            key={v.id}
                            style={{
                              display: 'inline-block',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: 'var(--bg-surface-sunken)',
                              fontSize: '11px',
                              color: 'var(--accent-teal)',
                              marginBottom: '2px',
                            }}
                          >
                            {v.vehicle_number}
                          </code>
                        ))}
                      </td>
                      <td>
                        {custVehicles.map((v) => (
                          <span
                            key={v.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '12px',
                            }}
                          >
                            <BatteryCharging size={13} style={{ color: 'var(--status-info)' }} />
                            <span>{v.battery_capacity} kWh</span>
                          </span>
                        ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* REGISTER MODAL */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Register Customer & Electric Vehicle"
        kicker="1 : N Relational Record"
      >
        <form onSubmit={handleAddCustomerWithVehicle}>
          <div className="form-group">
            <label className="form-label">Full Name *</label>
            <input
              className="form-input"
              placeholder="e.g. Vikram Singhania"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-split">
            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input
                className="form-input"
                placeholder="+91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                className="form-input"
                type="email"
                placeholder="vikram@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div style={{ margin: '18px 0 12px', borderTop: '1px solid var(--border-subtle)', paddingTop: '14px' }}>
            <span className="header-kicker">Vehicle Relational Entity (vehicles table)</span>
          </div>

          <div className="form-split">
            <div className="form-group">
              <label className="form-label">EV Model *</label>
              <input
                className="form-input"
                placeholder="e.g. Tata Nexon EV Max"
                value={vehicleModel}
                onChange={(e) => setVehicleModel(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">License Plate *</label>
              <input
                className="form-input"
                placeholder="e.g. MH 12 EV 9901"
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Battery Capacity (kWh) *</label>
            <input
              type="number"
              className="form-input"
              min="10"
              max="200"
              step="0.1"
              value={batteryCapacity}
              onChange={(e) => setBatteryCapacity(Number(e.target.value))}
              required
            />
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => setIsAddOpen(false)}
            >
              Cancel
            </button>
            <button type="submit" className="primary-button" disabled={submitting}>
              {submitting ? 'Registering...' : 'Save Customer & Vehicle'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
