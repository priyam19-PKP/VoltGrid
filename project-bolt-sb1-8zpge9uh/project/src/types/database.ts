export type StationStatus = 'online' | 'maintenance' | 'offline';
export type SlotStatus = 'available' | 'occupied' | 'maintenance';
export type BookingStatus = 'upcoming' | 'confirmed' | 'charging' | 'completed' | 'cancelled';
export type SessionStatus = 'active' | 'completed' | 'cancelled';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';
export type MaintenanceStatus = 'scheduled' | 'in_progress' | 'completed';

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  created_at?: string;
}

export interface Vehicle {
  id: string;
  customer_id: string;
  vehicle_number: string;
  vehicle_model: string;
  battery_capacity: number;
  created_at?: string;
}

export interface VehicleWithCustomer extends Vehicle {
  customer?: Customer;
}

export interface ChargingStation {
  id: string;
  name: string;
  location: string;
  total_slots: number;
  available_slots: number;
  power_output: string;
  utilization: number;
  status: StationStatus;
  created_at?: string;
}

export interface ChargingSlot {
  id: string;
  station_id: string;
  slot_label: string;
  charger_type: string;
  power_rating: string;
  status: SlotStatus;
}

export interface Booking {
  id: string;
  customer_id: string;
  vehicle_id: string;
  station_id: string;
  slot_id?: string | null;
  customer_name: string;
  vehicle: string;
  station_name: string;
  slot_label: string;
  booking_date: string;
  start_time: string;
  status: BookingStatus;
  amount: number;
  created_at?: string;
}

export interface ChargingSession {
  id: string;
  booking_id: string;
  start_time: string | null;
  end_time: string | null;
  units_consumed: number;
  amount: number;
  status: SessionStatus;
}

export interface Payment {
  id: string;
  session_id: string;
  amount: number;
  payment_date: string;
  payment_status: PaymentStatus;
}

export interface PaymentWithDetails extends Payment {
  customer_name?: string;
  vehicle?: string;
  station_name?: string;
  booking_id?: string;
}

export interface MaintenanceRecord {
  id: string;
  station_id: string;
  title: string;
  scheduled_start: string;
  scheduled_end: string | null;
  status: MaintenanceStatus;
  station_name?: string;
  station_location?: string;
}

export interface Review {
  id: string;
  customer_id: string;
  station_id: string;
  rating: number;
  comment: string;
  created_at: string;
  customer_name?: string;
  station_name?: string;
}

export interface NetworkMetrics {
  totalStations: number;
  onlineStations: number;
  maintenanceStations: number;
  offlineStations: number;
  totalSlots: number;
  availableSlots: number;
  occupiedSlots: number;
  totalBookings: number;
  activeSessionsCount: number;
  totalEnergyKWh: number;
  totalRevenue: number;
  pendingRevenue: number;
  avgRating: number;
  uptimePercent: number;
}

export interface AdminUser {
  id: string;
  user_id: string;
  email: string | null;
  is_active: boolean;
  created_at: string;
}
