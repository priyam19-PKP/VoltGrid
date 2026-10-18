import type {
  ChargingStation,
  ChargingSlot,
  Customer,
  Vehicle,
  Booking,
  ChargingSession,
  PaymentWithDetails,
  MaintenanceRecord,
  Review,
} from '@/types/database';

const STORAGE_KEY_PREFIX = 'voltgrid_demo_';

function getOrInit<T>(key: string, initialData: T): T {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFIX + key);
    if (raw) {
      return JSON.parse(raw) as T;
    }
  } catch (e) {
    console.warn(`Error reading ${key} from localStorage:`, e);
  }
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + key, JSON.stringify(initialData));
  } catch (e) {
    console.warn(`Error writing ${key} to localStorage:`, e);
  }
  return initialData;
}

function save<T>(key: string, data: T): void {
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + key, JSON.stringify(data));
  } catch (e) {
    console.warn(`Error saving ${key} to localStorage:`, e);
  }
}

// Initial Data Seed (matching schema_full.sql)
const SEED_CUSTOMERS: Customer[] = [
  { id: '10000000-0000-0000-0000-000000000001', name: 'Aarav Mehta', phone: '+91 98765 40001', email: 'aarav@example.com', created_at: new Date(Date.now() - 86400000 * 30).toISOString() },
  { id: '10000000-0000-0000-0000-000000000002', name: 'Nisha Kapoor', phone: '+91 98765 40002', email: 'nisha@example.com', created_at: new Date(Date.now() - 86400000 * 25).toISOString() },
  { id: '10000000-0000-0000-0000-000000000003', name: 'Rohan Shah', phone: '+91 98765 40003', email: 'rohan@example.com', created_at: new Date(Date.now() - 86400000 * 20).toISOString() },
  { id: '10000000-0000-0000-0000-000000000004', name: 'Maya Fernandes', phone: '+91 98765 40004', email: 'maya@example.com', created_at: new Date(Date.now() - 86400000 * 15).toISOString() },
];

const SEED_VEHICLES: Vehicle[] = [
  { id: '20000000-0000-0000-0000-000000000001', customer_id: '10000000-0000-0000-0000-000000000001', vehicle_number: 'MH 01 EV 4421', vehicle_model: 'Tesla Model 3', battery_capacity: 60.00, created_at: new Date(Date.now() - 86400000 * 30).toISOString() },
  { id: '20000000-0000-0000-0000-000000000002', customer_id: '10000000-0000-0000-0000-000000000002', vehicle_number: 'DL 04 EV 1818', vehicle_model: 'BYD Atto 3', battery_capacity: 60.48, created_at: new Date(Date.now() - 86400000 * 25).toISOString() },
  { id: '20000000-0000-0000-0000-000000000003', customer_id: '10000000-0000-0000-0000-000000000003', vehicle_number: 'KA 03 EV 9087', vehicle_model: 'Hyundai Ioniq 5', battery_capacity: 72.60, created_at: new Date(Date.now() - 86400000 * 20).toISOString() },
  { id: '20000000-0000-0000-0000-000000000004', customer_id: '10000000-0000-0000-0000-000000000004', vehicle_number: 'MH 02 EV 7712', vehicle_model: 'Kia EV6', battery_capacity: 77.40, created_at: new Date(Date.now() - 86400000 * 15).toISOString() },
];

const SEED_STATIONS: ChargingStation[] = [
  { id: '30000000-0000-0000-0000-000000000001', name: 'Voltway Central', location: 'Downtown · 2.4 km', total_slots: 12, available_slots: 8, power_output: '180 kW', utilization: 72, status: 'online', created_at: new Date(Date.now() - 86400000 * 60).toISOString() },
  { id: '30000000-0000-0000-0000-000000000002', name: 'Green Park Hub', location: 'North District · 4.8 km', total_slots: 8, available_slots: 3, power_output: '240 kW', utilization: 84, status: 'online', created_at: new Date(Date.now() - 86400000 * 45).toISOString() },
  { id: '30000000-0000-0000-0000-000000000003', name: 'Riverside Charge', location: 'East Bank · 7.1 km', total_slots: 10, available_slots: 0, power_output: '150 kW', utilization: 0, status: 'maintenance', created_at: new Date(Date.now() - 86400000 * 40).toISOString() },
];

