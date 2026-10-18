import { useEffect, useState, useCallback } from 'react';
import { Sidebar, NavItemKey } from '@/components/Layout/Sidebar';
import { Header, DbConnectionStatus } from '@/components/Layout/Header';
import { OverviewView } from '@/components/Overview/OverviewView';
import { StationsView } from '@/components/Stations/StationsView';
import { BookingsView } from '@/components/Bookings/BookingsView';
import { PaymentsView } from '@/components/Payments/PaymentsView';
import { ReviewsView } from '@/components/Reviews/ReviewsView';
import { MaintenanceView } from '@/components/Maintenance/MaintenanceView';
import { CustomersView } from '@/components/Customers/CustomersView';
import { AnalyticsView } from '@/components/Analytics/AnalyticsView';
import { DatabaseDocsView } from '@/components/DatabaseDocs/DatabaseDocsView';
import { BackToTop } from '@/components/Common/BackToTop';
import { SkeletonKpiCard, SkeletonTable } from '@/components/Common/Skeleton';

import type {
  ChargingStation,
  Booking,
  PaymentWithDetails,
  ChargingSession,
  Customer,
  Vehicle,
  MaintenanceRecord,
  Review,
  NetworkMetrics,
} from '@/types/database';

import {
  fetchStations,
  fetchBookings,
  fetchPayments,
  fetchSessions,
  fetchCustomers,
  fetchVehicles,
  fetchMaintenance,
  fetchReviews,
  fetchActualSlotCount,
  calculateMetricsFromData,
  checkDatabaseConnection,
} from '@/lib/api';

import { useAuth } from '@/context/AuthContext';
import { LoginPage } from '@/components/Auth/LoginPage';

