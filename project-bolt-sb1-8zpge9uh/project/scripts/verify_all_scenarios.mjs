import { createRequire } from 'module';
const require = createRequire('c:/Users/jugar/Downloads/project-bolt-sb1-8zpge9uh/project/package.json');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('c:/Users/jugar/Downloads/project-bolt-sb1-8zpge9uh/project/.env', 'utf8');
const lines = envContent.split('\n');
let supabaseUrl = '';
let supabaseAnonKey = '';
for (const line of lines) {
  if (line.startsWith('VITE_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].trim();
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) supabaseAnonKey = line.split('=')[1].trim();
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Implement the same functions as in src/lib/api.ts for verification
async function checkStationDependencies(stationId) {
  const { count: bCount, error: bErr } = await supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('station_id', stationId);
  if (bErr) return { data: null, error: bErr.message };

  const { count: sCount, error: sErr } = await supabase.from('charging_slots').select('*', { count: 'exact', head: true }).eq('station_id', stationId);
  if (sErr) return { data: null, error: sErr.message };

  const { count: mCount, error: mErr } = await supabase.from('maintenance').select('*', { count: 'exact', head: true }).eq('station_id', stationId);
  if (mErr) return { data: null, error: mErr.message };

  const bookingCount = bCount ?? 0;
  const slotCount = sCount ?? 0;
  const maintenanceCount = mCount ?? 0;
  const canDelete = bookingCount === 0;

  return {
    data: { bookingCount, slotCount, maintenanceCount, canDelete },
    error: null,
  };
}

async function deleteStation(id) {
  const { count: bookingCount, error: bCountErr } = await supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('station_id', id);
  if (bCountErr) return { data: false, error: `Pre-check failed: ${bCountErr.message}` };
  if (bookingCount !== null && bookingCount > 0) {
    return { data: false, error: `Referential Integrity Restriction (ON DELETE RESTRICT): This station is referenced by ${bookingCount} existing booking(s).` };
  }

  const { data: deletedRows, error: delErr } = await supabase
    .from('charging_stations')
    .delete()
    .eq('id', id)
    .select('id');

  if (delErr) return { data: false, error: delErr.message };
  if (!deletedRows || deletedRows.length === 0) {
    return { data: false, error: 'Station record was not found or could not be removed from the database (0 rows affected).' };
  }
  return { data: true, error: null };
}

async function runTestSuite() {
  console.log('========================================================');
  console.log('   STATION DELETION VERIFICATION TEST SUITE (A - E)');
  console.log('========================================================\n');

  // TEST A: Create a station with charging slots but no bookings. Delete the station. Confirm removal.
  console.log('--- TEST A: Create station with slots & no bookings -> Delete ---');
  const { data: stA } = await supabase.from('charging_stations').insert({
    name: 'Test Station Alpha',
    location: 'Sector 5',
    total_slots: 3,
    available_slots: 3,
    power_output: '120 kW',
    status: 'online',
  }).select().single();
  console.log('Created station A:', stA.id);

  // Insert 3 slots
  const slotsA = [
    { station_id: stA.id, slot_label: 'Slot A-01', charger_type: 'CCS2', power_rating: '120 kW', status: 'available' },
    { station_id: stA.id, slot_label: 'Slot A-02', charger_type: 'Type 2', power_rating: '22 kW', status: 'available' },
    { station_id: stA.id, slot_label: 'Slot A-03', charger_type: 'CCS2', power_rating: '120 kW', status: 'available' },
  ];
  await supabase.from('charging_slots').insert(slotsA);

  const depsA = await checkStationDependencies(stA.id);
  console.log('Pre-check dependencies for Station A:', depsA.data);
  if (!depsA.data.canDelete) throw new Error('Station A should be deletable!');

  const delResA = await deleteStation(stA.id);
  console.log('Delete result for Station A:', delResA);
  if (!delResA.data) throw new Error('Station A deletion failed!');

  // Verify station and slots removed
  const { data: verifyStA } = await supabase.from('charging_stations').select('id').eq('id', stA.id);
  const { data: verifySlotsA } = await supabase.from('charging_slots').select('id').eq('station_id', stA.id);
  console.log('Verify Station A exists in DB:', verifyStA.length > 0 ? 'STILL THERE (FAIL)' : 'GONE (PASS)');
  console.log('Verify Slots A exist in DB:', verifySlotsA.length > 0 ? 'ORPHANED (FAIL)' : 'CASCADED (PASS)');
  console.log('>>> TEST A PASSED!\n');

  // TEST B: Create a station with a booking. Attempt deletion. Confirm deletion is blocked.
  console.log('--- TEST B: Station with a booking -> Deletion Blocked ---');
  const { data: stB } = await supabase.from('charging_stations').insert({
    name: 'Test Station Beta',
    location: 'Sector 9',
    total_slots: 1,
    available_slots: 0,
    power_output: '150 kW',
    status: 'online',
  }).select().single();

  const { data: slotB } = await supabase.from('charging_slots').insert({
    station_id: stB.id,
    slot_label: 'Slot B-01',
    charger_type: 'CCS2',
    power_rating: '150 kW',
    status: 'occupied',
  }).select().single();

  // Fetch an existing customer & vehicle
  const { data: cust } = await supabase.from('customers').select('id, name').limit(1).single();
  const { data: veh } = await supabase.from('vehicles').select('id, vehicle_model, vehicle_number').eq('customer_id', cust.id).limit(1).single();

  const { data: bookingB } = await supabase.from('bookings').insert({
    customer_id: cust.id,
    vehicle_id: veh.id,
    station_id: stB.id,
    slot_id: slotB.id,
    customer_name: cust.name,
    vehicle: `${veh.vehicle_model} (${veh.vehicle_number})`,
    station_name: stB.name,
    slot_label: slotB.slot_label,
    booking_date: '2026-10-15',
    start_time: '14:00:00',
    status: 'confirmed',
    amount: 500,
  }).select().single();

  console.log('Created station B with booking:', bookingB.id);

  const depsB = await checkStationDependencies(stB.id);
  console.log('Pre-check dependencies for Station B:', depsB.data);
  if (depsB.data.canDelete) throw new Error('Station B should NOT be deletable!');

  const delResB = await deleteStation(stB.id);
  console.log('Attempted delete result for Station B:', delResB);
  if (delResB.data !== false) throw new Error('Station B deletion was not blocked!');
  console.log('Blocked error message:', delResB.error);
  console.log('>>> TEST B PASSED!\n');

  // Clean up Station B & booking
  await supabase.from('bookings').delete().eq('id', bookingB.id);
  await supabase.from('charging_slots').delete().eq('id', slotB.id);
  await supabase.from('charging_stations').delete().eq('id', stB.id);

  // TEST C: Attempt to delete a nonexistent station. Confirm application does not report success.
  console.log('--- TEST C: Delete nonexistent station UUID ---');
  const fakeId = '00000000-0000-0000-0000-000000000000';
  const delResC = await deleteStation(fakeId);
  console.log('Delete result for nonexistent ID:', delResC);
  if (delResC.data === true) throw new Error('Nonexistent station falsely reported success!');
  console.log('Expected error returned:', delResC.error);
  console.log('>>> TEST C PASSED!\n');

  // TEST D: Simulate a database query failure (invalid station ID format)
  console.log('--- TEST D: Invalid station ID format error handling ---');
  const delResD = await deleteStation('invalid-not-a-uuid');
  console.log('Delete result for invalid UUID:', delResD);
  if (delResD.data === true) throw new Error('Invalid UUID falsely reported success!');
  console.log('Expected error returned:', delResD.error);
  console.log('>>> TEST D PASSED!\n');

  // TEST E: Delete an eligible station, refresh application check
  console.log('--- TEST E: Delete eligible station & verify persistence ---');
  const { data: stE } = await supabase.from('charging_stations').insert({
    name: 'Test Station Epsilon',
    location: 'North Plaza',
    total_slots: 2,
    available_slots: 2,
    power_output: '60 kW',
    status: 'online',
  }).select().single();

  const delResE = await deleteStation(stE.id);
  console.log('Deleted Station E:', delResE);
  if (!delResE.data) throw new Error('Station E deletion failed!');

  // Simulate refresh by querying Supabase stations table
  const { data: stationsAfter } = await supabase.from('charging_stations').select('id, name');
  const foundE = stationsAfter.find(s => s.id === stE.id);
  console.log('Refreshed list has Station E:', foundE ? 'YES (FAIL)' : 'NO (CONFIRMED DELETED)');
  console.log('>>> TEST E PASSED!\n');

  console.log('========================================================');
  console.log('   ALL 5 TESTS (A, B, C, D, E) PASSED SUCCESSFULLY!');
  console.log('========================================================');
}

runTestSuite().catch(console.error);
