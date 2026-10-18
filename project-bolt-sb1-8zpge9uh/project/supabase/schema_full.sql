-- ============================================================================
-- VOLTGRID — COMPLETE SUPABASE POSTGRESQL INITIALIZATION SCRIPT
-- ============================================================================
-- Run this script in your Supabase Project:
-- SQL Editor -> New Query -> Paste Entire Content -> Click "Run"
--
-- This script idempotently initializes:
--   1. All 10 relational tables (customers, vehicles, charging_stations,
--      charging_slots, bookings, charging_sessions, payments, maintenance, reviews,
--      admin_users)
--   2. admin_users authorization table & is_admin() SECURITY DEFINER function
--   3. Foreign key constraints with CASCADE, RESTRICT, and SET NULL protection
--   4. B-Tree performance indexes on foreign keys and filter columns
--   5. Strict Row Level Security (RLS) policies restricted to active administrators
--   6. Starter demonstration operational records with reconciled charging bays
--
-- NOTE: Declarative referential actions (ON DELETE CASCADE, RESTRICT, SET NULL)
-- and PostgreSQL Row Level Security policies are used rather than database triggers.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. EXTENSIONS & SCHEMAS
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 2. CORE RELATIONAL TABLES
-- ----------------------------------------------------------------------------

-- Customers
CREATE TABLE IF NOT EXISTS public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Vehicles (1:N with Customers)
CREATE TABLE IF NOT EXISTS public.vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  vehicle_number text NOT NULL,
  vehicle_model text NOT NULL,
  battery_capacity numeric(8,2) NOT NULL CHECK (battery_capacity > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Charging Stations
CREATE TABLE IF NOT EXISTS public.charging_stations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  location text NOT NULL,
  total_slots integer NOT NULL CHECK (total_slots > 0),
  available_slots integer NOT NULL DEFAULT 0 CHECK (available_slots >= 0),
  power_output text NOT NULL,
  utilization integer NOT NULL DEFAULT 0 CHECK (utilization BETWEEN 0 AND 100),
  status text NOT NULL DEFAULT 'online' CHECK (status IN ('online', 'maintenance', 'offline')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Charging Slots / Bays (1:N with Stations)
CREATE TABLE IF NOT EXISTS public.charging_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES public.charging_stations(id) ON DELETE CASCADE,
  slot_label text NOT NULL,
  charger_type text NOT NULL,
  power_rating text NOT NULL,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'maintenance')),
  UNIQUE (station_id, slot_label)
);

-- Bookings (Relational intersection: Customer, Vehicle, Station, Slot)
CREATE TABLE IF NOT EXISTS public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE RESTRICT,
  station_id uuid NOT NULL REFERENCES public.charging_stations(id) ON DELETE RESTRICT,
  slot_id uuid REFERENCES public.charging_slots(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  vehicle text NOT NULL,
  station_name text NOT NULL,
  slot_label text NOT NULL,
  booking_date date NOT NULL,
  start_time time NOT NULL,
  status text NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'confirmed', 'charging', 'completed', 'cancelled')),
  amount numeric(10,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Charging Sessions (Metering & Duration)
CREATE TABLE IF NOT EXISTS public.charging_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE RESTRICT,
  start_time timestamptz,
  end_time timestamptz,
  units_consumed numeric(10,2) NOT NULL DEFAULT 0 CHECK (units_consumed >= 0),
  amount numeric(10,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled'))
);

-- Payments (Ledger)
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.charging_sessions(id) ON DELETE RESTRICT,
  amount numeric(10,2) NOT NULL CHECK (amount >= 0),
  payment_date timestamptz NOT NULL DEFAULT now(),
  payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded'))
);

-- Maintenance (Hardware Work Orders)
CREATE TABLE IF NOT EXISTS public.maintenance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES public.charging_stations(id) ON DELETE CASCADE,
  title text NOT NULL,
  scheduled_start timestamptz NOT NULL,
  scheduled_end timestamptz,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed'))
);

