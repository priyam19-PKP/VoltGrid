import React, { useState, useEffect, useCallback } from 'react';
import {
  Database,
  Table,
  Key,
  Link,
  Code,
  Layers,
  HelpCircle,
  Eye,
  RefreshCw,
  Search,
  AlertCircle,
} from 'lucide-react';
import { fetchTableRecords } from '@/lib/api';
import { CopyButton } from '@/components/Common/CopyButton';
import { SkeletonTable } from '@/components/Common/Skeleton';

interface TableStat {
  name: string;
  count: number;
  description: string;
  pk: string;
  fks: string[];
}

interface DatabaseDocsViewProps {
  tableCounts: Record<string, number>;
}

export const DatabaseDocsView: React.FC<DatabaseDocsViewProps> = ({ tableCounts }) => {
  const [activeTab, setActiveTab] = useState<'schema' | 'inspector' | 'queries' | 'normalization' | 'viva'>('schema');

  // Live Table Inspector State
  const [selectedTable, setSelectedTable] = useState<string>('charging_stations');
  const [tableRecords, setTableRecords] = useState<Record<string, unknown>[]>([]);
  const [inspectorLoading, setInspectorLoading] = useState<boolean>(false);
  const [inspectorError, setInspectorError] = useState<string | null>(null);
  const [inspectorSearch, setInspectorSearch] = useState<string>('');

  const tables: TableStat[] = [
    {
      name: 'customers',
      count: tableCounts['customers'] || 0,
      description: 'Stores customer demographics and contact credentials.',
      pk: 'id (UUID)',
      fks: [],
    },
    {
      name: 'vehicles',
      count: tableCounts['vehicles'] || 0,
      description: 'Registered electric vehicles linked to customer profiles (1:N).',
      pk: 'id (UUID)',
      fks: ['customer_id -> customers(id) [CASCADE]'],
    },
    {
      name: 'charging_stations',
      count: tableCounts['charging_stations'] || 0,
      description: 'Physical station hubs, total and live available slots, and power specs.',
      pk: 'id (UUID)',
      fks: [],
    },
    {
      name: 'charging_slots',
      count: tableCounts['charging_slots'] || 0,
      description: 'Individual charging connectors/bays per station with status (1:N).',
      pk: 'id (UUID)',
      fks: ['station_id -> charging_stations(id) [CASCADE]'],
    },
    {
      name: 'bookings',
      count: tableCounts['bookings'] || 0,
      description: 'Slot reservations referencing customer, vehicle, station, and bay.',
      pk: 'id (UUID)',
      fks: [
        'customer_id -> customers(id) [RESTRICT]',
        'vehicle_id -> vehicles(id) [RESTRICT]',
        'station_id -> charging_stations(id) [RESTRICT]',
        'slot_id -> charging_slots(id) [SET NULL]',
      ],
    },
    {
      name: 'charging_sessions',
      count: tableCounts['charging_sessions'] || 0,
      description: 'Active/completed charging duration and kWh energy consumed.',
      pk: 'id (UUID)',
      fks: ['booking_id -> bookings(id) [RESTRICT]'],
    },
    {
      name: 'payments',
      count: tableCounts['payments'] || 0,
      description: 'Financial ledger records linked to completed sessions.',
      pk: 'id (UUID)',
      fks: ['session_id -> charging_sessions(id) [RESTRICT]'],
    },
    {
      name: 'maintenance',
      count: tableCounts['maintenance'] || 0,
      description: 'Scheduled station hardware maintenance windows and outages.',
      pk: 'id (UUID)',
      fks: ['station_id -> charging_stations(id) [CASCADE]'],
    },
    {
      name: 'reviews',
      count: tableCounts['reviews'] || 0,
      description: 'Driver rating (1-5) and feedback linked to customer and station.',
      pk: 'id (UUID)',
      fks: [
        'customer_id -> customers(id) [CASCADE]',
        'station_id -> charging_stations(id) [CASCADE]',
      ],
    },
    {
      name: 'admin_users',
      count: tableCounts['admin_users'] || 0,
      description: 'Authorized administrator accounts linked to Supabase auth.users(id) for RLS governance.',
      pk: 'id (UUID)',
      fks: ['user_id -> auth.users(id) [CASCADE]'],
    },
  ];

  const loadInspectorRecords = useCallback(async (tableName: string) => {
    setInspectorLoading(true);
    setInspectorError(null);
    const res = await fetchTableRecords(tableName, 50);
    setInspectorLoading(false);
    if (res.error) {
      setInspectorError(res.error);
      setTableRecords([]);
    } else {
      setTableRecords(res.data || []);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'inspector') {
      void loadInspectorRecords(selectedTable);
    }
  }, [activeTab, selectedTable, loadInspectorRecords]);

  const sampleQueries = [
    {
      title: '1. Multi-Table JOIN (4 Entities: Bookings + Customers + Vehicles + Stations)',
      description: 'Retrieves complete booking details combining 4 normalized relational tables via foreign keys.',
      sql: `SELECT 
  b.id AS booking_id,
  c.name AS customer_name,
  c.phone AS customer_phone,
  v.vehicle_model,
  v.vehicle_number,
  s.name AS station_name,
  s.location AS station_location,
  b.booking_date,
  b.start_time,
  b.status,
  b.amount
FROM bookings b
JOIN customers c ON b.customer_id = c.id
JOIN vehicles v ON b.vehicle_id = v.id
JOIN charging_stations s ON b.station_id = s.id
ORDER BY b.booking_date DESC;`,
    },
    {
      title: '2. Aggregation with GROUP BY & SUM (Revenue per Charging Station)',
      description: 'Calculates realized revenue and transaction count per charging station.',
      sql: `SELECT 
  cs.name AS station_name,
  COUNT(p.id) AS settled_transactions,
  SUM(p.amount) AS total_revenue_inr,
  AVG(p.amount) AS avg_ticket_size
FROM payments p
JOIN charging_sessions sess ON p.session_id = sess.id
JOIN bookings b ON sess.booking_id = b.id
JOIN charging_stations cs ON b.station_id = cs.id
WHERE p.payment_status = 'paid'
GROUP BY cs.name
ORDER BY total_revenue_inr DESC;`,
    },
    {
      title: '3. Aggregate Query with HAVING Filter (High Utilization Stations)',
      description: 'Demonstrates SQL HAVING clause to filter aggregate booking demand.',
      sql: `SELECT 
  s.name AS station_name,
  s.power_output,
  COUNT(b.id) AS total_bookings
FROM charging_stations s
LEFT JOIN bookings b ON s.id = b.station_id
GROUP BY s.id, s.name, s.power_output
HAVING COUNT(b.id) >= 1
ORDER BY total_bookings DESC;`,
    },
    {
      title: '4. Relational Integrity Constraint: Prevent Invalid Insertion',
      description: 'PostgreSQL CHECK constraint ensures battery_capacity and amounts cannot be negative.',
      sql: `-- CHECK (battery_capacity > 0)
INSERT INTO vehicles (customer_id, vehicle_number, vehicle_model, battery_capacity)
VALUES ('10000000-0000-0000-0000-000000000001', 'MH 14 EV 0001', 'Tata Tiago EV', 24.00);

-- CHECK (amount >= 0)
-- Attempting to insert a negative amount will throw a CHECK constraint violation in PostgreSQL!`,
    },
  ];

  // Filter inspector records based on search input
  const filteredInspectorRecords = tableRecords.filter((row) => {
    if (!inspectorSearch.trim()) return true;
    const q = inspectorSearch.toLowerCase().trim();
    return Object.values(row).some((val) =>
      val !== null && val !== undefined && String(val).toLowerCase().includes(q)
    );
  });

  const recordKeys = tableRecords.length > 0 ? Object.keys(tableRecords[0]) : [];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="page-view-header">
        <div>
          <span className="header-kicker">Relational Architecture</span>
          <h2>Database Management & Schema Explorer</h2>
          <p>PostgreSQL Catalog, Entity Relationships, Constraints & Multi-Table Queries.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <span
            style={{
              padding: '4px 10px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--accent-subtle)',
              border: '1px solid var(--accent-border)',
              color: 'var(--accent-primary)',
              fontSize: '11px',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Database size={13} /> PostgreSQL 15.x
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="filter-bar">
        <button
          className={`filter-chip ${activeTab === 'schema' ? 'active' : ''}`}
          onClick={() => setActiveTab('schema')}
        >
          <Table size={12} style={{ display: 'inline', marginRight: '5px' }} />
          Relational Schema (9 Tables)
        </button>
        <button
          className={`filter-chip ${activeTab === 'inspector' ? 'active' : ''}`}
          onClick={() => setActiveTab('inspector')}
        >
          <Eye size={12} style={{ display: 'inline', marginRight: '5px' }} />
          Live Table Inspector
        </button>
        <button
          className={`filter-chip ${activeTab === 'queries' ? 'active' : ''}`}
          onClick={() => setActiveTab('queries')}
        >
          <Code size={12} style={{ display: 'inline', marginRight: '5px' }} />
          SQL Queries & Joins
        </button>
        <button
          className={`filter-chip ${activeTab === 'normalization' ? 'active' : ''}`}
          onClick={() => setActiveTab('normalization')}
        >
          <Layers size={12} style={{ display: 'inline', marginRight: '5px' }} />
          Normalization (1NF - 3NF)
        </button>
        <button
          className={`filter-chip ${activeTab === 'viva' ? 'active' : ''}`}
          onClick={() => setActiveTab('viva')}
        >
          <HelpCircle size={12} style={{ display: 'inline', marginRight: '5px' }} />
          Technical Architecture Q&A
        </button>
      </div>

      {/* TAB 1: RELATIONAL SCHEMA */}
      {activeTab === 'schema' && (
        <div className="space-y-6">
          {/* ER Diagram Representation */}
          <div className="panel">
            <div className="panel-heading">
              <div>
                <span className="panel-kicker">Relational Architecture</span>
                <h3>Entity-Relationship (ER) Flow</h3>
              </div>
            </div>
            <pre
              style={{
                background: 'var(--bg-surface-sunken)',
                padding: '14px 16px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                fontSize: '11px',
                color: 'var(--text-secondary)',
                overflowX: 'auto',
                lineHeight: '1.6',
              }}
            >
{`[customers] (1) ───< (N) [vehicles]
    │                        │
    │                        │
    └───< [bookings] >───────┘
              │  │
    ┌─────────┘  └────────┐
    ▼                     ▼
[charging_stations] (1)──< (N) [charging_slots]
    │                             │
    ├───< (N) [maintenance]       │
    │                             │
    ├───< (N) [reviews]           │
    │                             │
    ▼                             │
[charging_sessions] <─────────────┘
    │
    ▼
[payments]`}
            </pre>
          </div>

          {/* Tables Directory */}
          <div className="panel">
            <div className="panel-heading">
              <div>
                <span className="panel-kicker">PostgreSQL Catalog</span>
                <h3>Tables, Primary Keys & Foreign Keys</h3>
              </div>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Table Name</th>
                    <th>Row Count (Live)</th>
                    <th>Primary Key</th>
                    <th>Foreign Keys & Delete Rules</th>
                    <th>Entity Purpose</th>
                  </tr>
                </thead>
                <tbody>
                  {tables.map((t) => (
                    <tr key={t.name}>
                      <td>
                        <strong style={{ color: 'var(--accent-primary)', fontFamily: 'monospace' }}>
                          {t.name}
                        </strong>
                      </td>
                      <td>
                        <span
                          style={{
                            padding: '2px 7px',
                            borderRadius: 'var(--radius-sm)',
                            background: 'var(--bg-surface-raised)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-primary)',
                            fontWeight: 500,
                            fontSize: '11px',
                          }}
                        >
                          {t.count} rows
                        </span>
                      </td>
                      <td>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
                          <Key size={11} style={{ color: 'var(--status-warning)' }} />
                          <code>{t.pk}</code>
                        </span>
                      </td>
                      <td>
                        {t.fks.length === 0 ? (
                          <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>None (Parent Entity)</span>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            {t.fks.map((fk, idx) => (
                              <span key={idx} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
                                <Link size={10} style={{ color: 'var(--status-info)' }} />
                                <code>{fk}</code>
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {t.description}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: LIVE TABLE INSPECTOR */}
      {activeTab === 'inspector' && (
        <div className="panel">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">Live PostgreSQL Data</span>
              <h3>Database Records Inspector</h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <select
                className="form-select"
                style={{ width: 'auto', padding: '5px 10px', fontSize: '12px' }}
                value={selectedTable}
                onChange={(e) => {
                  setSelectedTable(e.target.value);
                  setInspectorSearch('');
                }}
              >
                {tables.map((t) => (
                  <option key={t.name} value={t.name}>
                    {t.name} ({t.count} records)
                  </option>
                ))}
              </select>

              <button
                className="icon-button"
                style={{ width: '30px', height: '30px' }}
                onClick={() => loadInspectorRecords(selectedTable)}
                disabled={inspectorLoading}
                title="Refresh table records"
              >
                <RefreshCw size={13} className={inspectorLoading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* Subheader with search and count */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              marginBottom: '14px',
              paddingBottom: '10px',
              borderBottom: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                Target: <code style={{ color: 'var(--accent-primary)' }}>public.{selectedTable}</code>
                <CopyButton text={selectedTable} title="Copy table name" size={10} />
              </span>
              <span
                style={{
                  fontSize: '11px',
                  padding: '2px 6px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-surface-raised)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-muted)',
                }}
              >
                {filteredInspectorRecords.length} record(s) loaded
              </span>
            </div>

            <div className="search-box" style={{ width: '220px' }}>
              <Search size={13} />
              <input
                type="text"
                placeholder="Filter table rows..."
                value={inspectorSearch}
                onChange={(e) => setInspectorSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Inspector Content */}
          {inspectorLoading ? (
            <div style={{ padding: '8px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
                <div className="pulse-dot warning" />
                <span>Querying live PostgreSQL catalog for <code>public.{selectedTable}</code>...</span>
              </div>
              <SkeletonTable rows={5} columns={6} />
            </div>
          ) : inspectorError ? (
            <div className="form-error" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={15} />
              <span>{inspectorError}</span>
            </div>
          ) : filteredInspectorRecords.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--text-muted)' }}>
              {inspectorSearch
                ? `No rows match filter "${inspectorSearch}".`
                : `No records found in table ${selectedTable}.`}
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {recordKeys.map((key) => (
                      <th key={key}>{key}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredInspectorRecords.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {recordKeys.map((key) => {
                        const val = row[key];
                        let rendered: React.ReactNode;

                        if (val === null || val === undefined) {
                          rendered = <span style={{ color: 'var(--text-muted)' }}>—</span>;
                        } else if (typeof val === 'boolean') {
                          rendered = (
                            <span
                              style={{
                                color: val ? 'var(--status-online)' : 'var(--status-danger)',
                                fontWeight: 500,
                              }}
                            >
                              {String(val)}
                            </span>
                          );
                        } else if (typeof val === 'object') {
                          rendered = <code>{JSON.stringify(val)}</code>;
                        } else if (
                          typeof val === 'string' &&
                          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)
                        ) {
                          // Truncate UUIDs for clean table layout
                          rendered = (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <code
                                title={val}
                                style={{
                                  fontSize: '11px',
                                  color: 'var(--text-muted)',
                                  background: 'var(--bg-surface-sunken)',
                                  padding: '1px 4px',
                                  borderRadius: '3px',
                                }}
                              >
                                {val.slice(0, 8)}...
                              </code>
                              <CopyButton text={val} title="Copy full UUID" size={10} />
                            </div>
                          );
                        } else {
                          rendered = String(val);
                        }

                        return (
                          <td key={key} style={{ fontSize: '12px' }}>
                            {rendered}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: WORKING ADM SQL QUERIES */}
      {activeTab === 'queries' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {sampleQueries.map((q, idx) => (
            <div key={idx} className="panel" style={{ margin: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div>
                  <h4 style={{ fontSize: '14px', color: 'var(--text-primary)', margin: '0 0 3px' }}>
                    {q.title}
                  </h4>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                    {q.description}
                  </p>
                </div>
                <CopyButton
                  text={q.sql}
                  label="Copy SQL"
                  size={12}
                  className="secondary-button"
                  title="Copy SQL query to clipboard"
                />
              </div>

              <pre
                style={{
                  background: 'var(--bg-surface-sunken)',
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                  lineHeight: '1.5',
                  overflowX: 'auto',
                }}
              >
                <code>{q.sql}</code>
              </pre>
            </div>
          ))}
        </div>
      )}

      {/* TAB 4: NORMALIZATION EXPLANATION */}
      {activeTab === 'normalization' && (
        <div className="panel space-y-4">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">Database Theory</span>
              <h3>Database Normalization Analysis (1NF to 3NF)</h3>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ padding: '12px 14px', background: 'var(--bg-surface-sunken)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <strong style={{ color: 'var(--accent-primary)', fontSize: '13px', display: 'block', marginBottom: '3px' }}>
                First Normal Form (1NF)
              </strong>
              <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: 0, lineHeight: '1.5' }}>
                Every table in this schema has a designated Primary Key (UUID), each column holds atomic values (no multivalued attributes or repeating groups), and each record is uniquely identifiable.
              </p>
            </div>

            <div style={{ padding: '12px 14px', background: 'var(--bg-surface-sunken)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <strong style={{ color: 'var(--accent-primary)', fontSize: '13px', display: 'block', marginBottom: '3px' }}>
                Second Normal Form (2NF)
              </strong>
              <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: 0, lineHeight: '1.5' }}>
                Satisfies 1NF and contains no partial functional dependencies. All non-key attributes depend entirely on the primary key. Charging slots belong to stations, vehicles belong to customers, and payments belong to charging sessions.
              </p>
            </div>

            <div style={{ padding: '12px 14px', background: 'var(--bg-surface-sunken)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <strong style={{ color: 'var(--accent-primary)', fontSize: '13px', display: 'block', marginBottom: '3px' }}>
                Third Normal Form (3NF) & Intentional Historical Snapshots
              </strong>
              <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: 0, lineHeight: '1.5' }}>
                Eliminates transitive dependencies (X -&gt; Y and Y -&gt; Z). In the <code>bookings</code> table, snapshot fields (customer_name, vehicle, station_name) preserve the exact invoice record as it existed at reservation time, preventing historical records from altering if a station or vehicle is subsequently renamed.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: TECHNICAL ARCHITECTURE Q&A */}
      {activeTab === 'viva' && (
        <div className="panel space-y-4">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">Technical Q&A</span>
              <h3>Core Database Architecture & Technical Reference</h3>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ padding: '12px 14px', background: 'var(--bg-surface-sunken)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <strong style={{ color: 'var(--text-primary)', fontSize: '13px', display: 'block', marginBottom: '3px' }}>
                Q1: What is the difference between ON DELETE CASCADE and ON DELETE RESTRICT in this system?
              </strong>
              <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: 0, lineHeight: '1.5' }}>
                <code>ON DELETE CASCADE</code> is used on <code>charging_slots</code> and <code>maintenance</code> so that deleting a station automatically deletes its child slots and logs. In contrast, <code>bookings</code> uses <code>ON DELETE RESTRICT</code> on <code>station_id</code> to protect transactional audit history: PostgreSQL prevents an operator from deleting a station if existing bookings reference it.
              </p>
            </div>

            <div style={{ padding: '12px 14px', background: 'var(--bg-surface-sunken)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <strong style={{ color: 'var(--text-primary)', fontSize: '13px', display: 'block', marginBottom: '3px' }}>
                Q2: How does Row Level Security (RLS) work in PostgreSQL / Supabase?
              </strong>
              <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: 0, lineHeight: '1.5' }}>
                RLS operates at the database kernel level to evaluate security policies for each row during SELECT, INSERT, UPDATE, and DELETE operations. In our platform, granular policies protect and control operational multi-device access without compromising relational integrity.
              </p>
            </div>

            <div style={{ padding: '12px 14px', background: 'var(--bg-surface-sunken)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <strong style={{ color: 'var(--text-primary)', fontSize: '13px', display: 'block', marginBottom: '3px' }}>
                Q3: Why are B-Tree indexes used on foreign key columns?
              </strong>
              <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: 0, lineHeight: '1.5' }}>
                Foreign keys are frequently evaluated during multi-table JOINs (e.g., joining bookings with customers and stations). Without indexes, PostgreSQL would perform full table sequential scans (O(N)). B-Tree indexes provide O(log N) lookup time for foreign key checks and WHERE filters.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
