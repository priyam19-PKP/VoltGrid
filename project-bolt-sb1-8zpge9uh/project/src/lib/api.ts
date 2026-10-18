import { supabase, isSupabaseConfigured } from './supabase';
import { mockStore } from './mockData';
import type {
  ChargingStation,
  ChargingSlot,
  Customer,
  Vehicle,
  Booking,
  BookingStatus,
  ChargingSession,
  PaymentWithDetails,
  MaintenanceRecord,
  Review,
  NetworkMetrics,
} from '@/types/database';

export interface ApiResult<T> {
  data: T | null;
  error: string | null;
}

// ==========================================
// CONNECTION HEALTH CHECK
// ==========================================

export async function checkDatabaseConnection(): Promise<{ connected: boolean; isDemo?: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    return { connected: true, isDemo: true };
  }
  try {
    const { error } = await supabase.from('charging_stations').select('id', { head: true, count: 'exact' });
    if (error) return { connected: false, error: error.message };
    return { connected: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { connected: false, error: msg };
  }
}

// ==========================================
// DYNAMIC TABLE INSPECTION (ADM Demonstration)
// ==========================================

export async function fetchTableRecords(
  tableName: string,
  limit = 50
): Promise<ApiResult<Record<string, unknown>[]>> {
  if (!isSupabaseConfigured) {
    switch (tableName) {
      case 'charging_stations':
        return { data: mockStore.getStations().slice(0, limit) as unknown as Record<string, unknown>[], error: null };
      case 'charging_slots':
        return { data: mockStore.getSlots().slice(0, limit) as unknown as Record<string, unknown>[], error: null };
      case 'customers':
        return { data: mockStore.getCustomers().slice(0, limit) as unknown as Record<string, unknown>[], error: null };
      case 'vehicles':
        return { data: mockStore.getVehicles().slice(0, limit) as unknown as Record<string, unknown>[], error: null };
      case 'bookings':
        return { data: mockStore.getBookings().slice(0, limit) as unknown as Record<string, unknown>[], error: null };
      case 'charging_sessions':
        return { data: mockStore.getSessions().slice(0, limit) as unknown as Record<string, unknown>[], error: null };
      case 'payments':
        return { data: mockStore.getPayments().slice(0, limit) as unknown as Record<string, unknown>[], error: null };
      case 'maintenance':
        return { data: mockStore.getMaintenance().slice(0, limit) as unknown as Record<string, unknown>[], error: null };
      case 'reviews':
        return { data: mockStore.getReviews().slice(0, limit) as unknown as Record<string, unknown>[], error: null };
      case 'admin_users':
        return {
          data: [
            {
              id: '00000000-0000-0000-0000-000000000001',
              user_id: '00000000-0000-0000-0000-000000000001',
              email: 'admin@voltgrid.com',
              is_active: true,
              created_at: new Date().toISOString(),
            },
          ],
          error: null,
        };
      default:
        return { data: [], error: null };
    }
  }
  const allowedTables = [
    'charging_stations',
    'charging_slots',
    'customers',
    'vehicles',
    'bookings',
    'charging_sessions',
    'payments',
    'maintenance',
    'reviews',
    'admin_users',
  ];
  if (!allowedTables.includes(tableName)) {
    return { data: null, error: `Invalid table name "${tableName}".` };
  }

  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(limit);

    if (error) {
      return { data: null, error: error.message };
    }
    return { data: (data as Record<string, unknown>[]) || [], error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { data: null, error: msg };
  }
}

// ==========================================
// CHARGING STATIONS CRUD
// ==========================================

export async function fetchStations(): Promise<ApiResult<ChargingStation[]>> {
  if (!isSupabaseConfigured) {
    return { data: mockStore.getStations(), error: null };
  }
  const { data, error } = await supabase
    .from('charging_stations')
    .select('*')
    .order('name');
  if (error) return { data: null, error: error.message };
  return { data: data as ChargingStation[], error: null };
}

export async function createStation(
  station: Omit<ChargingStation, 'id' | 'created_at'>
): Promise<ApiResult<ChargingStation>> {
  if (!isSupabaseConfigured) {
    const totalSlots = Math.max(1, Math.min(32, Number(station.total_slots) || 1));
    const newId = crypto.randomUUID();
    const newStation: ChargingStation = {
      id: newId,
      name: station.name.trim(),
      location: station.location.trim(),
      total_slots: totalSlots,
      available_slots: totalSlots,
      power_output: station.power_output.trim(),
      utilization: 0,
      status: station.status || 'online',
      created_at: new Date().toISOString(),
    };
    const initialSlots: ChargingSlot[] = Array.from({ length: totalSlots }, (_, i) => ({
      id: crypto.randomUUID(),
      station_id: newId,
      slot_label: `Slot ${String.fromCharCode(65 + Math.floor(i / 4))}-${String((i % 4) + 1).padStart(2, '0')}`,
      charger_type: i % 2 === 0 ? 'CCS2' : 'Type 2',
      power_rating: station.power_output,
      status: 'available',
    }));
    mockStore.saveStations([newStation, ...mockStore.getStations()]);
    mockStore.saveSlots([...mockStore.getSlots(), ...initialSlots]);
    return { data: newStation, error: null };
  }
  const totalSlots = Math.max(1, Math.min(32, Number(station.total_slots) || 1));
  const insertPayload = {
    name: station.name.trim(),
    location: station.location.trim(),
    total_slots: totalSlots,
    available_slots: totalSlots,
    power_output: station.power_output.trim(),
    utilization: 0,
    status: station.status || 'online',
  };

  const { data: newStation, error: stationErr } = await supabase
    .from('charging_stations')
    .insert(insertPayload)
    .select()
    .single();

  if (stationErr || !newStation) {
    return { data: null, error: stationErr?.message || 'Failed to create station' };
  }

  // Auto-generate slot records matching total_slots (Relational 1:N)
  const initialSlots = Array.from({ length: totalSlots }, (_, i) => ({
    station_id: newStation.id,
    slot_label: `Slot ${String.fromCharCode(65 + Math.floor(i / 4))}-${String((i % 4) + 1).padStart(2, '0')}`,
    charger_type: i % 2 === 0 ? 'CCS2' : 'Type 2',
    power_rating: station.power_output,
    status: 'available',
  }));

  const { error: slotErr } = await supabase.from('charging_slots').insert(initialSlots);
  if (slotErr) {
    // Rollback station to avoid orphaned station with no slots
    await supabase.from('charging_stations').delete().eq('id', newStation.id);
    return { data: null, error: `Failed to create charging slots: ${slotErr.message}` };
  }

  return { data: newStation as ChargingStation, error: null };
}