-- Reviews (Driver Ratings)
CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  station_id uuid NOT NULL REFERENCES public.charging_stations(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Admin Users (Authorization Table linked to auth.users)
CREATE TABLE IF NOT EXISTS public.admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 3. B-TREE PERFORMANCE INDEXES (ADM Query Optimization)
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_vehicles_customer_id ON public.vehicles(customer_id);
CREATE INDEX IF NOT EXISTS idx_charging_slots_station_id ON public.charging_slots(station_id);
CREATE INDEX IF NOT EXISTS idx_bookings_customer_id ON public.bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_station_id ON public.bookings(station_id);
CREATE INDEX IF NOT EXISTS idx_bookings_slot_id ON public.bookings(slot_id);
CREATE INDEX IF NOT EXISTS idx_bookings_date_status ON public.bookings(booking_date, status);
CREATE INDEX IF NOT EXISTS idx_charging_sessions_booking_id ON public.charging_sessions(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_session_id ON public.payments(session_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_station_id ON public.maintenance(station_id);
CREATE INDEX IF NOT EXISTS idx_reviews_station_id ON public.reviews(station_id);
CREATE INDEX IF NOT EXISTS idx_reviews_customer_id ON public.reviews(customer_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_lookup ON public.admin_users(user_id, is_active);

-- ----------------------------------------------------------------------------
-- 4. SECURITY DEFINER IS_ADMIN() FUNCTION & RLS POLICIES
-- ----------------------------------------------------------------------------

-- Enable Row Level Security on all 10 tables
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.charging_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.charging_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.charging_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Authorization Function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE user_id = auth.uid()
      AND is_active = true
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Admin Users Policies:
-- Authenticated users can view their own admin record, or active admins can view all admin records.
-- Client mutations (INSERT, UPDATE, DELETE) are disallowed to prevent self-privilege escalation.
DROP POLICY IF EXISTS "admin_users_select" ON public.admin_users;
CREATE POLICY "admin_users_select" ON public.admin_users
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

-- Business Table Strict Admin Policies:
-- Only active administrators (is_admin() = true) can perform SELECT, INSERT, UPDATE, DELETE.
DO $$
DECLARE
  t text;
  legacy_p text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'customers',
    'vehicles',
    'charging_stations',
    'charging_slots',
    'bookings',
    'charging_sessions',
    'payments',
    'maintenance',
    'reviews'
  ] LOOP
    -- Drop legacy permissive policies if they exist
    FOREACH legacy_p IN ARRAY ARRAY['shared_select_', 'shared_insert_', 'shared_update_', 'shared_delete_'] LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', legacy_p || t, t);
    END LOOP;

    -- Drop previous admin policy
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'admin_manage_' || t, t);

    -- Apply strict admin access
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())',
      'admin_manage_' || t,
      t
    );
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 5. DEMONSTRATION OPERATIONAL FLEET SEED DATA
-- ----------------------------------------------------------------------------

-- Customers
INSERT INTO public.customers (id, name, phone, email) VALUES
  ('10000000-0000-0000-0000-000000000001', 'Aarav Mehta', '+91 98765 40001', 'aarav@example.com'),
  ('10000000-0000-0000-0000-000000000002', 'Nisha Kapoor', '+91 98765 40002', 'nisha@example.com'),
  ('10000000-0000-0000-0000-000000000003', 'Rohan Shah', '+91 98765 40003', 'rohan@example.com'),
  ('10000000-0000-0000-0000-000000000004', 'Maya Fernandes', '+91 98765 40004', 'maya@example.com')
ON CONFLICT (id) DO NOTHING;

-- Vehicles
INSERT INTO public.vehicles (id, customer_id, vehicle_number, vehicle_model, battery_capacity) VALUES
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'MH 01 EV 4421', 'Tesla Model 3', 60.00),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'DL 04 EV 1818', 'BYD Atto 3', 60.48),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', 'KA 03 EV 9087', 'Hyundai Ioniq 5', 72.60),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000004', 'MH 02 EV 7712', 'Kia EV6', 77.40)
ON CONFLICT (id) DO NOTHING;

-- Charging Stations
INSERT INTO public.charging_stations (id, name, location, total_slots, available_slots, power_output, utilization, status) VALUES
  ('30000000-0000-0000-0000-000000000001', 'Voltway Central', 'Downtown · 2.4 km', 12, 8, '180 kW', 72, 'online'),
  ('30000000-0000-0000-0000-000000000002', 'Green Park Hub', 'North District · 4.8 km', 8, 3, '240 kW', 84, 'online'),
  ('30000000-0000-0000-0000-000000000003', 'Riverside Charge', 'East Bank · 7.1 km', 10, 0, '150 kW', 0, 'maintenance')