export function App() {
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const [activeNav, setActiveNav] = useState<NavItemKey>('Overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [dbStatus, setDbStatus] = useState<DbConnectionStatus>('connecting');

  // Quick Action Modal States
  const [isNewBookingModalOpen, setIsNewBookingModalOpen] = useState(false);
  const [isNewStationModalOpen, setIsNewStationModalOpen] = useState(false);

  // Live Database State
  const [stations, setStations] = useState<ChargingStation[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [payments, setPayments] = useState<PaymentWithDetails[]>([]);
  const [sessions, setSessions] = useState<ChargingSession[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsNeedMigration, setReviewsNeedMigration] = useState(false);
  const [actualSlotCount, setActualSlotCount] = useState<number>(0);

  const [metrics, setMetrics] = useState<NetworkMetrics>({
    totalStations: 0,
    onlineStations: 0,
    maintenanceStations: 0,
    offlineStations: 0,
    totalSlots: 0,
    availableSlots: 0,
    occupiedSlots: 0,
    totalBookings: 0,
    activeSessionsCount: 0,
    totalEnergyKWh: 0,
    totalRevenue: 0,
    pendingRevenue: 0,
    avgRating: 0,
    uptimePercent: 0,
  });

  // Navigate and clear search query so search does not persist across views
  const handleNavSelect = (key: NavItemKey) => {
    setActiveNav(key);
    setSearchQuery('');
  };

  // Load all live records from PostgreSQL
  const loadAllData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [
        connRes,
        stationsRes,
        bookingsRes,
        paymentsRes,
        sessionsRes,
        customersRes,
        vehiclesRes,
        maintenanceRes,
        reviewsRes,
        slotCount,
      ] = await Promise.all([
        checkDatabaseConnection(),
        fetchStations(),
        fetchBookings(),
        fetchPayments(),
        fetchSessions(),
        fetchCustomers(),
        fetchVehicles(),
        fetchMaintenance(),
        fetchReviews(),
        fetchActualSlotCount(),
      ]);

      if (connRes.connected) {
        setDbStatus(connRes.isDemo ? 'demo' : 'connected');
      } else {
        setDbStatus('error');
      }

      const st = stationsRes.data || [];
      const bk = bookingsRes.data || [];
      const pm = paymentsRes.data || [];
      const cs = sessionsRes.data || [];
      const cu = customersRes.data || [];
      const vh = vehiclesRes.data || [];
      const mn = maintenanceRes.data || [];

      setStations(st);
      setBookings(bk);
      setPayments(pm);
      setSessions(cs);
      setCustomers(cu);
      setVehicles(vh);
      setMaintenanceRecords(mn);

      if (reviewsRes.reviews) {
        setReviews(reviewsRes.reviews);
        setReviewsNeedMigration(reviewsRes.needsMigration);
      }

      setActualSlotCount(slotCount);

      // In-memory pure aggregation: zero duplicate queries
      const computedMetrics = calculateMetricsFromData({
        stations: st,
        bookings: bk,
        sessions: cs,
        payments: pm,
        reviews: reviewsRes.reviews || [],
        actualSlotCount: slotCount,
      });
      setMetrics(computedMetrics);
    } catch (err) {
      console.error('Error synchronizing database:', err);
      setDbStatus('error');
    } finally {
      setIsRefreshing(false);
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user && isAdmin) {
      void loadAllData();
    } else {
      setInitialLoading(false);
    }
  }, [loadAllData, user, isAdmin]);

  // Actual table row counts for ADM Database Explorer
  const tableCounts: Record<string, number> = {
    charging_stations: stations.length,
    charging_slots: actualSlotCount || stations.reduce((acc, s) => acc + s.total_slots, 0),
    customers: customers.length,
    vehicles: vehicles.length,
    bookings: bookings.length,
    charging_sessions: sessions.length,
    payments: payments.length,
    maintenance: maintenanceRecords.length,
    reviews: reviews.length,
    admin_users: 1,
  };

  // Auth Loading Screen
  if (authLoading) {
    return (
      <div className="login-container" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="login-card" style={{ maxWidth: '360px', textAlign: 'center', padding: '32px 24px' }}>
          <div className="login-logo-wrap" style={{ margin: '0 auto 16px' }}>
            <img src="/voltgrid-logo.jpg" alt="VoltGrid" className="login-logo-img" />
          </div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
            VoltGrid Admin Portal
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <div className="pulse-dot active" />
            <span>Verifying administrator authorization...</span>
          </div>
        </div>
      </div>
    );
  }

  // Guard: Unauthenticated visitors or non-admins are directed to LoginPage
  if (!user || !isAdmin) {
    return <LoginPage />;
  }

  return (
    <div className="app-shell">
      {/* Sidebar Navigation */}
      <Sidebar
        activeNav={activeNav}
        onSelectNav={handleNavSelect}
        isOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        bookingCount={bookings.filter((b) => b.status === 'confirmed' || b.status === 'charging').length}
        dbStatus={dbStatus}
      />

      {/* Main Content Area */}
      <main className="main-content">
        <Header
          activeNav={activeNav}
          mobileMenuOpen={mobileMenuOpen}
          onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onRefreshData={loadAllData}
          isRefreshing={isRefreshing}
          dbStatus={dbStatus}
        />

        <div className="page-content">
          {initialLoading ? (
            <div className="space-y-6" aria-busy="true" aria-label="Loading application records">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '9px 14px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                }}
              >
                <div className="pulse-dot warning" />
                <span>Synchronizing live relational records with PostgreSQL...</span>
              </div>
              <div className="stats-grid">
                <SkeletonKpiCard />
                <SkeletonKpiCard />
                <SkeletonKpiCard />
                <SkeletonKpiCard />
              </div>
              <div className="panel">
                <div className="panel-heading">
                  <div>
                    <span className="panel-kicker">Data Pipeline</span>
                    <h3>Loading Network Fleet & Bookings</h3>
                  </div>
                </div>
                <SkeletonTable rows={5} columns={6} />
              </div>
            </div>
          ) : (
            <>
              {activeNav === 'Overview' && (
                <OverviewView
                  metrics={metrics}
                  stations={stations}
                  recentBookings={bookings}
                  maintenanceRecords={maintenanceRecords}
                  onNavigate={handleNavSelect}
                  onOpenNewBooking={() => setIsNewBookingModalOpen(true)}
                  onOpenNewStation={() => setIsNewStationModalOpen(true)}
                />
              )}

              {activeNav === 'Stations' && (
                <StationsView
                  stations={stations}
                  searchQuery={searchQuery}
                  onRefresh={loadAllData}
                  isAddModalOpen={isNewStationModalOpen}
                  onOpenAddModal={() => setIsNewStationModalOpen(true)}
                  onCloseAddModal={() => setIsNewStationModalOpen(false)}
                />
              )}

              {activeNav === 'Bookings' && (
                <BookingsView
                  bookings={bookings}
                  stations={stations}
                  searchQuery={searchQuery}
                  onRefresh={loadAllData}
                  isNewBookingOpen={isNewBookingModalOpen}
                  onOpenNewBooking={() => setIsNewBookingModalOpen(true)}
                  onCloseNewBooking={() => setIsNewBookingModalOpen(false)}
                />
              )}

              {activeNav === 'Payments' && (
                <PaymentsView
                  payments={payments}
                  searchQuery={searchQuery}
                  onRefresh={loadAllData}
                />
              )}

              {activeNav === 'Reviews' && (
                <ReviewsView
                  reviews={reviews}
                  customers={customers}
                  stations={stations}
                  searchQuery={searchQuery}
                  needsMigration={reviewsNeedMigration}
                  onRefresh={loadAllData}
                  onNavigateToDocs={() => handleNavSelect('Database')}
                />
              )}

              {activeNav === 'Maintenance' && (
                <MaintenanceView
                  records={maintenanceRecords}
                  stations={stations}
                  searchQuery={searchQuery}
                  onRefresh={loadAllData}
                />
              )}

              {activeNav === 'Customers' && (
                <CustomersView
                  customers={customers}
                  vehicles={vehicles}
                  searchQuery={searchQuery}
                  onRefresh={loadAllData}
                />
              )}

              {activeNav === 'Analytics' && (
                <AnalyticsView
                  stations={stations}
                  bookings={bookings}
                  payments={payments}
                  sessions={sessions}
                  vehicles={vehicles}
                />
              )}

              {activeNav === 'Database' && (
                <DatabaseDocsView tableCounts={tableCounts} />
              )}
            </>
          )}
        </div>
        <BackToTop />
      </main>
    </div>
  );
}

export default App;