const SEED_SLOTS: ChargingSlot[] = [
  { id: '40000000-0000-0000-0000-000000000001', station_id: '30000000-0000-0000-0000-000000000001', slot_label: 'Slot A-01', charger_type: 'CCS2', power_rating: '180 kW', status: 'occupied' },
  { id: '40000000-0000-0000-0000-000000000002', station_id: '30000000-0000-0000-0000-000000000001', slot_label: 'Slot A-02', charger_type: 'Type 2', power_rating: '22 kW', status: 'occupied' },
  { id: '40000000-0000-0000-0000-000000000003', station_id: '30000000-0000-0000-0000-000000000001', slot_label: 'Slot A-03', charger_type: 'CCS2', power_rating: '180 kW', status: 'occupied' },
  { id: '40000000-0000-0000-0000-000000000004', station_id: '30000000-0000-0000-0000-000000000001', slot_label: 'Slot A-04', charger_type: 'CCS2', power_rating: '180 kW', status: 'occupied' },
  { id: '40000000-0000-0000-0000-000000000005', station_id: '30000000-0000-0000-0000-000000000001', slot_label: 'Slot A-05', charger_type: 'CCS2', power_rating: '180 kW', status: 'available' },
  { id: '40000000-0000-0000-0000-000000000006', station_id: '30000000-0000-0000-0000-000000000001', slot_label: 'Slot A-06', charger_type: 'Type 2', power_rating: '22 kW', status: 'available' },
  { id: '40000000-0000-0000-0000-000000000007', station_id: '30000000-0000-0000-0000-000000000001', slot_label: 'Slot A-07', charger_type: 'CCS2', power_rating: '180 kW', status: 'available' },
  { id: '40000000-0000-0000-0000-000000000008', station_id: '30000000-0000-0000-0000-000000000001', slot_label: 'Slot A-08', charger_type: 'Type 2', power_rating: '22 kW', status: 'available' },
  { id: '40000000-0000-0000-0000-000000000009', station_id: '30000000-0000-0000-0000-000000000001', slot_label: 'Slot A-09', charger_type: 'Type 2', power_rating: '22 kW', status: 'available' },
  { id: '40000000-0000-0000-0000-000000000010', station_id: '30000000-0000-0000-0000-000000000001', slot_label: 'Slot A-10', charger_type: 'Type 2', power_rating: '22 kW', status: 'available' },
  { id: '40000000-0000-0000-0000-000000000011', station_id: '30000000-0000-0000-0000-000000000001', slot_label: 'Slot A-11', charger_type: 'CCS2', power_rating: '180 kW', status: 'available' },
  { id: '40000000-0000-0000-0000-000000000012', station_id: '30000000-0000-0000-0000-000000000001', slot_label: 'Slot A-12', charger_type: 'Type 2', power_rating: '22 kW', status: 'available' },
  { id: '40000000-0000-0000-0000-000000000013', station_id: '30000000-0000-0000-0000-000000000002', slot_label: 'Slot B-01', charger_type: 'CCS2', power_rating: '240 kW', status: 'occupied' },
  { id: '40000000-0000-0000-0000-000000000014', station_id: '30000000-0000-0000-0000-000000000002', slot_label: 'Slot B-02', charger_type: 'CCS2', power_rating: '240 kW', status: 'occupied' },
  { id: '40000000-0000-0000-0000-000000000015', station_id: '30000000-0000-0000-0000-000000000002', slot_label: 'Slot B-03', charger_type: 'CCS2', power_rating: '240 kW', status: 'occupied' },
  { id: '40000000-0000-0000-0000-000000000016', station_id: '30000000-0000-0000-0000-000000000002', slot_label: 'Slot B-04', charger_type: 'Type 2', power_rating: '22 kW', status: 'occupied' },
  { id: '40000000-0000-0000-0000-000000000017', station_id: '30000000-0000-0000-0000-000000000002', slot_label: 'Slot B-05', charger_type: 'CCS2', power_rating: '120 kW', status: 'available' },
  { id: '40000000-0000-0000-0000-000000000018', station_id: '30000000-0000-0000-0000-000000000002', slot_label: 'Slot B-06', charger_type: 'Type 2', power_rating: '22 kW', status: 'available' },
  { id: '40000000-0000-0000-0000-000000000019', station_id: '30000000-0000-0000-0000-000000000002', slot_label: 'Slot B-07', charger_type: 'CCS2', power_rating: '240 kW', status: 'available' },
  { id: '40000000-0000-0000-0000-000000000020', station_id: '30000000-0000-0000-0000-000000000002', slot_label: 'Slot B-08', charger_type: 'Type 2', power_rating: '22 kW', status: 'available' },
  { id: '40000000-0000-0000-0000-000000000021', station_id: '30000000-0000-0000-0000-000000000003', slot_label: 'Slot C-01', charger_type: 'CCS2', power_rating: '150 kW', status: 'maintenance' },
  { id: '40000000-0000-0000-0000-000000000022', station_id: '30000000-0000-0000-0000-000000000003', slot_label: 'Slot C-02', charger_type: 'Type 2', power_rating: '22 kW', status: 'maintenance' },
  { id: '40000000-0000-0000-0000-000000000023', station_id: '30000000-0000-0000-0000-000000000003', slot_label: 'Slot C-03', charger_type: 'CCS2', power_rating: '150 kW', status: 'maintenance' },
  { id: '40000000-0000-0000-0000-000000000024', station_id: '30000000-0000-0000-0000-000000000003', slot_label: 'Slot C-04', charger_type: 'Type 2', power_rating: '22 kW', status: 'maintenance' },
  { id: '40000000-0000-0000-0000-000000000025', station_id: '30000000-0000-0000-0000-000000000003', slot_label: 'Slot C-05', charger_type: 'CCS2', power_rating: '150 kW', status: 'maintenance' },
  { id: '40000000-0000-0000-0000-000000000026', station_id: '30000000-0000-0000-0000-000000000003', slot_label: 'Slot C-06', charger_type: 'Type 2', power_rating: '22 kW', status: 'maintenance' },
  { id: '40000000-0000-0000-0000-000000000027', station_id: '30000000-0000-0000-0000-000000000003', slot_label: 'Slot C-07', charger_type: 'CCS2', power_rating: '150 kW', status: 'maintenance' },
  { id: '40000000-0000-0000-0000-000000000028', station_id: '30000000-0000-0000-0000-000000000003', slot_label: 'Slot C-08', charger_type: 'Type 2', power_rating: '22 kW', status: 'maintenance' },
  { id: '40000000-0000-0000-0000-000000000029', station_id: '30000000-0000-0000-0000-000000000003', slot_label: 'Slot C-09', charger_type: 'CCS2', power_rating: '150 kW', status: 'maintenance' },
  { id: '40000000-0000-0000-0000-000000000030', station_id: '30000000-0000-0000-0000-000000000003', slot_label: 'Slot C-10', charger_type: 'Type 2', power_rating: '22 kW', status: 'maintenance' },
];

