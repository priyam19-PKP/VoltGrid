/*
  # Forward Migration: Station Deletion Cascades & Referential Integrity
  
  Academic Subject: Advanced Data Management (ADM) - MSBTE Diploma AI/ML
  Purpose:
    1. Enforces ON DELETE CASCADE on physical child tables (charging_slots, maintenance, reviews)
       so a station with NO bookings can be cleanly deleted without orphaned child records.
    2. Enforces ON DELETE RESTRICT on bookings(station_id) to protect historical financial and audit logs.
    3. Enforces ON DELETE SET NULL on bookings(slot_id) so slot deletion does not cascade into bookings.
    4. Confirms Row Level Security (RLS) delete permissions for shared dashboard access.
*/

-- 1. Ensure charging_slots cascades on station deletion
ALTER TABLE charging_slots 
  DROP CONSTRAINT IF EXISTS charging_slots_station_id_fkey,
  ADD CONSTRAINT charging_slots_station_id_fkey 
    FOREIGN KEY (station_id) REFERENCES charging_stations(id) ON DELETE CASCADE;

-- 2. Ensure maintenance records cascade on station deletion
ALTER TABLE maintenance 
  DROP CONSTRAINT IF EXISTS maintenance_station_id_fkey,
  ADD CONSTRAINT maintenance_station_id_fkey 
    FOREIGN KEY (station_id) REFERENCES charging_stations(id) ON DELETE CASCADE;

-- 3. Ensure bookings RESTRICT station deletion when historical bookings exist
ALTER TABLE bookings 
  DROP CONSTRAINT IF EXISTS bookings_station_id_fkey,
  ADD CONSTRAINT bookings_station_id_fkey 
    FOREIGN KEY (station_id) REFERENCES charging_stations(id) ON DELETE RESTRICT;

-- 4. Ensure bookings SET NULL if a charging_slot is removed
ALTER TABLE bookings 
  DROP CONSTRAINT IF EXISTS bookings_slot_id_fkey,
  ADD CONSTRAINT bookings_slot_id_fkey 
    FOREIGN KEY (slot_id) REFERENCES charging_slots(id) ON DELETE SET NULL;

-- 5. If reviews table exists, ensure CASCADE on station deletion
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reviews') THEN
    ALTER TABLE reviews 
      DROP CONSTRAINT IF EXISTS reviews_station_id_fkey,
      ADD CONSTRAINT reviews_station_id_fkey 
        FOREIGN KEY (station_id) REFERENCES charging_stations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 6. Verify shared DELETE policies on charging_stations and charging_slots
DROP POLICY IF EXISTS shared_delete_charging_stations ON charging_stations;
CREATE POLICY shared_delete_charging_stations ON charging_stations 
  FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS shared_delete_charging_slots ON charging_slots;
CREATE POLICY shared_delete_charging_slots ON charging_slots 
  FOR DELETE TO anon, authenticated USING (true);
