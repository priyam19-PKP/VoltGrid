/*
# Create EV charging network management records

1. New Tables
- `customers` stores customer names and contact details.
- `vehicles` stores each registered EV and its battery capacity.
- `charging_stations` stores station locations, slot capacity, live availability, and utilization.
- `charging_slots` stores individual connectors at each station.
- `bookings` stores reserved charging appointments and the amount due.
- `charging_sessions` stores actual charging start/end times and energy delivered.
- `payments` stores payment records linked to completed sessions.
- `maintenance` stores planned or active station maintenance windows.

2. Security
- Row-level security is enabled on every table.
- This is a single-tenant dashboard without sign-in, so anon and authenticated roles can manage the shared network records.
- Separate policies are provided for select, insert, update, and delete on every table.

3. Starter data
- A small set of realistic station, slot, customer, vehicle, booking, session, payment, and maintenance records is included so the dashboard is populated immediately.

4. Important notes
- Monetary values use numeric precision and energy values use numeric precision.
- Foreign keys preserve relationships between customers, vehicles, stations, bookings, sessions, and payments.
- This migration is safe to re-run because tables and policies use idempotent patterns.
*/

CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  vehicle_number text NOT NULL,
  vehicle_model text NOT NULL,
  battery_capacity numeric(8,2) NOT NULL CHECK (battery_capacity > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS charging_stations (
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

CREATE TABLE IF NOT EXISTS charging_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES charging_stations(id) ON DELETE CASCADE,
  slot_label text NOT NULL,
  charger_type text NOT NULL,
  power_rating text NOT NULL,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'maintenance')),
  UNIQUE (station_id, slot_label)
);

CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
  station_id uuid NOT NULL REFERENCES charging_stations(id) ON DELETE RESTRICT,
  slot_id uuid REFERENCES charging_slots(id) ON DELETE SET NULL,
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

CREATE TABLE IF NOT EXISTS charging_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
  start_time timestamptz,
  end_time timestamptz,
  units_consumed numeric(10,2) NOT NULL DEFAULT 0 CHECK (units_consumed >= 0),
  amount numeric(10,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled'))
);

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES charging_sessions(id) ON DELETE RESTRICT,
  amount numeric(10,2) NOT NULL CHECK (amount >= 0),
  payment_date timestamptz NOT NULL DEFAULT now(),
  payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded'))
);

CREATE TABLE IF NOT EXISTS maintenance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES charging_stations(id) ON DELETE CASCADE,
  title text NOT NULL,
  scheduled_start timestamptz NOT NULL,
  scheduled_end timestamptz,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed'))
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE charging_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE charging_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE charging_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  table_name text;
  policy_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['customers','vehicles','charging_stations','charging_slots','bookings','charging_sessions','payments','maintenance'] LOOP
    policy_name := 'shared_select_' || table_name;
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', policy_name, table_name);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO anon, authenticated USING (true)', policy_name, table_name);
    policy_name := 'shared_insert_' || table_name;
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', policy_name, table_name);
    EXECUTE format('CREATE POLICY %I ON %I FOR INSERT TO anon, authenticated WITH CHECK (true)', policy_name, table_name);
    policy_name := 'shared_update_' || table_name;
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', policy_name, table_name);
    EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true)', policy_name, table_name);
    policy_name := 'shared_delete_' || table_name;
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', policy_name, table_name);
    EXECUTE format('CREATE POLICY %I ON %I FOR DELETE TO anon, authenticated USING (true)', policy_name, table_name);
  END LOOP;
END $$;

INSERT INTO customers (id, name, phone, email) VALUES
  ('10000000-0000-0000-0000-000000000001', 'Aarav Mehta', '+91 98765 40001', 'aarav@example.com'),
  ('10000000-0000-0000-0000-000000000002', 'Nisha Kapoor', '+91 98765 40002', 'nisha@example.com'),
  ('10000000-0000-0000-0000-000000000003', 'Rohan Shah', '+91 98765 40003', 'rohan@example.com'),
  ('10000000-0000-0000-0000-000000000004', 'Maya Fernandes', '+91 98765 40004', 'maya@example.com')
ON CONFLICT (id) DO NOTHING;

INSERT INTO vehicles (id, customer_id, vehicle_number, vehicle_model, battery_capacity) VALUES
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'MH 01 EV 4421', 'Tesla Model 3', 60.00),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'DL 04 EV 1818', 'BYD Atto 3', 60.48),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', 'KA 03 EV 9087', 'Hyundai Ioniq 5', 72.60),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000004', 'MH 02 EV 7712', 'Kia EV6', 77.40)
ON CONFLICT (id) DO NOTHING;

INSERT INTO charging_stations (id, name, location, total_slots, available_slots, power_output, utilization, status) VALUES
  ('30000000-0000-0000-0000-000000000001', 'Voltway Central', 'Downtown · 2.4 km', 12, 8, '180 kW', 72, 'online'),
  ('30000000-0000-0000-0000-000000000002', 'Green Park Hub', 'North District · 4.8 km', 8, 3, '240 kW', 84, 'online'),
  ('30000000-0000-0000-0000-000000000003', 'Riverside Charge', 'East Bank · 7.1 km', 10, 0, '150 kW', 0, 'maintenance')
ON CONFLICT (id) DO NOTHING;

INSERT INTO charging_slots (id, station_id, slot_label, charger_type, power_rating, status) VALUES
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Slot A-04', 'CCS2', '180 kW', 'occupied'),
  ('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', 'Slot B-02', 'CCS2', '240 kW', 'occupied'),
  ('40000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', 'Slot A-09', 'Type 2', '22 kW', 'available'),
  ('40000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000002', 'Slot B-05', 'CCS2', '120 kW', 'available')
ON CONFLICT (id) DO NOTHING;

INSERT INTO bookings (id, customer_id, vehicle_id, station_id, slot_id, customer_name, vehicle, station_name, slot_label, booking_date, start_time, status, amount) VALUES
  ('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'Aarav Mehta', 'Tesla Model 3', 'Voltway Central', 'Slot A-04', CURRENT_DATE, '10:30', 'confirmed', 420),
  ('50000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', 'Nisha Kapoor', 'BYD Atto 3', 'Green Park Hub', 'Slot B-02', CURRENT_DATE, '11:15', 'charging', 680),
  ('50000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000003', 'Rohan Shah', 'Hyundai Ioniq 5', 'Voltway Central', 'Slot A-09', CURRENT_DATE + 1, '08:45', 'upcoming', 360),
  ('50000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000004', 'Maya Fernandes', 'Kia EV6', 'Green Park Hub', 'Slot B-05', CURRENT_DATE + 1, '13:00', 'upcoming', 520)
ON CONFLICT (id) DO NOTHING;

INSERT INTO charging_sessions (id, booking_id, start_time, units_consumed, amount, status) VALUES
  ('60000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000002', now() - interval '18 minutes', 24.50, 680, 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO payments (id, session_id, amount, payment_status) VALUES
  ('70000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 680, 'paid')
ON CONFLICT (id) DO NOTHING;

INSERT INTO maintenance (id, station_id, title, scheduled_start, scheduled_end, status) VALUES
  ('80000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', 'Firmware upgrade', now() - interval '1 hour', now() + interval '2 hours', 'in_progress')
ON CONFLICT (id) DO NOTHING;