ON CONFLICT (id) DO NOTHING;

-- Charging Slots (Voltway Central - 12 bays)
INSERT INTO public.charging_slots (station_id, slot_label, charger_type, power_rating, status) VALUES
  ('30000000-0000-0000-0000-000000000001', 'Slot A-01', 'CCS2', '180 kW', 'occupied'),
  ('30000000-0000-0000-0000-000000000001', 'Slot A-02', 'Type 2', '22 kW', 'occupied'),
  ('30000000-0000-0000-0000-000000000001', 'Slot A-03', 'CCS2', '180 kW', 'occupied'),
  ('30000000-0000-0000-0000-000000000001', 'Slot A-04', 'CCS2', '180 kW', 'occupied'),
  ('30000000-0000-0000-0000-000000000001', 'Slot A-05', 'CCS2', '180 kW', 'available'),
  ('30000000-0000-0000-0000-000000000001', 'Slot A-06', 'Type 2', '22 kW', 'available'),
  ('30000000-0000-0000-0000-000000000001', 'Slot A-07', 'CCS2', '180 kW', 'available'),
  ('30000000-0000-0000-0000-000000000001', 'Slot A-08', 'Type 2', '22 kW', 'available'),
  ('30000000-0000-0000-0000-000000000001', 'Slot A-09', 'Type 2', '22 kW', 'available'),
  ('30000000-0000-0000-0000-000000000001', 'Slot A-10', 'Type 2', '22 kW', 'available'),
  ('30000000-0000-0000-0000-000000000001', 'Slot A-11', 'CCS2', '180 kW', 'available'),
  ('30000000-0000-0000-0000-000000000001', 'Slot A-12', 'Type 2', '22 kW', 'available')
ON CONFLICT (station_id, slot_label) DO NOTHING;

-- Charging Slots (Green Park Hub - 8 bays)
INSERT INTO public.charging_slots (station_id, slot_label, charger_type, power_rating, status) VALUES
  ('30000000-0000-0000-0000-000000000002', 'Slot B-01', 'CCS2', '240 kW', 'occupied'),
  ('30000000-0000-0000-0000-000000000002', 'Slot B-02', 'CCS2', '240 kW', 'occupied'),
  ('30000000-0000-0000-0000-000000000002', 'Slot B-03', 'CCS2', '240 kW', 'occupied'),
  ('30000000-0000-0000-0000-000000000002', 'Slot B-04', 'Type 2', '22 kW', 'occupied'),
  ('30000000-0000-0000-0000-000000000002', 'Slot B-05', 'CCS2', '120 kW', 'available'),
  ('30000000-0000-0000-0000-000000000002', 'Slot B-06', 'Type 2', '22 kW', 'available'),
  ('30000000-0000-0000-0000-000000000002', 'Slot B-07', 'CCS2', '240 kW', 'available'),
  ('30000000-0000-0000-0000-000000000002', 'Slot B-08', 'Type 2', '22 kW', 'available')
ON CONFLICT (station_id, slot_label) DO NOTHING;

-- Charging Slots (Riverside Charge - 10 bays)
INSERT INTO public.charging_slots (station_id, slot_label, charger_type, power_rating, status) VALUES
  ('30000000-0000-0000-0000-000000000003', 'Slot C-01', 'CCS2', '150 kW', 'maintenance'),
  ('30000000-0000-0000-0000-000000000003', 'Slot C-02', 'Type 2', '22 kW', 'maintenance'),
  ('30000000-0000-0000-0000-000000000003', 'Slot C-03', 'CCS2', '150 kW', 'maintenance'),
  ('30000000-0000-0000-0000-000000000003', 'Slot C-04', 'Type 2', '22 kW', 'maintenance'),
  ('30000000-0000-0000-0000-000000000003', 'Slot C-05', 'CCS2', '150 kW', 'maintenance'),
  ('30000000-0000-0000-0000-000000000003', 'Slot C-06', 'Type 2', '22 kW', 'maintenance'),
  ('30000000-0000-0000-0000-000000000003', 'Slot C-07', 'CCS2', '150 kW', 'maintenance'),
  ('30000000-0000-0000-0000-000000000003', 'Slot C-08', 'Type 2', '22 kW', 'maintenance'),
  ('30000000-0000-0000-0000-000000000003', 'Slot C-09', 'CCS2', '150 kW', 'maintenance'),
  ('30000000-0000-0000-0000-000000000003', 'Slot C-10', 'Type 2', '22 kW', 'maintenance')
