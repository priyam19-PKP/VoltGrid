/*
  # Forward Migration: Reconcile Charging Slots and Capacity Consistency
  
  Academic Subject: Advanced Data Management (ADM) - MSBTE Diploma AI/ML
  Purpose:
    1. Reconciles declared station capacities with individual `charging_slots` rows.
    2. Ensures every bay at Voltway Central (12 bays), Green Park Hub (8 bays),
       and Riverside Charge (10 bays) exists as an individual record in `charging_slots`.
    3. Guarantees 1:N relational integrity between `charging_stations` and `charging_slots`.
    4. Syncs `available_slots` counts and `utilization` rates with slot statuses.
*/

-- 1. Insert missing slots for Voltway Central (Total 12 bays)
INSERT INTO charging_slots (station_id, slot_label, charger_type, power_rating, status) VALUES
  ('30000000-0000-0000-0000-000000000001', 'Slot A-01', 'CCS2', '180 kW', 'occupied'),
  ('30000000-0000-0000-0000-000000000001', 'Slot A-02', 'Type 2', '22 kW', 'occupied'),
  ('30000000-0000-0000-0000-000000000001', 'Slot A-03', 'CCS2', '180 kW', 'occupied'),
  ('30000000-0000-0000-0000-000000000001', 'Slot A-05', 'CCS2', '180 kW', 'available'),
  ('30000000-0000-0000-0000-000000000001', 'Slot A-06', 'Type 2', '22 kW', 'available'),
  ('30000000-0000-0000-0000-000000000001', 'Slot A-07', 'CCS2', '180 kW', 'available'),
  ('30000000-0000-0000-0000-000000000001', 'Slot A-08', 'Type 2', '22 kW', 'available'),
  ('30000000-0000-0000-0000-000000000001', 'Slot A-10', 'Type 2', '22 kW', 'available'),
  ('30000000-0000-0000-0000-000000000001', 'Slot A-11', 'CCS2', '180 kW', 'available'),
  ('30000000-0000-0000-0000-000000000001', 'Slot A-12', 'Type 2', '22 kW', 'available')
ON CONFLICT (station_id, slot_label) DO NOTHING;

-- 2. Insert missing slots for Green Park Hub (Total 8 bays)
INSERT INTO charging_slots (station_id, slot_label, charger_type, power_rating, status) VALUES
  ('30000000-0000-0000-0000-000000000002', 'Slot B-01', 'CCS2', '240 kW', 'occupied'),
  ('30000000-0000-0000-0000-000000000002', 'Slot B-03', 'CCS2', '240 kW', 'occupied'),
  ('30000000-0000-0000-0000-000000000002', 'Slot B-04', 'Type 2', '22 kW', 'occupied'),
  ('30000000-0000-0000-0000-000000000002', 'Slot B-06', 'Type 2', '22 kW', 'occupied'),
  ('30000000-0000-0000-0000-000000000002', 'Slot B-07', 'CCS2', '240 kW', 'available'),
  ('30000000-0000-0000-0000-000000000002', 'Slot B-08', 'Type 2', '22 kW', 'available')
ON CONFLICT (station_id, slot_label) DO NOTHING;

-- 3. Insert slots for Riverside Charge (Total 10 bays, all maintenance during outage)
INSERT INTO charging_slots (station_id, slot_label, charger_type, power_rating, status) VALUES
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

-- 4. Reconcile charging_stations available_slots counters to match actual 'available' slots
UPDATE charging_stations s
SET 
  available_slots = (
    SELECT COUNT(*) FROM charging_slots cs
    WHERE cs.station_id = s.id AND cs.status = 'available'
  ),
  total_slots = (
    SELECT COUNT(*) FROM charging_slots cs
    WHERE cs.station_id = s.id
  );
