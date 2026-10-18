import React, { useState } from 'react';
import {
  Star,
  PlusCircle,
  CheckCircle,
  AlertCircle,
  Database,
  ArrowUpRight,
} from 'lucide-react';
import { Modal } from '@/components/Common/Modal';
import { EmptyState } from '@/components/Common/EmptyState';
import type { Review, Customer, ChargingStation } from '@/types/database';
import { createReview } from '@/lib/api';

interface ReviewsViewProps {
  reviews: Review[];
  customers: Customer[];
  stations: ChargingStation[];
  searchQuery: string;
  needsMigration: boolean;
  onRefresh: () => void;
  onNavigateToDocs: () => void;
}

export const ReviewsView: React.FC<ReviewsViewProps> = ({
  reviews,
  customers,
  stations,
  searchQuery,
  needsMigration,
  onRefresh,
  onNavigateToDocs,
}) => {
  const [selectedRatingFilter, setSelectedRatingFilter] = useState<number | 'all'>('all');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Form State
  const [formCustomerId, setFormCustomerId] = useState(customers[0]?.id || '');
  const [formStationId, setFormStationId] = useState(stations[0]?.id || '');
  const [formRating, setFormRating] = useState(5);
  const [formComment, setFormComment] = useState('');

  // Rating aggregations (Honest: no fabricated 5.0 fallback when empty)
  const totalReviews = reviews.length;
  const avgRating =
    totalReviews > 0
      ? (reviews.reduce((acc, r) => acc + r.rating, 0) / totalReviews).toFixed(1)
      : '—';

  const ratingCounts: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  reviews.forEach((r) => {
    if (ratingCounts[r.rating] !== undefined) ratingCounts[r.rating]++;
  });

  // Filter with search query and star rating
  const filteredReviews = reviews.filter((r) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      r.customer_name?.toLowerCase().includes(q) ||
      r.station_name?.toLowerCase().includes(q) ||
      r.comment?.toLowerCase().includes(q);
    const matchesRating = selectedRatingFilter === 'all' || r.rating === selectedRatingFilter;
    return matchesSearch && matchesRating;
  });

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formComment.trim()) {
      setActionError('Please provide a review comment.');
      return;
    }

    setSubmitting(true);
    setActionError(null);

    const res = await createReview({
      customer_id: formCustomerId || customers[0].id,
      station_id: formStationId || stations[0].id,
      rating: formRating,
      comment: formComment,
    });

    setSubmitting(false);
    if (res.error) {
      setActionError(res.error);
    } else {
      setActionSuccess('Review submitted and inserted into PostgreSQL database.');
      setIsAddOpen(false);
      setFormComment('');
      onRefresh();
      setTimeout(() => setActionSuccess(null), 5000);
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

      {/* Migration Notice Banner if table not yet run in remote Supabase */}
      {needsMigration && (
        <div
          style={{
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '10px',
            padding: '14px 18px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Database size={20} style={{ color: 'var(--status-info)' }} />
            <div>
              <strong style={{ display: 'block', fontSize: '13px', color: 'var(--text-primary)' }}>
                ADM Forward Migration Prepared: <code>reviews</code> Table
              </strong>
              <small style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>
                To create the table in Supabase, execute{' '}
                <code>supabase/migrations/20261014150000_create_reviews_and_indexes.sql</code> in your
                Supabase SQL Editor. Currently showing starter demonstration reviews.
              </small>
            </div>
          </div>
          <button className="text-button" onClick={onNavigateToDocs} style={{ whiteSpace: 'nowrap' }}>
            View SQL Migration <ArrowUpRight size={14} />
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className="page-view-header">
        <div>
          <span className="header-kicker">Driver Feedback & Experience</span>
          <h2>Customer Reviews</h2>
          <p>Inspect driver ratings, station feedback, and satisfaction metrics.</p>
        </div>
        <button className="primary-button" onClick={() => setIsAddOpen(true)}>
          <PlusCircle size={16} /> Write Review
        </button>
      </div>

      {/* Top Rating Summary Panel */}
      <div className="panel" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '28px', alignItems: 'center' }}>
        <div style={{ textAlign: 'center', paddingRight: '24px', borderRight: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '28px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1 }}>
            {avgRating}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '3px', margin: '8px 0', color: 'var(--status-warning)' }}>
            {Array.from({ length: 5 }, (_, i) => (
              <Star
                key={i}
                size={14}
                fill={i < Math.round(Number(avgRating)) ? 'currentColor' : 'none'}
              />
            ))}
          </div>
          <small style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
            Based on {totalReviews} driver reviews
          </small>
        </div>

        {/* Rating Bars */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {[5, 4, 3, 2, 1].map((stars) => {
            const count = ratingCounts[stars] || 0;
            const pct = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
            return (
              <div
                key={stars}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px' }}
              >
                <span style={{ width: '45px', color: 'var(--text-secondary)' }}>{stars} Stars</span>
                <div className="progress-track" style={{ flex: 1, height: '4px' }}>
                  <div
                    className="progress-bar"
                    style={{ width: `${pct}%`, background: stars >= 4 ? 'var(--accent-primary)' : 'var(--status-warning)' }}
                  />
                </div>
                <span style={{ width: '30px', textAlign: 'right', color: 'var(--text-muted)', fontSize: '11px' }}>
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filter Chips */}
      <div className="filter-bar">
        <button
          className={`filter-chip ${selectedRatingFilter === 'all' ? 'active' : ''}`}
          onClick={() => setSelectedRatingFilter('all')}
        >
          All Reviews <b>({totalReviews})</b>
        </button>
        {[5, 4, 3, 2, 1].map((rating) => (
          <button
            key={rating}
            className={`filter-chip ${selectedRatingFilter === rating ? 'active' : ''}`}
            onClick={() => setSelectedRatingFilter(rating)}
          >
            {rating} Stars <b>({ratingCounts[rating]})</b>
          </button>
        ))}
      </div>

      {/* Reviews Grid */}
      {filteredReviews.length === 0 ? (
        <EmptyState
          title={searchQuery ? 'No reviews match query' : 'No reviews in this rating'}
          description={
            searchQuery
              ? `No driver feedback found matching "${searchQuery}".`
              : 'Try selecting another star rating filter or submit a new review.'
          }
          actionText="Write Review"
          onAction={() => setIsAddOpen(true)}
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {filteredReviews.map((rev) => (
            <div
              key={rev.id}
              className="panel"
              style={{ padding: '18px', display: 'flex', flexDirection: 'column', margin: 0 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <div>
                  <strong style={{ fontSize: '14px', color: 'var(--text-primary)', display: 'block' }}>
                    {rev.customer_name}
                  </strong>
                  <small style={{ color: 'var(--accent-teal)', fontSize: '11px' }}>
                    {rev.station_name}
                  </small>
                </div>
                <div style={{ display: 'flex', gap: '2px', color: '#f59e0b' }}>
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star
                      key={i}
                      size={14}
                      fill={i < rev.rating ? 'currentColor' : 'none'}
                    />
                  ))}
                </div>
              </div>

              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.5', margin: '0 0 16px', flex: 1 }}>
                "{rev.comment}"
              </p>

              <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px', fontSize: '11px', color: 'var(--text-muted)' }}>
                Posted {new Date(rev.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL: WRITE REVIEW */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Submit Driver Feedback"
        kicker="Customer Review"
      >
        <form onSubmit={handleSubmitReview}>
          <div className="form-group">
            <label className="form-label">Reviewing Customer *</label>
            <select
              className="form-select"
              value={formCustomerId}
              onChange={(e) => setFormCustomerId(e.target.value)}
              required
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Charging Station *</label>
            <select
              className="form-select"
              value={formStationId}
              onChange={(e) => setFormStationId(e.target.value)}
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
            <label className="form-label">Rating (1 to 5 Stars) *</label>
            <div style={{ display: 'flex', gap: '10px', margin: '8px 0' }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  type="button"
                  key={star}
                  onClick={() => setFormRating(star)}
                  style={{
                    background: 'transparent',
                    border: 0,
                    padding: '4px',
                    color: star <= formRating ? '#f59e0b' : 'var(--border-medium)',
                  }}
                >
                  <Star size={24} fill={star <= formRating ? 'currentColor' : 'none'} />
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Review Comment *</label>
            <textarea
              className="form-textarea"
              rows={4}
              placeholder="Describe charger speed, connector condition, slot access, cleanliness..."
              value={formComment}
              onChange={(e) => setFormComment(e.target.value)}
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
              {submitting ? 'Submitting...' : 'Post Review'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