const todayStr = new Date().toISOString().split('T')[0];
const tomorrow = new Date(Date.now() + 86400000);
const tomorrowStr = tomorrow.toISOString().split('T')[0];

const SEED_BOOKINGS: Booking[] = [
  {
    id: '50000000-0000-0000-0000-000000000001',
    customer_id: '10000000-0000-0000-0000-000000000001',
    vehicle_id: '20000000-0000-0000-0000-000000000001',
    station_id: '30000000-0000-0000-0000-000000000001',
    slot_id: '40000000-0000-0000-0000-000000000004',
    customer_name: 'Aarav Mehta',
    vehicle: 'Tesla Model 3',
    station_name: 'Voltway Central',
    slot_label: 'Slot A-04',
    booking_date: todayStr,
    start_time: '10:30',
    status: 'confirmed',
    amount: 420,
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: '50000000-0000-0000-0000-000000000002',
    customer_id: '10000000-0000-0000-0000-000000000002',
    vehicle_id: '20000000-0000-0000-0000-000000000002',
    station_id: '30000000-0000-0000-0000-000000000002',
    slot_id: '40000000-0000-0000-0000-000000000014',
    customer_name: 'Nisha Kapoor',
    vehicle: 'BYD Atto 3',
    station_name: 'Green Park Hub',
    slot_label: 'Slot B-02',
    booking_date: todayStr,
    start_time: '11:15',
    status: 'charging',
    amount: 680,
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: '50000000-0000-0000-0000-000000000003',
    customer_id: '10000000-0000-0000-0000-000000000003',
    vehicle_id: '20000000-0000-0000-0000-000000000003',
    station_id: '30000000-0000-0000-0000-000000000001',
    slot_id: '40000000-0000-0000-0000-000000000009',
    customer_name: 'Rohan Shah',
    vehicle: 'Hyundai Ioniq 5',
    station_name: 'Voltway Central',
    slot_label: 'Slot A-09',
    booking_date: tomorrowStr,
    start_time: '08:45',
    status: 'upcoming',
    amount: 360,
    created_at: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: '50000000-0000-0000-0000-000000000004',
    customer_id: '10000000-0000-0000-0000-000000000004',
    vehicle_id: '20000000-0000-0000-0000-000000000004',
    station_id: '30000000-0000-0000-0000-000000000002',
    slot_id: '40000000-0000-0000-0000-000000000017',
    customer_name: 'Maya Fernandes',
    vehicle: 'Kia EV6',
    station_name: 'Green Park Hub',
    slot_label: 'Slot B-05',
    booking_date: tomorrowStr,
    start_time: '13:00',
    status: 'upcoming',
    amount: 520,
    created_at: new Date(Date.now() - 14400000).toISOString(),
  },
];

