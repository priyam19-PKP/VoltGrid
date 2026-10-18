# VoltGrid — EV Charging Network Management System
## Enterprise EV Charging Operations & Relational Database Platform
**Motto:** Charge a Cleaner Tomorrow  
**Database Technology:** PostgreSQL 15.x via Supabase Cloud  
**Application Stack:** React 18, TypeScript, Vite, Tailwind CSS, Lucide React

---

## 1. Executive Summary & Database Purpose

The EV Charging Network Management System is an enterprise-grade operational platform built to manage commercial electric vehicle charging infrastructure. The primary engineering goal for the ADM coursework is to implement and demonstrate a normalized, ACID-compliant relational database that models:

- Fleet customers and their associated registered electric vehicles (1:N relationship).
- Charging hubs, physical connector bays (slots), and live power telemetry.
- Booking reservations with referential validation and concurrency control.
- Live charging sessions with energy metering (kWh) and duration logging.
- Billing ledger and payment transaction reconciliation.
- Infrastructure maintenance work orders and operational status synchronization.
- Customer satisfaction surveys and rating constraints.

---

## 2. Entity-Relationship (ER) Architecture

### Textual Entity Relationship Diagram
```text
+----------------+          +-------------------+
|   CUSTOMERS    | 1      N |     VEHICLES      |
|----------------|----------|-------------------|
| PK  id (UUID)  |          | PK  id (UUID)     |
|     name       |          | FK  customer_id   | ON DELETE CASCADE
|     phone      |          |     vehicle_number|
|     email      |          |     vehicle_model |
|     created_at |          |     battery_cap   | CHECK (> 0)
+----------------+          +-------------------+
       | 1                           | 1
       |                             |
       | N                           | N
+-----------------------------------------------+
|                   BOOKINGS                    |
|-----------------------------------------------|
| PK  id (UUID)                                 |
| FK  customer_id -> customers(id)              | ON DELETE RESTRICT
| FK  vehicle_id  -> vehicles(id)               | ON DELETE RESTRICT
| FK  station_id  -> charging_stations(id)      | ON DELETE RESTRICT
| FK  slot_id     -> charging_slots(id)         | ON DELETE SET NULL
|     customer_name, vehicle, station_name,     | (Historical Snapshot)
|     slot_label, booking_date, start_time      |
|     status (upcoming|confirmed|charging|...)  | CHECK
|     amount                                    | CHECK (>= 0)
+-----------------------------------------------+
       | 1                           | 1
       |                             |
       | 1                           | N
+----------------------+    +-----------------------+
|  CHARGING_SESSIONS   |    |   CHARGING_STATIONS   |
|----------------------|    |-----------------------|
| PK  id (UUID)        |    | PK  id (UUID)         |
| FK  booking_id       |    |     name              |
|     start_time       |    |     location          |
|     end_time         |    |     total_slots       | CHECK (> 0)
|     units_consumed   |    |     available_slots   | CHECK (>= 0)
|     amount           |    |     power_output      |
|     status           |    |     utilization       | CHECK (0-100)
+----------------------+    |     status (online|..) | CHECK
       | 1                  +-----------------------+
       |                             | 1
       | 1                           |
+----------------------+             | N
|       PAYMENTS       |    +-----------------------+
|----------------------|    |    CHARGING_SLOTS     |
| PK  id (UUID)        |    |-----------------------|
| FK  session_id       |    | PK  id (UUID)         |
|     amount           |    | FK  station_id        | ON DELETE CASCADE
|     payment_date     |    |     slot_label        |
|     payment_status   |    |     charger_type      |
+----------------------+    |     power_rating      |
                            |     status            | UNIQUE (station, slot)
                            +-----------------------+
                                     | 1
                                     |
                                     | N
                            +-----------------------+
                            |      MAINTENANCE      |
                            |-----------------------|
                            | PK  id (UUID)         |
                            | FK  station_id        | ON DELETE CASCADE
                            |     title             |
                            |     scheduled_start   |
                            |     scheduled_end     |
                            |     status            |
                            +-----------------------+
```

---

## 3. Relational Schema & Table Specifications

