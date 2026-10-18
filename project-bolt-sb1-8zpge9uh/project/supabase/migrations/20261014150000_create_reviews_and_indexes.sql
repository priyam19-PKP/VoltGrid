/*
  # Forward Migration: Reviews Table and Performance Indexes
  
  Academic Subject: Advanced Data Management (ADM) - MSBTE Diploma AI/ML
  Purpose:
    1. Creates the `reviews` table with referential integrity (foreign keys to `customers` and `charging_stations`).
    2. Adds CHECK constraint on `rating` (1 to 5 stars).
    3. Enables Row Level Security (RLS) with policies for anon and authenticated users.
    4. Creates B-Tree performance indexes on foreign keys and frequently filtered columns (demonstrating Indexing in ADM).
    5. Inserts starter review records linking existing customer and station entities.
*/

-- 1. Create Reviews Table
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  station_id uuid NOT NULL REFERENCES charging_stations(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shared_select_reviews ON reviews;
CREATE POLICY shared_select_reviews ON reviews FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS shared_insert_reviews ON reviews;
CREATE POLICY shared_insert_reviews ON reviews FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS shared_update_reviews ON reviews;
CREATE POLICY shared_update_reviews ON reviews FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS shared_delete_reviews ON reviews;
CREATE POLICY shared_delete_reviews ON reviews FOR DELETE TO anon, authenticated USING (true);

-- 3. B-Tree Performance Indexes for Foreign Keys and Query Optimization (ADM Indexing Concept)
CREATE INDEX IF NOT EXISTS idx_vehicles_customer_id ON vehicles(customer_id);
CREATE INDEX IF NOT EXISTS idx_charging_slots_station_id ON charging_slots(station_id);
CREATE INDEX IF NOT EXISTS idx_bookings_customer_id ON bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_station_id ON bookings(station_id);
CREATE INDEX IF NOT EXISTS idx_bookings_slot_id ON bookings(slot_id);
CREATE INDEX IF NOT EXISTS idx_bookings_date_status ON bookings(booking_date, status);
CREATE INDEX IF NOT EXISTS idx_charging_sessions_booking_id ON charging_sessions(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_session_id ON payments(session_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_station_id ON maintenance(station_id);
CREATE INDEX IF NOT EXISTS idx_reviews_station_id ON reviews(station_id);
CREATE INDEX IF NOT EXISTS idx_reviews_customer_id ON reviews(customer_id);

-- 4. Starter Review Records (Demonstration Data)
INSERT INTO reviews (id, customer_id, station_id, rating, comment, created_at) VALUES
  (
    '90000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002',
    '30000000-0000-0000-0000-000000000001',
    5,
    'Fastest charging stop on my daily route. Slot was reserved and activated immediately upon arrival.',
    now() - interval '2 hours'
  ),
  (
    '90000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000002',
    5,
    'Ultra-fast 240 kW CCS2 charger delivered from 20% to 80% in 22 minutes. Very clean hub and clear signage.',
    now() - interval '1 day'
  ),
  (
    '90000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000004',
    '30000000-0000-0000-0000-000000000001',
    4,
    'Reliable charging experience. Booking was seamless. Would appreciate adding a coffee vending machine near bay A.',
    now() - interval '3 days'
  ),
  (
    '90000000-0000-0000-0000-000000000004',
    '10000000-0000-0000-0000-000000000003',
    '30000000-0000-0000-0000-000000000002',
    4,
    'Smooth payment settlement and live status tracking in the dashboard. Will use again.',
    now() - interval '5 days'
  )
ON CONFLICT (id) DO NOTHING;