ON CONFLICT (station_id, slot_label) DO NOTHING;

-- Synchronize station available_slots & total_slots counters
UPDATE public.charging_stations s
SET 
  available_slots = (
    SELECT COUNT(*) FROM public.charging_slots cs
    WHERE cs.station_id = s.id AND cs.status = 'available'
  ),
  total_slots = (
    SELECT COUNT(*) FROM public.charging_slots cs
    WHERE cs.station_id = s.id
  );

-- Bookings
INSERT INTO public.bookings (id, customer_id, vehicle_id, station_id, slot_id, customer_name, vehicle, station_name, slot_label, booking_date, start_time, status, amount) VALUES
  ('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', NULL, 'Aarav Mehta', 'Tesla Model 3', 'Voltway Central', 'Slot A-04', CURRENT_DATE, '10:30', 'confirmed', 420),
  ('50000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', NULL, 'Nisha Kapoor', 'BYD Atto 3', 'Green Park Hub', 'Slot B-02', CURRENT_DATE, '11:15', 'charging', 680),
  ('50000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', NULL, 'Rohan Shah', 'Hyundai Ioniq 5', 'Voltway Central', 'Slot A-09', CURRENT_DATE + 1, '08:45', 'upcoming', 360),
  ('50000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000002', NULL, 'Maya Fernandes', 'Kia EV6', 'Green Park Hub', 'Slot B-05', CURRENT_DATE + 1, '13:00', 'upcoming', 520)
ON CONFLICT (id) DO NOTHING;

-- Populate slot_id references on bookings from charging_slots matching (station_id, slot_label)
UPDATE public.bookings b
SET slot_id = cs.id
FROM public.charging_slots cs
WHERE b.station_id = cs.station_id 
  AND b.slot_label = cs.slot_label 
  AND b.slot_id IS NULL;

-- Charging Sessions
INSERT INTO public.charging_sessions (id, booking_id, start_time, units_consumed, amount, status) VALUES
  ('60000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000002', now() - interval '18 minutes', 24.50, 680, 'active')
ON CONFLICT (id) DO NOTHING;

-- Payments
INSERT INTO public.payments (id, session_id, amount, payment_status) VALUES
  ('70000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 680, 'paid')
ON CONFLICT (id) DO NOTHING;

-- Maintenance
INSERT INTO public.maintenance (id, station_id, title, scheduled_start, scheduled_end, status) VALUES
  ('80000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', 'Firmware upgrade', now() - interval '1 hour', now() + interval '2 hours', 'in_progress')
ON CONFLICT (id) DO NOTHING;

-- Reviews
INSERT INTO public.reviews (id, customer_id, station_id, rating, comment, created_at) VALUES
  ('90000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 5, 'Fastest charging stop on my daily route. Slot was reserved and activated immediately upon arrival.', now() - interval '2 hours'),
  ('90000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', 5, 'Ultra-fast 240 kW CCS2 charger delivered from 20% to 80% in 22 minutes. Very clean hub and clear signage.', now() - interval '1 day'),
  ('90000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000001', 4, 'Reliable charging experience. Booking was seamless. Would appreciate adding a coffee vending machine near bay A.', now() - interval '3 days'),
  ('90000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000002', 4, 'Smooth payment settlement and live status tracking in the dashboard. Will use again.', now() - interval '5 days')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- AUTHORIZING YOUR FIRST ADMINISTRATOR
-- ============================================================================
-- After creating a user in Supabase Dashboard -> Authentication -> Users:
-- Copy that user's UUID (e.g., 'a1b2c3d4-e5f6-7890-abcd-ef1234567890')
-- and run this statement:
--
-- INSERT INTO public.admin_users (user_id, email, is_active)
-- VALUES ('<PASTE-USER-UUID-HERE>'::uuid, '<USER-EMAIL>', true)
-- ON CONFLICT (user_id) DO UPDATE SET is_active = true;
-- ============================================================================