| # | Table Name | Primary Key | Foreign Keys | Key Constraints & Integrity Rules |
|---|------------|-------------|--------------|-----------------------------------|
| 1 | `customers` | `id` (UUID) | None | `name` NOT NULL |
| 2 | `vehicles` | `id` (UUID) | `customer_id` &rarr; `customers.id` | `ON DELETE CASCADE`, `battery_capacity > 0` |
| 3 | `charging_stations` | `id` (UUID) | None | `total_slots > 0`, `available_slots >= 0`, `utilization BETWEEN 0 AND 100`, `status IN ('online', 'maintenance', 'offline')` |
| 4 | `charging_slots` | `id` (UUID) | `station_id` &rarr; `charging_stations.id` | `ON DELETE CASCADE`, `UNIQUE (station_id, slot_label)`, `status IN ('available', 'occupied', 'maintenance')` |
| 5 | `bookings` | `id` (UUID) | `customer_id`, `vehicle_id`, `station_id`, `slot_id` | `ON DELETE RESTRICT` for station & customer, `ON DELETE SET NULL` for slot, `status` check, `amount >= 0` |
| 6 | `charging_sessions` | `id` (UUID) | `booking_id` &rarr; `bookings.id` | `ON DELETE RESTRICT`, `units_consumed >= 0`, `amount >= 0` |
| 7 | `payments` | `id` (UUID) | `session_id` &rarr; `charging_sessions.id` | `ON DELETE RESTRICT`, `amount >= 0`, `payment_status IN ('pending', 'paid', 'failed', 'refunded')` |
| 8 | `maintenance` | `id` (UUID) | `station_id` &rarr; `charging_stations.id` | `ON DELETE CASCADE`, `status IN ('scheduled', 'in_progress', 'completed')` |
| 9 | `reviews` | `id` (UUID) | `customer_id`, `station_id` | `ON DELETE CASCADE`, `rating BETWEEN 1 AND 5`, `comment` NOT NULL |
| 10 | `admin_users` | `id` (UUID) | `user_id` &rarr; `auth.users(id)` | `ON DELETE CASCADE`, `UNIQUE (user_id)`, `is_active` boolean |

---

## 4. Normalization Analysis (1NF, 2NF, 3NF)

### First Normal Form (1NF)
- All columns contain atomic, indivisible values.
- No repeating groups or multivalued arrays.
- Every table possesses an explicit primary key (`UUID DEFAULT gen_random_uuid()`).

### Second Normal Form (2NF)
- Satisfies 1NF.
- There are no partial functional dependencies: all non-key columns depend on the entire primary key.
- Connectors (`charging_slots`) are separated from charging stations, preventing data duplication.

### Third Normal Form (3NF) & Intentional Historical Snapshot Design
- Satisfies 2NF.
- Transitive dependencies are removed across customer profiles, stations, and billing sessions.
- **Intentional Audit Snapshots:** The `bookings` table intentionally captures `customer_name`, `vehicle`, and `station_name` as frozen snapshot text at the moment of reservation. In real financial and legal accounting, if a customer updates their legal name or a vehicle registration is re-assigned years later, the historical invoice record must remain unchanged.

---

## 5. B-Tree Performance Indexes (Query Optimization)

To demonstrate ADM Indexing concepts, the schema implements targeted indexes to optimize join lookups and search filtering:

```sql
-- Foreign Key Lookups (Prevents O(N) Table Scans on Joins)
CREATE INDEX idx_vehicles_customer_id ON vehicles(customer_id);
CREATE INDEX idx_charging_slots_station_id ON charging_slots(station_id);
CREATE INDEX idx_bookings_customer_id ON bookings(customer_id);
CREATE INDEX idx_bookings_station_id ON bookings(station_id);
CREATE INDEX idx_bookings_slot_id ON bookings(slot_id);
CREATE INDEX idx_charging_sessions_booking_id ON charging_sessions(booking_id);
CREATE INDEX idx_payments_session_id ON payments(session_id);
CREATE INDEX idx_maintenance_station_id ON maintenance(station_id);

-- Composite Index for Schedule Lookups
CREATE INDEX idx_bookings_date_status ON bookings(booking_date, status);
```

---

## 6. Tested SQL Demonstration Queries

### Query 1: 4-Table Relational JOIN
Retrieves complete booking information with customer contact, vehicle model, and station location.
```sql
SELECT 
  b.id AS booking_id,
  c.name AS customer_name,
  c.phone AS customer_phone,
  v.vehicle_model,
  v.vehicle_number,
  s.name AS station_name,
  s.location AS station_location,
  b.booking_date,
  b.start_time,
  b.status AS booking_status,
  b.amount
FROM bookings b
JOIN customers c ON b.customer_id = c.id
JOIN vehicles v ON b.vehicle_id = v.id
JOIN charging_stations s ON b.station_id = s.id
ORDER BY b.booking_date DESC;
```

### Query 2: Aggregate Query with GROUP BY & SUM
Calculates total realized revenue, average charge per session, and total transactions per charging hub.
```sql
SELECT 
  cs.name AS station_name,
  COUNT(p.id) AS total_settled_payments,
  SUM(p.amount) AS total_revenue_inr,
  ROUND(AVG(p.amount), 2) AS avg_transaction_inr
FROM payments p
JOIN charging_sessions sess ON p.session_id = sess.id
JOIN bookings b ON sess.booking_id = b.id
JOIN charging_stations cs ON b.station_id = cs.id
WHERE p.payment_status = 'paid'
GROUP BY cs.name
ORDER BY total_revenue_inr DESC;
```

### Query 3: Aggregate Query with HAVING Filter
Finds stations with heavy booking volume (demonstrating aggregate filtering).
```sql
SELECT 
  s.name AS station_name,
  s.power_output,
  COUNT(b.id) AS total_reservations
FROM charging_stations s
LEFT JOIN bookings b ON s.id = b.station_id
GROUP BY s.id, s.name, s.power_output
HAVING COUNT(b.id) >= 1
ORDER BY total_reservations DESC;
```