export async function updateStation(
  id: string,
  updates: Partial<ChargingStation>
): Promise<ApiResult<ChargingStation>> {
  if (!isSupabaseConfigured) {
    const list = mockStore.getStations();
    const idx = list.findIndex((s) => s.id === id);
    if (idx === -1) return { data: null, error: 'Station not found' };
    const updated = { ...list[idx], ...updates };
    delete (updated as Partial<ChargingStation>).total_slots;
    list[idx] = updated;
    mockStore.saveStations([...list]);
    return { data: updated, error: null };
  }
  // Total slots is read-only after creation to prevent capacity/slot count mismatches
  const payload = { ...updates };
  delete payload.total_slots;

  const { data, error } = await supabase
    .from('charging_stations')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) return { data: null, error: error.message };
  return { data: data as ChargingStation, error: null };
}

export interface StationDependencies {
  bookingCount: number;
  slotCount: number;
  maintenanceCount: number;
  reviewCount: number;
  canDelete: boolean;
  restrictionReason: string | null;
}

export async function checkStationDependencies(stationId: string): Promise<ApiResult<StationDependencies>> {
  if (!isSupabaseConfigured) {
    const bCount = mockStore.getBookings().filter((b) => b.station_id === stationId).length;
    const sCount = mockStore.getSlots().filter((s) => s.station_id === stationId).length;
    const mCount = mockStore.getMaintenance().filter((m) => m.station_id === stationId).length;
    const rCount = mockStore.getReviews().filter((r) => r.station_id === stationId).length;
    const canDelete = bCount === 0;
    const restrictionReason = !canDelete
      ? `This station is referenced by ${bCount} existing booking(s). Under relational integrity rules (ON DELETE RESTRICT), stations with booking history cannot be deleted to preserve audit logs.`
      : null;
    return {
      data: {
        bookingCount: bCount,
        slotCount: sCount,
        maintenanceCount: mCount,
        reviewCount: rCount,
        canDelete,
        restrictionReason,
      },
      error: null,
    };
  }

  try {
    // 1. Check bookings count
    const { count: bCount, error: bErr } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('station_id', stationId);

    if (bErr) {
      return { data: null, error: `Failed to inspect booking dependencies: ${bErr.message}` };
    }

    // 2. Check slots count
    const { count: sCount, error: sErr } = await supabase
      .from('charging_slots')
      .select('*', { count: 'exact', head: true })
      .eq('station_id', stationId);

    if (sErr) {
      return { data: null, error: `Failed to inspect slot dependencies: ${sErr.message}` };
    }

    // 3. Check maintenance count
    const { count: mCount, error: mErr } = await supabase
      .from('maintenance')
      .select('*', { count: 'exact', head: true })
      .eq('station_id', stationId);

    if (mErr) {
      return { data: null, error: `Failed to inspect maintenance dependencies: ${mErr.message}` };
    }

    // 4. Check reviews count (gracefully handles if table is not yet migrated)
    let rCount = 0;
    try {
      const { count, error } = await supabase
        .from('reviews')
        .select('*', { count: 'exact', head: true })
        .eq('station_id', stationId);
      if (!error && count !== null) {
        rCount = count;
      }
    } catch {
      rCount = 0;
    }

    const bookingCount = bCount ?? 0;
    const slotCount = sCount ?? 0;
    const maintenanceCount = mCount ?? 0;

    const canDelete = bookingCount === 0;
    const restrictionReason = !canDelete
      ? `This station is referenced by ${bookingCount} existing booking(s). Under relational integrity rules (ON DELETE RESTRICT), stations with booking history cannot be deleted to preserve audit logs.`
      : null;

    return {
      data: {
        bookingCount,
        slotCount,
        maintenanceCount,
        reviewCount: rCount,
        canDelete,
        restrictionReason,
      },
      error: null,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { data: null, error: `Error checking station dependencies: ${msg}` };
  }
}

export async function deleteStation(id: string): Promise<ApiResult<boolean>> {
  if (!isSupabaseConfigured) {
    const bookings = mockStore.getBookings().filter((b) => b.station_id === id);
    if (bookings.length > 0) {
      return {
        data: false,
        error: `Referential Integrity Restriction (ON DELETE RESTRICT): This station is referenced by ${bookings.length} existing booking(s). It cannot be physically deleted. You can mark the station as 'offline' instead.`,
      };
    }
    mockStore.saveStations(mockStore.getStations().filter((s) => s.id !== id));
    mockStore.saveSlots(mockStore.getSlots().filter((s) => s.station_id !== id));
    mockStore.saveMaintenance(mockStore.getMaintenance().filter((m) => m.station_id !== id));
    mockStore.saveReviews(mockStore.getReviews().filter((r) => r.station_id !== id));
    return { data: true, error: null };
  }

  // Pre-check for bookings referencing this station
  const { count: bookingCount, error: bCountErr } = await supabase
    .from('bookings')
    .select('*', { count: 'exact', head: true })
    .eq('station_id', id);

  if (bCountErr) {
    return {
      data: false,
      error: `Dependency pre-check failed: Could not verify bookings (${bCountErr.message}). Deletion halted to protect data integrity.`,
    };
  }

  if (bookingCount !== null && bookingCount > 0) {
    return {
      data: false,
      error: `Referential Integrity Restriction (ON DELETE RESTRICT): This station is referenced by ${bookingCount} existing booking(s). It cannot be physically deleted. You can mark the station as 'offline' instead.`,
    };
  }

  // Execute deletion and request affected rows back via .select('id')
  const { data: deletedRows, error: delErr } = await supabase
    .from('charging_stations')
    .delete()
    .eq('id', id)
    .select('id');

  if (delErr) {
    if (delErr.code === '23503') {
      const details = delErr.details || delErr.message || '';
      let targetEntity = 'dependent records';
      if (details.includes('bookings')) targetEntity = 'historical booking records';
      else if (details.includes('charging_slots')) targetEntity = 'charging slot records';
      else if (details.includes('maintenance')) targetEntity = 'maintenance work orders';
      else if (details.includes('reviews')) targetEntity = 'customer reviews';

      return {
        data: false,
        error: `Foreign Key Restriction (Code 23503): Cannot delete this station because ${targetEntity} reference it in PostgreSQL. Detail: ${delErr.message}`,
      };
    }
    if (delErr.code === '42501') {
      return {
        data: false,
        error: 'Database Permission Denied (Code 42501): Row Level Security policy prevented deletion of this station.',
      };
    }
    return { data: false, error: delErr.message || 'Database error occurred during station deletion.' };
  }

  // Verify that a row was actually deleted (guard against zero rows affected / phantom success)
  if (!deletedRows || deletedRows.length === 0) {
    return {
      data: false,
      error: 'Station record was not found or could not be removed from the database (0 rows affected). It may have already been deleted or is restricted by security policies.',
    };
  }

  return { data: true, error: null };
}

// ==========================================
// CHARGING SLOTS
// ==========================================

export async function fetchActualSlotCount(): Promise<number> {
  if (!isSupabaseConfigured) return mockStore.getSlots().length;
  try {
    const { count, error } = await supabase.from('charging_slots').select('*', { count: 'exact', head: true });
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

export async function fetchSlotsForStation(stationId: string): Promise<ApiResult<ChargingSlot[]>> {
  if (!isSupabaseConfigured) {
    return { data: mockStore.getSlots().filter((s) => s.station_id === stationId), error: null };
  }
  const { data, error } = await supabase
    .from('charging_slots')
    .select('*')
    .eq('station_id', stationId)
    .order('slot_label');

  if (error) return { data: null, error: error.message };
  return { data: data as ChargingSlot[], error: null };
}

export async function updateSlotStatus(
  slotId: string,
  newStatus: 'available' | 'occupied' | 'maintenance',
  stationId: string
): Promise<ApiResult<ChargingSlot>> {
  if (!isSupabaseConfigured) {
    const slots = mockStore.getSlots();
    const idx = slots.findIndex((s) => s.id === slotId);
    if (idx !== -1) {
      slots[idx].status = newStatus;
      mockStore.saveSlots([...slots]);
      const stList = mockStore.getStations();
      const sIdx = stList.findIndex((st) => st.id === stationId);
      if (sIdx !== -1) {
        const stSlots = slots.filter((s) => s.station_id === stationId);
        const avail = stSlots.filter((s) => s.status === 'available').length;
        stList[sIdx].available_slots = avail;
        stList[sIdx].utilization = Math.round(((stSlots.length - avail) / (stSlots.length || 1)) * 100);
        mockStore.saveStations([...stList]);
      }
      return { data: slots[idx], error: null };
    }
    return { data: null, error: 'Slot not found' };
  }
  const { data, error } = await supabase
    .from('charging_slots')
    .update({ status: newStatus })
    .eq('id', slotId)
    .select()
    .single();

  if (error) return { data: null, error: error.message };

  // Sync station available_slots count and utilization based on actual slot rows
  const { count: availCount } = await supabase
    .from('charging_slots')
    .select('*', { count: 'exact', head: true })
    .eq('station_id', stationId)
    .eq('status', 'available');

  const { count: totalCount } = await supabase
    .from('charging_slots')
    .select('*', { count: 'exact', head: true })
    .eq('station_id', stationId);

  if (availCount !== null && totalCount !== null && totalCount > 0) {
    const util = Math.round(((totalCount - availCount) / totalCount) * 100);
    await supabase
      .from('charging_stations')
      .update({ available_slots: availCount, utilization: util })
      .eq('id', stationId);
  }

  return { data: data as ChargingSlot, error: null };
}

// ==========================================
// CUSTOMERS & VEHICLES (1-to-N Relational Registration)
// ==========================================

export async function fetchCustomers(): Promise<ApiResult<Customer[]>> {
  if (!isSupabaseConfigured) {
    return { data: mockStore.getCustomers(), error: null };
  }
  const { data, error } = await supabase.from('customers').select('*').order('name');
  if (error) return { data: null, error: error.message };
  return { data: data as Customer[], error: null };
}

export async function fetchVehicles(customerId?: string): Promise<ApiResult<Vehicle[]>> {
  if (!isSupabaseConfigured) {
    const vehicles = mockStore.getVehicles();
    return { data: customerId ? vehicles.filter((v) => v.customer_id === customerId) : vehicles, error: null };
  }
  let query = supabase.from('vehicles').select('*').order('vehicle_model');
  if (customerId) {
    query = query.eq('customer_id', customerId);
  }
  const { data, error } = await query;
  if (error) return { data: null, error: error.message };
  return { data: data as Vehicle[], error: null };
}

export async function createCustomerWithVehicle(params: {
  name: string;
  phone: string;
  email: string;
  vehicle_number: string;
  vehicle_model: string;
  battery_capacity: number;
}): Promise<ApiResult<{ customer: Customer; vehicle: Vehicle }>> {
  if (!isSupabaseConfigured) {
    const cleanName = params.name.trim();
    const cleanPlate = params.vehicle_number.trim().toUpperCase();
    const cleanModel = params.vehicle_model.trim();
    const batteryCap = Number(params.battery_capacity);

    if (!cleanName) return { data: null, error: 'Customer name is required.' };
    if (!cleanPlate) return { data: null, error: 'Vehicle registration number is required.' };
    if (!cleanModel) return { data: null, error: 'Vehicle model is required.' };
    if (isNaN(batteryCap) || batteryCap <= 0) {
      return { data: null, error: 'Battery capacity must be a positive number (> 0 kWh).' };
    }

    const cId = crypto.randomUUID();
    const newCustomer: Customer = {
      id: cId,
      name: cleanName,
      phone: params.phone.trim() || null,
      email: params.email.trim() || null,
      created_at: new Date().toISOString(),
    };
    const newVehicle: Vehicle = {
      id: crypto.randomUUID(),
      customer_id: cId,
      vehicle_number: cleanPlate,
      vehicle_model: cleanModel,
      battery_capacity: batteryCap,
      created_at: new Date().toISOString(),
    };
    mockStore.saveCustomers([newCustomer, ...mockStore.getCustomers()]);
    mockStore.saveVehicles([newVehicle, ...mockStore.getVehicles()]);
    return { data: { customer: newCustomer, vehicle: newVehicle }, error: null };
  }

  const cleanName = params.name.trim();
  const cleanPlate = params.vehicle_number.trim().toUpperCase();
  const cleanModel = params.vehicle_model.trim();
  const batteryCap = Number(params.battery_capacity);

  if (!cleanName) return { data: null, error: 'Customer name is required.' };
  if (!cleanPlate) return { data: null, error: 'Vehicle registration number is required.' };
  if (!cleanModel) return { data: null, error: 'Vehicle model is required.' };
  if (isNaN(batteryCap) || batteryCap <= 0) {
    return { data: null, error: 'Battery capacity must be a positive number (> 0 kWh).' };
  }

  // 1. Insert customer
  const { data: customer, error: cErr } = await supabase
    .from('customers')
    .insert({
      name: cleanName,
      phone: params.phone.trim() || null,
      email: params.email.trim() || null,
    })
    .select()
    .single();

  if (cErr || !customer) {
    return { data: null, error: cErr?.message || 'Failed to create customer record' };
  }

  // 2. Insert vehicle with customer foreign key
  const { data: vehicle, error: vErr } = await supabase
    .from('vehicles')
    .insert({
      customer_id: customer.id,
      vehicle_number: cleanPlate,
      vehicle_model: cleanModel,
      battery_capacity: batteryCap,
    })
    .select()
    .single();

  if (vErr || !vehicle) {
    // Atomic rollback: remove created customer if vehicle insertion fails
    await supabase.from('customers').delete().eq('id', customer.id);
    return { data: null, error: `Vehicle registration failed: ${vErr?.message || 'Unknown error'}. Customer was rolled back.` };
  }

  return { data: { customer, vehicle }, error: null };
}

// ==========================================
// BOOKINGS CRUD & STATUS TRANSITIONS
// ==========================================

export async function fetchBookings(): Promise<ApiResult<Booking[]>> {
  if (!isSupabaseConfigured) {
    return { data: mockStore.getBookings(), error: null };
  }
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .order('booking_date', { ascending: false })
    .order('start_time', { ascending: false });

  if (error) return { data: null, error: error.message };
  return { data: data as Booking[], error: null };
}

export interface CreateBookingInput {
  customer_id: string;
  vehicle_id: string;
  station_id: string;
  slot_id: string; // Strictly required
  customer_name: string;
  vehicle: string;
  station_name: string;
  slot_label: string;
  booking_date: string;
  start_time: string;
  amount: number;
  status?: BookingStatus;
}

export async function createBooking(input: CreateBookingInput): Promise<ApiResult<Booking>> {
  if (!isSupabaseConfigured) {
    if (!input.slot_id) {
      return { data: null, error: 'An available charging slot must be selected.' };
    }
    const newBooking: Booking = {
      id: crypto.randomUUID(),
      customer_id: input.customer_id,
      vehicle_id: input.vehicle_id,
      station_id: input.station_id,
      slot_id: input.slot_id,
      customer_name: input.customer_name,
      vehicle: input.vehicle,
      station_name: input.station_name,
      slot_label: input.slot_label,
      booking_date: input.booking_date,
      start_time: input.start_time,
      status: input.status || 'confirmed',
      amount: Math.max(0, Number(input.amount) || 0),
      created_at: new Date().toISOString(),
    };
    const slots = mockStore.getSlots();
    const slIdx = slots.findIndex((s) => s.id === input.slot_id);
    if (slIdx !== -1) {
      slots[slIdx].status = 'occupied';
      mockStore.saveSlots([...slots]);
    }
    mockStore.saveBookings([newBooking, ...mockStore.getBookings()]);
    return { data: newBooking, error: null };
  }

  // Require slot assignment
  if (!input.slot_id) {
    return { data: null, error: 'An available charging slot must be selected.' };
  }

  // Validate station is online and has capacity
  const { data: station, error: stErr } = await supabase
    .from('charging_stations')
    .select('id, status, available_slots, total_slots')
    .eq('id', input.station_id)
    .single();

  if (stErr || !station) {
    return { data: null, error: 'Selected charging station does not exist.' };
  }

  if (station.status !== 'online') {
    return { data: null, error: `Station is currently in '${station.status}' mode and cannot accept new bookings.` };
  }

  // Verify slot belongs to station and is genuinely available
  const { data: slot, error: slotErr } = await supabase
    .from('charging_slots')
    .select('id, status, station_id, slot_label')
    .eq('id', input.slot_id)
    .maybeSingle();

  if (slotErr || !slot) {
    return { data: null, error: 'Selected charging bay could not be verified in the database.' };
  }

  if (slot.station_id !== input.station_id) {
    return { data: null, error: 'The selected charging bay does not belong to the selected station.' };
  }

  if (slot.status !== 'available') {
    return { data: null, error: `Charging slot ${slot.slot_label} is currently ${slot.status}. Please choose an available bay.` };
  }

  // Verify vehicle belongs to customer
  const { data: veh } = await supabase
    .from('vehicles')
    .select('id, customer_id')
    .eq('id', input.vehicle_id)
    .maybeSingle();

  if (!veh || veh.customer_id !== input.customer_id) {
    return { data: null, error: 'Relational Error: Selected vehicle does not belong to the chosen customer.' };
  }

  // Insert booking
  const { data: booking, error: bErr } = await supabase
    .from('bookings')
    .insert({
      customer_id: input.customer_id,
      vehicle_id: input.vehicle_id,
      station_id: input.station_id,
      slot_id: input.slot_id,
      customer_name: input.customer_name,
      vehicle: input.vehicle,
      station_name: input.station_name,
      slot_label: slot.slot_label,
      booking_date: input.booking_date,
      start_time: input.start_time,
      status: input.status || 'confirmed',
      amount: Math.max(0, Number(input.amount) || 0),
    })
    .select()
    .single();

  if (bErr || !booking) {
    return { data: null, error: bErr?.message || 'Failed to save booking record' };
  }

  // Mark slot as occupied
  await supabase
    .from('charging_slots')
    .update({ status: 'occupied' })
    .eq('id', input.slot_id);

  // Sync station available_slots count based on actual slot rows
  const { count: remainingAvail } = await supabase
    .from('charging_slots')
    .select('*', { count: 'exact', head: true })
    .eq('station_id', input.station_id)
    .eq('status', 'available');

  await supabase
    .from('charging_stations')
    .update({ available_slots: remainingAvail ?? Math.max(0, station.available_slots - 1) })
    .eq('id', input.station_id);

  return { data: booking as Booking, error: null };
}

export async function updateBookingStatus(
  bookingId: string,
  newStatus: BookingStatus,
  currentBooking: Booking
): Promise<ApiResult<Booking>> {
  if (!isSupabaseConfigured) {
    const bookings = mockStore.getBookings();
    const idx = bookings.findIndex((b) => b.id === bookingId);
    if (idx !== -1) {
      const allowedTransitions: Record<BookingStatus, BookingStatus[]> = {
        upcoming: ['confirmed', 'cancelled'],
        confirmed: ['charging', 'cancelled'],
        charging: ['completed'],
        completed: [],
        cancelled: [],
      };
      if (!allowedTransitions[currentBooking.status]?.includes(newStatus)) {
        return {
          data: null,
          error: `Invalid transition: Booking cannot move from '${currentBooking.status}' to '${newStatus}'.`,
        };
      }
      bookings[idx].status = newStatus;
      mockStore.saveBookings([...bookings]);

      if (newStatus === 'charging') {
        const sId = crypto.randomUUID();
        const newSession: ChargingSession = {
          id: sId,
          booking_id: bookingId,
          start_time: new Date().toISOString(),
          end_time: null,
          units_consumed: 0,
          amount: bookings[idx].amount,
          status: 'active',
        };
        mockStore.saveSessions([newSession, ...mockStore.getSessions()]);
        const newPayment: PaymentWithDetails = {
          id: crypto.randomUUID(),
          session_id: sId,
          amount: bookings[idx].amount,
          payment_date: new Date().toISOString(),
          payment_status: 'pending',
          customer_name: bookings[idx].customer_name,
          vehicle: bookings[idx].vehicle,
          station_name: bookings[idx].station_name,
          booking_id: bookingId,
        };
        mockStore.savePayments([newPayment, ...mockStore.getPayments()]);
      } else if (newStatus === 'completed' || newStatus === 'cancelled') {
        if (currentBooking.slot_id) {
          const slots = mockStore.getSlots();
          const slIdx = slots.findIndex((s) => s.id === currentBooking.slot_id);
          if (slIdx !== -1) {
            slots[slIdx].status = 'available';
            mockStore.saveSlots([...slots]);
          }
        }
      }
      return { data: bookings[idx], error: null };
    }
    return { data: null, error: 'Booking not found' };
  }

  // Lifecycle state machine check
  const allowedTransitions: Record<BookingStatus, BookingStatus[]> = {
    upcoming: ['confirmed', 'cancelled'],
    confirmed: ['charging', 'cancelled'],
    charging: ['completed'],
    completed: [],
    cancelled: [],
  };

  if (!allowedTransitions[currentBooking.status]?.includes(newStatus)) {
    return {
      data: null,
      error: `Invalid transition: Booking cannot move from '${currentBooking.status}' to '${newStatus}'.`,
    };
  }

  // 1. Update booking status
  const { data: updatedBooking, error: bErr } = await supabase
    .from('bookings')
    .update({ status: newStatus })
    .eq('id', bookingId)
    .select()
    .single();

  if (bErr || !updatedBooking) {
    return { data: null, error: bErr?.message || 'Failed to update booking status' };
  }

  // 2. Lifecycle Side-Effects
  if (newStatus === 'charging') {
    // Check if session already exists (idempotency against double clicks)
    const { data: existingSession } = await supabase
      .from('charging_sessions')
      .select('id')
      .eq('booking_id', bookingId)
      .maybeSingle();

    if (!existingSession) {
      await supabase.from('charging_sessions').insert({
        booking_id: bookingId,
        start_time: new Date().toISOString(),
        units_consumed: 0,
        amount: currentBooking.amount,
        status: 'active',
      });
    }

    if (currentBooking.slot_id) {
      await supabase
        .from('charging_slots')
        .update({ status: 'occupied' })
        .eq('id', currentBooking.slot_id);
    }
  } else if (newStatus === 'completed') {
    // Complete active session and create pending payment if not already created
    const { data: session } = await supabase
      .from('charging_sessions')
      .update({
        end_time: new Date().toISOString(),
        status: 'completed',
        units_consumed: Math.max(15, Math.round(currentBooking.amount / 12)),
      })
      .eq('booking_id', bookingId)
      .select()
      .maybeSingle();

    if (session) {
      const { data: existingPayment } = await supabase
        .from('payments')
        .select('id')
        .eq('session_id', session.id)
        .maybeSingle();

      if (!existingPayment) {
        await supabase.from('payments').insert({
          session_id: session.id,
          amount: currentBooking.amount,
          payment_status: 'pending',
        });
      }
    }

    // Release slot back to available
    if (currentBooking.slot_id) {
      await supabase
        .from('charging_slots')
        .update({ status: 'available' })
        .eq('id', currentBooking.slot_id);
    }

    // Sync station availability from actual available slots
    const { count: availSlots } = await supabase
      .from('charging_slots')
      .select('*', { count: 'exact', head: true })
      .eq('station_id', currentBooking.station_id)
      .eq('status', 'available');

    if (availSlots !== null) {
      await supabase
        .from('charging_stations')
        .update({ available_slots: availSlots })
        .eq('id', currentBooking.station_id);
    }
  } else if (newStatus === 'cancelled') {
    // Release slot back to available
    if (currentBooking.slot_id) {
      await supabase
        .from('charging_slots')
        .update({ status: 'available' })
        .eq('id', currentBooking.slot_id);
    }

    // Sync station availability
    const { count: availSlots } = await supabase
      .from('charging_slots')
      .select('*', { count: 'exact', head: true })
      .eq('station_id', currentBooking.station_id)
      .eq('status', 'available');

    if (availSlots !== null) {
      await supabase
        .from('charging_stations')
        .update({ available_slots: availSlots })
        .eq('id', currentBooking.station_id);
    }
  }

  return { data: updatedBooking as Booking, error: null };
}

export async function deleteBooking(bookingId: string): Promise<ApiResult<boolean>> {
  if (!isSupabaseConfigured) {
    mockStore.saveBookings(mockStore.getBookings().filter((b) => b.id !== bookingId));
    return { data: true, error: null };
  }

  // Pre-check: bookings with charging sessions or payments cannot be deleted (audit trail)
  const { count: sessionCount, error: sErr } = await supabase
    .from('charging_sessions')
    .select('*', { count: 'exact', head: true })
    .eq('booking_id', bookingId);

  if (sErr) return { data: false, error: sErr.message };

  if (sessionCount && sessionCount > 0) {
    return {
      data: false,
      error: 'Referential Integrity: This booking has associated charging session or payment records. Historical audit data cannot be deleted.',
    };
  }

  const { error } = await supabase.from('bookings').delete().eq('id', bookingId);
  if (error) {
    if (error.code === '23503') {
      return {
        data: false,
        error: 'Foreign Key Restriction: Cannot delete booking because active records reference it.',
      };
    }
    return { data: false, error: error.message };
  }
  return { data: true, error: null };
}

// ==========================================
// CHARGING SESSIONS & PAYMENTS
// ==========================================

export async function fetchPayments(): Promise<ApiResult<PaymentWithDetails[]>> {
  if (!isSupabaseConfigured) {
    return { data: mockStore.getPayments(), error: null };
  }
  // Supabase JOIN: payments -> charging_sessions -> bookings
  const { data, error } = await supabase
    .from('payments')
    .select(`
      id,
      session_id,
      amount,
      payment_date,
      payment_status,
      charging_sessions (
        id,
        booking_id,
        bookings (
          id,
          customer_name,
          vehicle,
          station_name
        )
      )
    `)
    .order('payment_date', { ascending: false });

  if (error) return { data: null, error: error.message };

  const formatted: PaymentWithDetails[] = ((data as unknown as Record<string, unknown>[]) || []).map((row) => {
    const rawSession = row.charging_sessions;
    const session = (Array.isArray(rawSession) ? rawSession[0] : rawSession) as Record<string, unknown> | undefined;
    const rawBooking = session?.bookings;
    const booking = (Array.isArray(rawBooking) ? rawBooking[0] : rawBooking) as Record<string, unknown> | undefined;
    return {
      id: String(row.id),
      session_id: String(row.session_id),
      amount: Number(row.amount),
      payment_date: String(row.payment_date),
      payment_status: row.payment_status as PaymentWithDetails['payment_status'],
      customer_name: String(booking?.customer_name || 'Verified Driver'),
      vehicle: String(booking?.vehicle || 'Electric Vehicle'),
      station_name: String(booking?.station_name || 'Voltway Station'),
      booking_id: booking?.id ? String(booking.id) : undefined,
    };
  });

  return { data: formatted, error: null };
}

export async function updatePaymentStatus(
  paymentId: string,
  newStatus: 'paid' | 'pending' | 'failed' | 'refunded'
): Promise<ApiResult<boolean>> {
  if (!isSupabaseConfigured) {
    const list = mockStore.getPayments();
    const idx = list.findIndex((p) => p.id === paymentId);
    if (idx !== -1) {
      list[idx].payment_status = newStatus;
      mockStore.savePayments([...list]);
      return { data: true, error: null };
    }
    return { data: false, error: 'Payment record not found' };
  }
  const { error } = await supabase
    .from('payments')
    .update({ payment_status: newStatus, payment_date: new Date().toISOString() })
    .eq('id', paymentId);

  if (error) return { data: false, error: error.message };
  return { data: true, error: null };
}

export async function fetchSessions(): Promise<ApiResult<ChargingSession[]>> {
  if (!isSupabaseConfigured) {
    return { data: mockStore.getSessions(), error: null };
  }
  const { data, error } = await supabase
    .from('charging_sessions')
    .select('*')
    .order('start_time', { ascending: false });

  if (error) return { data: null, error: error.message };
  return { data: data as ChargingSession[], error: null };
}

// ==========================================
// MAINTENANCE
// ==========================================

export async function fetchMaintenance(): Promise<ApiResult<MaintenanceRecord[]>> {
  if (!isSupabaseConfigured) {
    return { data: mockStore.getMaintenance(), error: null };
  }
  const { data, error } = await supabase
    .from('maintenance')
    .select(`
      id,
      station_id,
      title,
      scheduled_start,
      scheduled_end,
      status,
      charging_stations (
        name,
        location
      )
    `)
    .order('scheduled_start', { ascending: false });

  if (error) return { data: null, error: error.message };

  const records: MaintenanceRecord[] = ((data as unknown as Record<string, unknown>[]) || []).map((row) => {
    const rawStation = row.charging_stations;
    const station = (Array.isArray(rawStation) ? rawStation[0] : rawStation) as Record<string, unknown> | undefined;
    return {
      id: String(row.id),
      station_id: String(row.station_id),
      title: String(row.title),
      scheduled_start: String(row.scheduled_start),
      scheduled_end: row.scheduled_end ? String(row.scheduled_end) : null,
      status: row.status as MaintenanceRecord['status'],
      station_name: String(station?.name || 'Charging Station'),
      station_location: String(station?.location || ''),
    };
  });

  return { data: records, error: null };
}

export async function scheduleMaintenance(params: {
  station_id: string;
  title: string;
  scheduled_start: string;
  scheduled_end?: string | null;
}): Promise<ApiResult<MaintenanceRecord>> {
  if (!isSupabaseConfigured) {
    const st = mockStore.getStations().find((s) => s.id === params.station_id);
    const rec: MaintenanceRecord = {
      id: crypto.randomUUID(),
      station_id: params.station_id,
      title: params.title.trim(),
      scheduled_start: params.scheduled_start,
      scheduled_end: params.scheduled_end || null,
      status: 'scheduled',
      station_name: st?.name || 'Charging Station',
      station_location: st?.location || '',
    };
    mockStore.saveMaintenance([rec, ...mockStore.getMaintenance()]);
    const stations = mockStore.getStations();
    const sIdx = stations.findIndex((s) => s.id === params.station_id);
    if (sIdx !== -1) {
      stations[sIdx].status = 'maintenance';
      mockStore.saveStations([...stations]);
    }
    return { data: rec, error: null };
  }

  // 1. Insert maintenance record
  const { data, error } = await supabase
    .from('maintenance')
    .insert({
      station_id: params.station_id,
      title: params.title.trim(),
      scheduled_start: params.scheduled_start,
      scheduled_end: params.scheduled_end || null,
      status: 'scheduled',
    })
    .select()
    .single();

  if (error || !data) return { data: null, error: error?.message || 'Failed to schedule maintenance' };

  // 2. Set station status to 'maintenance'
  await supabase
    .from('charging_stations')
    .update({ status: 'maintenance' })
    .eq('id', params.station_id);

  return { data: data as MaintenanceRecord, error: null };
}

export async function completeMaintenance(
  maintenanceId: string,
  stationId: string
): Promise<ApiResult<boolean>> {
  if (!isSupabaseConfigured) {
    const records = mockStore.getMaintenance();
    const idx = records.findIndex((m) => m.id === maintenanceId);
    if (idx !== -1) {
      records[idx].status = 'completed';
      records[idx].scheduled_end = new Date().toISOString();
      mockStore.saveMaintenance([...records]);
      const otherActive = records.some(
        (m) => m.station_id === stationId && (m.status === 'in_progress' || m.status === 'scheduled')
      );
      if (!otherActive) {
        const stations = mockStore.getStations();
        const sIdx = stations.findIndex((s) => s.id === stationId);
        if (sIdx !== -1) {
          stations[sIdx].status = 'online';
          mockStore.saveStations([...stations]);
        }
      }
      return { data: true, error: null };
    }
    return { data: false, error: 'Maintenance record not found' };
  }
  const { error: mErr } = await supabase
    .from('maintenance')
    .update({
      status: 'completed',
      scheduled_end: new Date().toISOString(),
    })
    .eq('id', maintenanceId);

  if (mErr) return { data: false, error: mErr.message };

  // Check if ANY OTHER active maintenance task exists for this station
  const { count: remainingActive } = await supabase
    .from('maintenance')
    .select('*', { count: 'exact', head: true })
    .eq('station_id', stationId)
    .in('status', ['in_progress', 'scheduled']);

  // Only restore station to 'online' if no other maintenance is scheduled or in progress
  if (!remainingActive || remainingActive === 0) {
    await supabase
      .from('charging_stations')
      .update({ status: 'online' })
      .eq('id', stationId);
  }

  return { data: true, error: null };
}

// ==========================================
// REVIEWS (Database-backed with Migration Notice)
// ==========================================

export interface ReviewsResponse {
  reviews: Review[];
  needsMigration: boolean;
  error: string | null;
}

export async function fetchReviews(): Promise<ReviewsResponse> {
  if (!isSupabaseConfigured) {
    return { reviews: mockStore.getReviews(), needsMigration: false, error: null };
  }

  const { data, error } = await supabase
    .from('reviews')
    .select(`
      id,
      customer_id,
      station_id,
      rating,
      comment,
      created_at,
      customers (
        name
      ),
      charging_stations (
        name
      )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    // Check if table missing in schema
    if (error.code === '42P01' || error.message.includes('public.reviews')) {
      return {
        reviews: [],
        needsMigration: true,
        error: 'Table `reviews` not yet created in PostgreSQL. Run `supabase/migrations/20261014150000_create_reviews_and_indexes.sql` in Supabase SQL Editor.',
      };
    }
    return { reviews: [], needsMigration: false, error: error.message };
  }

  const formatted: Review[] = ((data as unknown as Record<string, unknown>[]) || []).map((row) => {
    const rawCust = row.customers;
    const cust = (Array.isArray(rawCust) ? rawCust[0] : rawCust) as Record<string, unknown> | undefined;
    const rawSt = row.charging_stations;
    const st = (Array.isArray(rawSt) ? rawSt[0] : rawSt) as Record<string, unknown> | undefined;
    return {
      id: String(row.id),
      customer_id: String(row.customer_id),
      station_id: String(row.station_id),
      rating: Number(row.rating),
      comment: String(row.comment),
      created_at: String(row.created_at),
      customer_name: String(cust?.name || 'Verified EV Driver'),
      station_name: String(st?.name || 'Voltway Station'),
    };
  });

  return { reviews: formatted, needsMigration: false, error: null };
}

export async function createReview(params: {
  customer_id: string;
  station_id: string;
  rating: number;
  comment: string;
}): Promise<ApiResult<Review>> {
  if (!isSupabaseConfigured) {
    const cust = mockStore.getCustomers().find((c) => c.id === params.customer_id);
    const st = mockStore.getStations().find((s) => s.id === params.station_id);
    const rev: Review = {
      id: crypto.randomUUID(),
      customer_id: params.customer_id,
      station_id: params.station_id,
      rating: Math.min(5, Math.max(1, Math.round(params.rating))),
      comment: params.comment.trim(),
      created_at: new Date().toISOString(),
      customer_name: cust?.name || 'Verified EV Driver',
      station_name: st?.name || 'Voltway Station',
    };
    mockStore.saveReviews([rev, ...mockStore.getReviews()]);
    return { data: rev, error: null };
  }
  const { data, error } = await supabase
    .from('reviews')
    .insert({
      customer_id: params.customer_id,
      station_id: params.station_id,
      rating: Math.min(5, Math.max(1, Math.round(params.rating))),
      comment: params.comment.trim(),
    })
    .select()
    .single();

  if (error || !data) {
    return { data: null, error: error?.message || 'Failed to submit review' };
  }
  return { data: data as Review, error: null };
}

// ==========================================
// PURE METRIC COMPUTATION (No Redundant Network Calls)
// ==========================================

export function calculateMetricsFromData(params: {
  stations: ChargingStation[];
  bookings: Booking[];
  sessions: ChargingSession[];
  payments: PaymentWithDetails[];
  reviews: Review[];
  actualSlotCount?: number;
}): NetworkMetrics {
  const { stations, bookings, sessions, payments, reviews } = params;

  const totalStations = stations.length;
  const onlineStations = stations.filter((s) => s.status === 'online').length;
  const maintenanceStations = stations.filter((s) => s.status === 'maintenance').length;
  const offlineStations = stations.filter((s) => s.status === 'offline').length;

  const totalSlots = stations.reduce((acc, s) => acc + (s.total_slots || 0), 0);
  const availableSlots = stations.reduce((acc, s) => acc + (s.available_slots || 0), 0);
  const occupiedSlots = Math.max(0, totalSlots - availableSlots);

  const activeSessionsCount = sessions.filter((s) => s.status === 'active').length;
  const totalEnergyKWh = sessions.reduce((acc, s) => acc + (Number(s.units_consumed) || 0), 0);

  const totalRevenue = payments
    .filter((p) => p.payment_status === 'paid')
    .reduce((acc, p) => acc + (Number(p.amount) || 0), 0);

  const pendingRevenue = payments
    .filter((p) => p.payment_status === 'pending')
    .reduce((acc, p) => acc + (Number(p.amount) || 0), 0);

  // Honest metrics: only calculate if records exist
  const avgRating = reviews.length > 0
    ? Number((reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1))
    : 0;

  const uptimePercent = totalStations > 0
    ? Number(((onlineStations / totalStations) * 100).toFixed(1))
    : 0;

  return {
    totalStations,
    onlineStations,
    maintenanceStations,
    offlineStations,
    totalSlots,
    availableSlots,
    occupiedSlots,
    totalBookings: bookings.length,
    activeSessionsCount,
    totalEnergyKWh,
    totalRevenue,
    pendingRevenue,
    avgRating,
    uptimePercent,
  };
}