const SEED_SESSIONS: ChargingSession[] = [
  {
    id: '60000000-0000-0000-0000-000000000001',
    booking_id: '50000000-0000-0000-0000-000000000002',
    start_time: new Date(Date.now() - 18 * 60000).toISOString(),
    end_time: null,
    units_consumed: 24.50,
    amount: 680,
    status: 'active',
  },
];

const SEED_PAYMENTS: PaymentWithDetails[] = [
  {
    id: '70000000-0000-0000-0000-000000000001',
    session_id: '60000000-0000-0000-0000-000000000001',
    amount: 680,
    payment_date: new Date(Date.now() - 15 * 60000).toISOString(),
    payment_status: 'paid',
    customer_name: 'Nisha Kapoor',
    vehicle: 'BYD Atto 3',
    station_name: 'Green Park Hub',
    booking_id: '50000000-0000-0000-0000-000000000002',
  },
];

const SEED_MAINTENANCE: MaintenanceRecord[] = [
  {
    id: '80000000-0000-0000-0000-000000000001',
    station_id: '30000000-0000-0000-0000-000000000003',
    title: 'Firmware upgrade & inverter sensor calibration',
    scheduled_start: new Date(Date.now() - 3600000).toISOString(),
    scheduled_end: new Date(Date.now() + 7200000).toISOString(),
    status: 'in_progress',
    station_name: 'Riverside Charge',
    station_location: 'East Bank · 7.1 km',
  },
];

const SEED_REVIEWS: Review[] = [
  {
    id: '90000000-0000-0000-0000-000000000001',
    customer_id: '10000000-0000-0000-0000-000000000002',
    station_id: '30000000-0000-0000-0000-000000000001',
    rating: 5,
    comment: 'Fastest charging stop on my daily route. Slot was reserved and activated immediately upon arrival.',
    created_at: new Date(Date.now() - 2 * 3600000).toISOString(),
    customer_name: 'Nisha Kapoor',
    station_name: 'Voltway Central',
  },
  {
    id: '90000000-0000-0000-0000-000000000002',
    customer_id: '10000000-0000-0000-0000-000000000001',
    station_id: '30000000-0000-0000-0000-000000000002',
    rating: 5,
    comment: 'Ultra-fast 240 kW CCS2 charger delivered from 20% to 80% in 22 minutes. Very clean hub and clear signage.',
    created_at: new Date(Date.now() - 86400000).toISOString(),
    customer_name: 'Aarav Mehta',
    station_name: 'Green Park Hub',
  },
  {
    id: '90000000-0000-0000-0000-000000000003',
    customer_id: '10000000-0000-0000-0000-000000000004',
    station_id: '30000000-0000-0000-0000-000000000001',
    rating: 4,
    comment: 'Reliable charging experience. Booking was seamless. Would appreciate adding a coffee vending machine near bay A.',
    created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    customer_name: 'Maya Fernandes',
    station_name: 'Voltway Central',
  },
  {
    id: '90000000-0000-0000-0000-000000000004',
    customer_id: '10000000-0000-0000-0000-000000000003',
    station_id: '30000000-0000-0000-0000-000000000002',
    rating: 4,
    comment: 'Smooth payment settlement and live status tracking in the dashboard. Will use again.',
    created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    customer_name: 'Rohan Shah',
    station_name: 'Green Park Hub',
  },
];