### Query 4: Referential Integrity Check: Station Deletion Protection
Demonstrates PostgreSQL `ON DELETE RESTRICT` constraint protecting historical booking data.
```sql
-- Attempting to delete a station that has active bookings:
DELETE FROM charging_stations 
WHERE id = '30000000-0000-0000-0000-000000000001';

-- Result:
-- ERROR: update or delete on table "charging_stations" violates 
-- foreign key constraint "bookings_station_id_fkey" on table "bookings"
-- DETAIL: Key (id)=(30000000-0000-0000-0000-000000000001) is still referenced from table "bookings".
```

---

## 7. Supabase Setup & Migration Guide

### Step 1: Environment Configuration
Create or update your local `.env` file in the project root:
```env
# Supabase Project Credentials (Never commit .env to Git)
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
> **Security Note:** Use ONLY the public `anon` key in `VITE_SUPABASE_ANON_KEY`. Never expose your database password or `service_role` key in frontend environment variables.

---

### Step 2: Database Initialization (Choose Option A OR Option B)

> **Important:** Choose **either** Option A or Option B. Do not run Option A and then re-run the migrations.

#### Option A: Single Consolidated Script (Recommended for Fresh Projects)
For a newly created Supabase project, initialize all 10 tables, referential constraints, 12 indexes, seed records, and RLS policies in one step:
1. Open your **Supabase Dashboard** &rarr; **SQL Editor** &rarr; **New query**.
2. Open [`supabase/schema_full.sql`](supabase/schema_full.sql), copy its entire contents, and paste into the SQL Editor.
3. Click **Run**.
4. Confirm message: `Success. No rows returned.`

#### Option B: Step-by-Step Migration Order
If you prefer applying incremental forward migrations, execute all 5 files in exact timestamp order:
1. `supabase/migrations/20261014134822_create_ev_charging_network.sql`  
   *Creates the initial 8 relational tables, starter fleet data, and baseline constraints.*
2. `supabase/migrations/20261014150000_create_reviews_and_indexes.sql`  
   *Creates `reviews` table, 1-5 rating checks, and 11 B-Tree query performance indexes.*
3. `supabase/migrations/20261014160000_reconcile_charging_slots.sql`  
   *Reconciles station total/available capacities by inserting individual bays (30 total).*
4. `supabase/migrations/20261014170000_fix_station_deletion_cascades.sql`  
   *Enforces ON DELETE CASCADE on physical child tables and ON DELETE RESTRICT on bookings.*
5. `supabase/migrations/20261015120000_create_admin_auth_and_secure_rls.sql`  
   *Creates `admin_users` table, `is_admin()` SECURITY DEFINER function, revokes anonymous access, and enforces strict admin RLS on all tables.*

---

### Step 3: Create & Authorize Your First Administrator Account
1. In the Supabase Dashboard, go to **Authentication** &rarr; **Users** &rarr; **Add user** &rarr; **Create user**.
2. Enter your administrator email (e.g. `admin@voltgrid.com`) and a secure password.
3. Ensure **Auto Confirm User?** is enabled, then click **Create user**.
4. Copy the newly generated **User UID** from the users table.
5. In **SQL Editor**, run the authorization query:
   ```sql
   INSERT INTO public.admin_users (user_id, email, is_active)
   VALUES (
     '<PASTE-COPIED-USER-UID-HERE>'::uuid,
     'admin@voltgrid.com',
     true
   )
   ON CONFLICT (user_id) DO UPDATE SET is_active = true;
   ```

---

### Step 4: Run the Application Locally
Restart your Vite development server whenever `.env` is updated:
```bash
npm install
npm run dev
```
Navigate to `http://localhost:5173`, sign in using your administrator credentials, and manage the live network fleet.

---

## 8. Technical Architecture & Viva Voce Reference Guide

### Q1: What is the purpose of Row Level Security (RLS)?
**Answer:** RLS allows database administrators to define security policies at the PostgreSQL row level. It ensures that queries execute within the permitted scope of the requesting user or role (`anon` or `authenticated`), preventing unauthorized read/write access.

### Q2: Why is UUID preferred over auto-incrementing serial integers for primary keys?
**Answer:** UUIDs (128-bit universally unique identifiers) eliminate collision risks in distributed environments, allow offline or client-side ID pre-generation, and prevent sequential enumeration attacks where attackers guess consecutive order IDs.

### Q3: What is the difference between CASCADE, RESTRICT, and SET NULL on Foreign Keys?
**Answer:**
- `CASCADE`: Deleting the parent record automatically deletes all referencing child records (e.g., deleting a station deletes its slots).
- `RESTRICT`: Prevents deletion of the parent record if any child record references it (e.g., preventing deletion of a station if active bookings exist).
- `SET NULL`: Deleting the parent sets the child foreign key column to NULL while keeping the child record intact.
