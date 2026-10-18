import React, { useState } from 'react';
import {
  CircleDollarSign,
  CheckCircle,
  AlertCircle,
  CreditCard,
  Check,
  RotateCcw,
} from 'lucide-react';
import { StatusBadge } from '@/components/Common/StatusBadge';
import { EmptyState } from '@/components/Common/EmptyState';
import { CopyButton } from '@/components/Common/CopyButton';
import type { PaymentWithDetails, PaymentStatus } from '@/types/database';
import { updatePaymentStatus } from '@/lib/api';

interface PaymentsViewProps {
  payments: PaymentWithDetails[];
  searchQuery: string;
  onRefresh: () => void;
}

export const PaymentsView: React.FC<PaymentsViewProps> = ({
  payments,
  searchQuery,
  onRefresh,
}) => {
  const [statusFilter, setStatusFilter] = useState<'all' | PaymentStatus>('all');
  const [submitting, setSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Compute real totals from DB records
  const totalCollected = payments
    .filter((p) => p.payment_status === 'paid')
    .reduce((acc, p) => acc + p.amount, 0);

  const pendingAmount = payments
    .filter((p) => p.payment_status === 'pending')
    .reduce((acc, p) => acc + p.amount, 0);

  const paidCount = payments.filter((p) => p.payment_status === 'paid').length;

  // Filter payments with multi-field search and status combining
  const filteredPayments = payments.filter((p) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      (p.customer_name || '').toLowerCase().includes(q) ||
      (p.vehicle || '').toLowerCase().includes(q) ||
      (p.station_name || '').toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q) ||
      (p.session_id ? p.session_id.toLowerCase().includes(q) : false) ||
      (p.booking_id ? p.booking_id.toLowerCase().includes(q) : false);
    const matchesStatus = statusFilter === 'all' || p.payment_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleSimulatePayment = async (paymentId: string, targetStatus: PaymentStatus) => {
    setSubmitting(true);
    setActionError(null);
    const res = await updatePaymentStatus(paymentId, targetStatus);
    setSubmitting(false);

    if (res.error) {
      setActionError(res.error);
    } else {
      setActionSuccess(`Payment status successfully updated to "${targetStatus.toUpperCase()}" in database.`);
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
          <span className="header-kicker">Financial Ledger</span>
          <h2>Payment Transactions</h2>
          <p>Inspect payment records linked to completed charging sessions and bookings.</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>
            Verified Collections
          </span>
          <strong style={{ fontSize: '18px', color: 'var(--text-primary)', fontWeight: 600 }}>
            ₹{totalCollected.toLocaleString('en-IN')}
          </strong>
        </div>
      </div>

      {/* Financial Summary Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-topline">
            <span className="stat-icon mint">
              <CircleDollarSign size={15} />
            </span>
            <span className="stat-badge">
              {paidCount} Settled
            </span>
          </div>
          <div className="stat-value">₹{totalCollected.toLocaleString('en-IN')}</div>
          <div className="stat-label">Total Realized Revenue</div>
          <div className="stat-detail">Aggregated from PostgreSQL payments table</div>
        </div>

        <div className="stat-card">
          <div className="stat-topline">
            <span className="stat-icon orange">
              <CreditCard size={15} />
            </span>
          </div>
          <div className="stat-value">₹{pendingAmount.toLocaleString('en-IN')}</div>
          <div className="stat-label">Pending Invoices</div>
          <div className="stat-detail">Awaiting driver payment simulation</div>
        </div>

        <div className="stat-card">
          <div className="stat-topline">
            <span className="stat-icon blue">
              <CheckCircle size={15} />
            </span>
          </div>
          <div className="stat-value">
            {payments.length > 0 ? Math.round((paidCount / payments.length) * 100) : 100}%
          </div>
          <div className="stat-label">Collection Rate</div>
          <div className="stat-detail">Paid transactions vs total generated</div>
        </div>

        <div className="stat-card">
          <div className="stat-topline">
            <span className="stat-icon rose">
              <RotateCcw size={15} />
            </span>
          </div>
          <div className="stat-value">
            {payments.filter((p) => p.payment_status === 'refunded').length}
          </div>
          <div className="stat-label">Refunds / Chargebacks</div>
          <div className="stat-detail">Processed reversal records</div>
        </div>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <button
          className={`filter-chip ${statusFilter === 'all' ? 'active' : ''}`}
          onClick={() => setStatusFilter('all')}
        >
          All Transactions <b>({payments.length})</b>
        </button>
        <button
          className={`filter-chip ${statusFilter === 'paid' ? 'active' : ''}`}
          onClick={() => setStatusFilter('paid')}
        >
          Paid <b>({payments.filter((p) => p.payment_status === 'paid').length})</b>
        </button>
        <button
          className={`filter-chip ${statusFilter === 'pending' ? 'active' : ''}`}
          onClick={() => setStatusFilter('pending')}
        >
          Pending <b>({payments.filter((p) => p.payment_status === 'pending').length})</b>
        </button>
        <button
          className={`filter-chip ${statusFilter === 'failed' ? 'active' : ''}`}
          onClick={() => setStatusFilter('failed')}
        >
          Failed <b>({payments.filter((p) => p.payment_status === 'failed').length})</b>
        </button>
        <button
          className={`filter-chip ${statusFilter === 'refunded' ? 'active' : ''}`}
          onClick={() => setStatusFilter('refunded')}
        >
          Refunded <b>({payments.filter((p) => p.payment_status === 'refunded').length})</b>
        </button>
      </div>

      {/* Payments Table */}
      <div className="panel">
        {filteredPayments.length === 0 ? (
          <EmptyState
            title="No payment records found"
            description={
              searchQuery
                ? `No transactions match "${searchQuery}".`
                : 'No payments currently registered in this filter.'
            }
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Transaction ID</th>
                  <th>Customer & EV</th>
                  <th>Station</th>
                  <th>Date & Time</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th>Status</th>
                  <th>Simulation Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <code
                          style={{
                            fontSize: '11px',
                            color: 'var(--text-muted)',
                            background: 'var(--bg-surface-sunken)',
                            padding: '2px 5px',
                            borderRadius: '4px',
                          }}
                        >
                          {p.id.slice(0, 8)}...
                        </code>
                        <CopyButton text={p.id} title="Copy full transaction ID" size={10} />
                      </div>
                    </td>
                    <td>
                      <strong style={{ color: 'var(--text-primary)' }}>{p.customer_name}</strong>
                      <small style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{p.vehicle}</small>
                    </td>
                    <td>
                      <span style={{ color: 'var(--text-secondary)' }}>{p.station_name}</span>
                    </td>
                    <td>
                      <span style={{ fontSize: '12px' }}>
                        {new Date(p.payment_date).toLocaleString([], {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <strong style={{ color: 'var(--text-primary)', fontSize: '13px' }}>
                        ₹{p.amount.toLocaleString('en-IN')}
                      </strong>
                    </td>
                    <td>
                      <StatusBadge status={p.payment_status} />
                    </td>
                    <td>
                      {p.payment_status === 'pending' ? (
                        <button
                          className="primary-button"
                          style={{ padding: '4px 10px', fontSize: '11px' }}
                          title="Simulate payment gateway confirmation"
                          disabled={submitting}
                          onClick={() => handleSimulatePayment(p.id, 'paid')}
                        >
                          <Check size={12} /> Mark as Paid
                        </button>
                      ) : p.payment_status === 'paid' ? (
                        <button
                          className="secondary-button"
                          style={{ padding: '4px 8px', fontSize: '11px', color: 'var(--text-muted)' }}
                          title="Simulate refunding payment"
                          disabled={submitting}
                          onClick={() => handleSimulatePayment(p.id, 'refunded')}
                        >
                          Refund
                        </button>
                      ) : (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Settled</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