export interface AdminAccount {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: string;
  created_at: string;
}

const SEED_ADMINS: AdminAccount[] = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'Primary Administrator',
    email: 'admin@voltgrid.com',
    password: 'admin',
    role: 'Operations Director',
    created_at: new Date(Date.now() - 86400000 * 60).toISOString(),
  },
];

export const mockStore = {
  getCustomers: (): Customer[] => getOrInit('customers', SEED_CUSTOMERS),
  saveCustomers: (d: Customer[]): void => save('customers', d),

  getVehicles: (): Vehicle[] => getOrInit('vehicles', SEED_VEHICLES),
  saveVehicles: (d: Vehicle[]): void => save('vehicles', d),

  getStations: (): ChargingStation[] => getOrInit('stations', SEED_STATIONS),
  saveStations: (d: ChargingStation[]): void => save('stations', d),

  getSlots: (): ChargingSlot[] => getOrInit('slots', SEED_SLOTS),
  saveSlots: (d: ChargingSlot[]): void => save('slots', d),

  getBookings: (): Booking[] => getOrInit('bookings', SEED_BOOKINGS),
  saveBookings: (d: Booking[]): void => save('bookings', d),

  getSessions: (): ChargingSession[] => getOrInit('sessions', SEED_SESSIONS),
  saveSessions: (d: ChargingSession[]): void => save('sessions', d),

  getPayments: (): PaymentWithDetails[] => getOrInit('payments', SEED_PAYMENTS),
  savePayments: (d: PaymentWithDetails[]): void => save('payments', d),

  getMaintenance: (): MaintenanceRecord[] => getOrInit('maintenance', SEED_MAINTENANCE),
  saveMaintenance: (d: MaintenanceRecord[]): void => save('maintenance', d),

  getReviews: (): Review[] => getOrInit('reviews', SEED_REVIEWS),
  saveReviews: (d: Review[]): void => save('reviews', d),

  getAdmins: (): AdminAccount[] => getOrInit('admins', SEED_ADMINS),
  saveAdmins: (d: AdminAccount[]): void => save('admins', d),

  createAdmin: (account: Omit<AdminAccount, 'id' | 'created_at'>): AdminAccount => {
    const list = getOrInit('admins', SEED_ADMINS);
    const existing = list.find((a) => a.email.toLowerCase() === account.email.toLowerCase());
    if (existing) {
      throw new Error(`An administrator account with email "${account.email}" already exists.`);
    }
    const newAdmin: AdminAccount = {
      id: crypto.randomUUID(),
      name: account.name.trim(),
      email: account.email.trim().toLowerCase(),
      password: account.password,
      role: account.role || 'Network Operations Admin',
      created_at: new Date().toISOString(),
    };
    save('admins', [...list, newAdmin]);
    return newAdmin;
  },

  // Reset to original seed
  resetAll: () => {
    save('customers', SEED_CUSTOMERS);
    save('vehicles', SEED_VEHICLES);
    save('stations', SEED_STATIONS);
    save('slots', SEED_SLOTS);
    save('bookings', SEED_BOOKINGS);
    save('sessions', SEED_SESSIONS);
    save('payments', SEED_PAYMENTS);
    save('maintenance', SEED_MAINTENANCE);
    save('reviews', SEED_REVIEWS);
    save('admins', SEED_ADMINS);
  },
};

