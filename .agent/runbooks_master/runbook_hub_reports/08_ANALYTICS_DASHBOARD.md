# Runbook 08 — Hub Reports: Analytics Dashboard

**Series:** Hub Daily Shift Reports · Phase 8 of 8  
**Board Key:** `hub_reports`  
**Vertical:** Data Manager  
**Author:** PowerProject Runbook System  
**Date:** 2026-07-30  

---

## Objective

Implement `AnalyticsDashboard.jsx` — the **analytics view** for Hub Daily Shift Reports. This component provides an overview of verified report data through summary stat cards, a multi-line time-series chart (charging sessions per hub over time), and a grouped bar chart (parked vehicles per hub, day vs. night). All charts use **Recharts** and pull from **verified data only** via `hubReportService.getAnalyticsData()`.

This is a read-only, data-visualization view accessible to all roles that have access to the `hub_reports` board.

---

## Prerequisites

| # | Requirement | Source |
|---|-------------|--------|
| 1 | Runbooks 01–07 completed | `01_DATABASE_SCHEMA.md` – `07_VERIFICATION_FORM.md` |
| 2 | `hubReportService.getAnalyticsData({ startDate, endDate, hubIds })` returns the analytics payload shape defined in §7 | `03_SERVICE_LAYER.md` |
| 3 | `recharts` installed in the project (see §3 below) | `package.json` |
| 4 | CSS variables `--brand-green`, `--status-neutral`, `--status-success`, `--status-warning`, `--status-danger`, `--radius-squircle` defined | Design system |
| 5 | `HubReports.css` shared tokens file created | `05_COMPLIANCE_TRACKER.md` |

---

## Files Affected

| Action | File Path |
|--------|-----------|
| **CREATE** | `src/verticals/DataManager/components/HubReports/AnalyticsDashboard.jsx` |
| **CREATE** | `src/verticals/DataManager/components/HubReports/AnalyticsDashboard.css` |
| **MODIFY** | `package.json` (add `recharts` dependency) |
| **IMPORT FROM** | `src/services/hubReportService.js` |
| **IMPORT FROM** | `./HubReports.css` |

---

## Step 1 — Install Recharts

Run this command from the project root:

```bash
npm install recharts
```

Verify installation:

```bash
npm list recharts
```

Expected output: `recharts@2.x.x` (version 2.x is required — do NOT use v1.x).

> **Note:** Recharts 2.x is a peer-dep of React 18. It ships with TypeScript types built-in.

---

## UI Specification

```
┌───────────────────────────────────────────────────────────────────┐
│  Analytics                                                        │
│  Filters: [Date Range: Last 7 days ▼] [Hubs: All ▼] [Shift: All]│
│                                                                   │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐             │
│  │ Total Sess.  │ │ Total Parked │ │ Reports Filed│             │
│  │   1,247      │ │     389      │ │   12/14      │             │
│  └──────────────┘ └──────────────┘ └──────────────┘             │
│                                                                   │
│  Charging Sessions Over Time (Line Chart)                        │
│  [recharts LineChart — Date on X, Sessions count on Y]           │
│  Lines: one per hub (colored), legend below                      │
│                                                                   │
│  Parked Vehicles — Hub Comparison (Bar Chart)                    │
│  [recharts BarChart — Hub on X, Parked count on Y]               │
│  Grouped bars: Day vs Night                                      │
└───────────────────────────────────────────────────────────────────┘
```

### Filter Controls

| Control | Type | Options |
|---------|------|---------|
| Date Range | `<select>` | Last 7 days, Last 14 days, Last 30 days, Last 90 days |
| Hubs | `<select multiple>` or checkbox dropdown | All (default), individual hub names |
| Shift | `<select>` | All, Day, Night |

### Summary Stat Cards

| Card | Metric | Source Field |
|------|--------|-------------|
| Total Sessions | Sum of `verified_sessions_3w + verified_sessions_4w` across all filtered reports | `analytics.totalSessions` |
| Total Parked | Sum of `verified_parked_3w + verified_parked_4w` | `analytics.totalParked` |
| Reports Filed | `verifiedCount / totalExpected` for the period | `analytics.verifiedCount` / `analytics.expectedCount` |

### Chart Specifications

#### Chart 1: Charging Sessions Over Time (Line Chart)

| Property | Value |
|----------|-------|
| Component | `<LineChart>` with `<ResponsiveContainer>` |
| X-axis | Date (`report_date`) — formatted as `DD MMM` |
| Y-axis | Total session count per day |
| Lines | One `<Line>` per hub — colored by hub index |
| Tooltip | Show hub name + sessions on hover |
| Legend | Below chart |
| Colors | Cycle through: `var(--brand-green)`, `var(--status-neutral)`, hub palette (see §6) |

#### Chart 2: Parked Vehicles — Hub Comparison (Bar Chart)

| Property | Value |
|----------|-------|
| Component | `<BarChart>` with `<ResponsiveContainer>` |
| X-axis | Hub name |
| Y-axis | Average or total parked count |
| Bars | Two grouped bars per hub: Day shift (filled) and Night shift (striped/lighter) |
| Colors | Day: `var(--brand-green)`, Night: `var(--status-neutral)` |
| Tooltip | Show shift + parked count |
| Legend | Below chart |

---

## Step 2 — Create `AnalyticsDashboard.css`

```css
/* src/verticals/DataManager/components/HubReports/AnalyticsDashboard.css */
/* ─────────────────────────────────────────────────────────────────
   AnalyticsDashboard — Charts and stat cards view
   ───────────────────────────────────────────────────────────────── */

/* ── Page Header ────────────────────────────────────────────────── */
.analytics__page-header {
  padding: var(--space-4, 1rem) var(--space-5, 1.25rem);
  border-bottom: 1px solid var(--border-subtle);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4, 1rem);
  flex-wrap: wrap;
}

.analytics__title {
  font-size: var(--text-xl, 1.25rem);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

/* ── Filter bar ─────────────────────────────────────────────────── */
.analytics__filter-bar {
  display: flex;
  align-items: center;
  gap: var(--space-3, 0.75rem);
  flex-wrap: wrap;
}

.analytics__filter-select {
  padding: var(--space-1, 0.25rem) var(--space-3, 0.75rem);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background-color: var(--surface-raised);
  color: var(--text-primary);
  font-size: var(--text-sm, 0.875rem);
  cursor: pointer;
  transition: border-color 0.15s ease;
  min-width: 140px;
}

.analytics__filter-select:focus {
  outline: none;
  border-color: var(--brand-green);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand-green) 18%, transparent);
}

.analytics__filter-label {
  font-size: var(--text-xs, 0.75rem);
  color: var(--text-secondary);
  font-weight: 500;
}

/* ── Content area ───────────────────────────────────────────────── */
.analytics__content {
  display: flex;
  flex-direction: column;
  gap: var(--space-5, 1.25rem);
  padding: var(--space-5, 1.25rem);
}

/* ── Summary stat cards row ─────────────────────────────────────── */
.analytics__stat-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-4, 1rem);
}

.analytics__stat-card {
  background-color: var(--surface-raised);
  border-radius: var(--radius-squircle);
  border: 1px solid var(--border-subtle);
  padding: var(--space-4, 1rem) var(--space-5, 1.25rem);
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 0.5rem);
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}

.analytics__stat-card:hover {
  box-shadow: 0 4px 16px color-mix(in srgb, var(--brand-green) 12%, transparent);
  transform: translateY(-1px);
}

.analytics__stat-card-label {
  font-size: var(--text-xs, 0.75rem);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--text-secondary);
}

.analytics__stat-card-value {
  font-size: var(--text-3xl, 1.875rem);
  font-weight: 700;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.analytics__stat-card-value--green {
  color: var(--brand-green);
}

.analytics__stat-card-sub {
  font-size: var(--text-xs, 0.75rem);
  color: var(--text-tertiary);
}

/* ── Chart panels ───────────────────────────────────────────────── */
.analytics__chart-panel {
  background-color: var(--surface-raised);
  border-radius: var(--radius-squircle);
  border: 1px solid var(--border-subtle);
  padding: var(--space-5, 1.25rem);
  display: flex;
  flex-direction: column;
  gap: var(--space-4, 1rem);
}

.analytics__chart-title {
  font-size: var(--text-base, 1rem);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.analytics__chart-container {
  width: 100%;
  min-height: 280px;
}

/* Recharts tooltip override — use CSS variables */
.analytics-custom-tooltip {
  background-color: var(--surface-overlay);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: var(--space-3, 0.75rem);
  font-size: var(--text-xs, 0.75rem);
  color: var(--text-primary);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.analytics-custom-tooltip__label {
  font-weight: 600;
  margin-bottom: var(--space-1, 0.25rem);
  color: var(--text-secondary);
}

.analytics-custom-tooltip__row {
  display: flex;
  align-items: center;
  gap: var(--space-2, 0.5rem);
}

.analytics-custom-tooltip__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* ── Loading skeleton for charts ────────────────────────────────── */
.analytics__chart-skeleton {
  height: 280px;
  border-radius: var(--radius-md);
  background: linear-gradient(
    90deg,
    var(--surface-subtle) 25%,
    var(--surface-hover) 50%,
    var(--surface-subtle) 75%
  );
  background-size: 200% 100%;
  animation: analytics-shimmer 1.4s infinite;
}

@keyframes analytics-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* ── Empty state ────────────────────────────────────────────────── */
.analytics__empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 240px;
  gap: var(--space-3, 0.75rem);
  color: var(--text-tertiary);
}

.analytics__empty-state-icon {
  font-size: 2.5rem;
  opacity: 0.35;
}

.analytics__empty-state-text {
  font-size: var(--text-sm, 0.875rem);
  color: var(--text-secondary);
  text-align: center;
  max-width: 280px;
}

/* ── Error state ────────────────────────────────────────────────── */
.analytics__error {
  padding: var(--space-3, 0.75rem) var(--space-4, 1rem);
  background-color: color-mix(in srgb, var(--status-danger) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--status-danger) 25%, transparent);
  border-radius: var(--radius-md);
  color: var(--status-danger);
  font-size: var(--text-sm, 0.875rem);
}
```

---

## Step 3 — Create `AnalyticsDashboard.jsx`

```jsx
// src/verticals/DataManager/components/HubReports/AnalyticsDashboard.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import hubReportService from '../../../../services/hubReportService';
import './AnalyticsDashboard.css';
import './HubReports.css';

// ─── Constants ────────────────────────────────────────────────────────────────

const DATE_RANGE_OPTIONS = [
  { label: 'Last 7 days',  value: 7  },
  { label: 'Last 14 days', value: 14 },
  { label: 'Last 30 days', value: 30 },
  { label: 'Last 90 days', value: 90 },
];

const SHIFT_OPTIONS = [
  { label: 'All Shifts', value: 'all'   },
  { label: 'Day',        value: 'Day'   },
  { label: 'Night',      value: 'Night' },
];

/**
 * Hub line colors — CSS custom properties are not directly usable inside
 * recharts `stroke` prop (SVG attribute). We define a palette of named
 * CSS variable fallback strings that match the design system tokens.
 *
 * NOTE: If the design system ever exposes a JS token export, replace this
 * array with that source of truth.
 */
const HUB_LINE_COLORS = [
  'var(--brand-green)',
  'var(--status-neutral)',
  'var(--status-warning)',
  'var(--status-success)',
  'var(--chart-color-4, #8884d8)',
  'var(--chart-color-5, #82ca9d)',
  'var(--chart-color-6, #ffc658)',
  'var(--chart-color-7, #ff7f7f)',
];

// ─── Helper: compute date range ────────────────────────────────────────────────

function getDateRange(days) {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate:   end.toISOString().slice(0, 10),
  };
}

// ─── Helper: format number with comma separator ───────────────────────────────

function formatNumber(n) {
  if (n === null || n === undefined) return '—';
  return n.toLocaleString('en-IN');
}

// ─── Helper: format date label for X-axis ─────────────────────────────────────

function formatDateTick(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

// ─── Sub-component: StatCard ──────────────────────────────────────────────────

function StatCard({ label, value, sub, valueClass }) {
  return (
    <div className="analytics__stat-card">
      <span className="analytics__stat-card-label">{label}</span>
      <span className={`analytics__stat-card-value${valueClass ? ` ${valueClass}` : ''}`}>
        {value}
      </span>
      {sub && <span className="analytics__stat-card-sub">{sub}</span>}
    </div>
  );
}

// ─── Sub-component: CustomTooltip (shared) ────────────────────────────────────

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="analytics-custom-tooltip">
      <div className="analytics-custom-tooltip__label">{formatDateTick(label) || label}</div>
      {payload.map((entry, i) => (
        <div key={i} className="analytics-custom-tooltip__row">
          <span className="analytics-custom-tooltip__dot" style={{ background: entry.color }} />
          <span>{entry.name}: <strong>{formatNumber(entry.value)}</strong></span>
        </div>
      ))}
    </div>
  );
}

// ─── Sub-component: ChartSkeleton ─────────────────────────────────────────────

function ChartSkeleton() {
  return <div className="analytics__chart-skeleton" aria-hidden="true" />;
}

// ─── Sub-component: EmptyState ────────────────────────────────────────────────

function EmptyChartState() {
  return (
    <div className="analytics__empty-state">
      <span className="analytics__empty-state-icon">📊</span>
      <span className="analytics__empty-state-text">
        No verified data for the selected filters.
      </span>
    </div>
  );
}

// ─── Sub-component: SessionsLineChart ────────────────────────────────────────

/**
 * Renders a multi-line chart of charging sessions per hub over time.
 *
 * @param {Array} data     - Array of { date, [hubName]: sessionCount, ... }
 * @param {Array} hubs     - Array of hub name strings (defines which lines to draw)
 */
function SessionsLineChart({ data, hubs }) {
  if (!data?.length || !hubs?.length) return <EmptyChartState />;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
        <XAxis
          dataKey="date"
          tickFormatter={formatDateTick}
          tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
          axisLine={{ stroke: 'var(--border-subtle)' }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={40}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: '12px', color: 'var(--text-secondary)' }}
          iconType="circle"
          iconSize={8}
        />
        {hubs.map((hubName, idx) => (
          <Line
            key={hubName}
            type="monotone"
            dataKey={hubName}
            stroke={HUB_LINE_COLORS[idx % HUB_LINE_COLORS.length]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

// ─── Sub-component: ParkedBarChart ────────────────────────────────────────────

/**
 * Renders a grouped bar chart comparing parked vehicles per hub (Day vs Night).
 *
 * @param {Array} data  - Array of { hub: string, Day: number, Night: number }
 */
function ParkedBarChart({ data }) {
  if (!data?.length) return <EmptyChartState />;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
        <XAxis
          dataKey="hub"
          tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
          axisLine={{ stroke: 'var(--border-subtle)' }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={40}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: '12px', color: 'var(--text-secondary)' }}
          iconType="square"
          iconSize={10}
        />
        <Bar dataKey="Day"   name="Day Shift"   fill="var(--brand-green)"     radius={[3, 3, 0, 0]} />
        <Bar dataKey="Night" name="Night Shift" fill="var(--status-neutral)"  radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

/**
 * AnalyticsDashboard
 *
 * Read-only analytics view for Hub Daily Shift Reports.
 * Displays summary stat cards, a sessions time-series line chart,
 * and a parked-vehicles hub-comparison bar chart.
 * Only uses VERIFIED report data.
 *
 * @param {object} permissions  - { canSubmitHubReports, canVerifyHubReports }
 */
const AnalyticsDashboard = ({ permissions }) => {
  // ── Filter state ─────────────────────────────────────────────
  const [rangeDays, setRangeDays] = useState(7);
  const [selectedShift, setSelectedShift] = useState('all');
  const [availableHubs, setAvailableHubs] = useState([]);
  const [selectedHubId, setSelectedHubId] = useState('all');

  // ── Data state ───────────────────────────────────────────────
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ── Derived date range ───────────────────────────────────────
  const { startDate, endDate } = useMemo(() => getDateRange(rangeDays), [rangeDays]);

  // ── Fetch analytics data ─────────────────────────────────────
  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const hubIds = selectedHubId === 'all' ? null : [selectedHubId];
      const data = await hubReportService.getAnalyticsData({
        startDate,
        endDate,
        hubIds,
        shift: selectedShift === 'all' ? null : selectedShift,
      });
      setAnalytics(data);
      // Populate hub filter dropdown from returned data
      if (data?.hubNames?.length && availableHubs.length === 0) {
        setAvailableHubs(data.hubNames);
      }
    } catch (err) {
      console.error('[AnalyticsDashboard] fetchAnalytics error:', err);
      setError('Failed to load analytics data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, selectedHubId, selectedShift, availableHubs.length]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // ── Derived summary stats ────────────────────────────────────
  const totalSessions  = analytics?.totalSessions  ?? 0;
  const totalParked    = analytics?.totalParked    ?? 0;
  const verifiedCount  = analytics?.verifiedCount  ?? 0;
  const expectedCount  = analytics?.expectedCount  ?? 0;

  // ── Recharts data shapes ─────────────────────────────────────
  const lineChartData = analytics?.sessionsByDate  ?? [];
  const lineChartHubs = analytics?.hubNames        ?? [];
  const barChartData  = analytics?.parkedByHub     ?? [];

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="hub-reports-board">
      <div className="hub-reports-card">

        {/* ── Page Header + Filters ────────────────────────── */}
        <div className="analytics__page-header">
          <h1 className="analytics__title">Analytics</h1>
          <div className="analytics__filter-bar">
            {/* Date range */}
            <select
              className="analytics__filter-select"
              value={rangeDays}
              onChange={e => setRangeDays(Number(e.target.value))}
              aria-label="Date range filter"
            >
              {DATE_RANGE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            {/* Hub filter */}
            <select
              className="analytics__filter-select"
              value={selectedHubId}
              onChange={e => setSelectedHubId(e.target.value)}
              aria-label="Hub filter"
            >
              <option value="all">All Hubs</option>
              {availableHubs.map(hub => (
                <option key={hub.id} value={hub.id}>{hub.name}</option>
              ))}
            </select>

            {/* Shift filter */}
            <select
              className="analytics__filter-select"
              value={selectedShift}
              onChange={e => setSelectedShift(e.target.value)}
              aria-label="Shift filter"
            >
              {SHIFT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Content ─────────────────────────────────────── */}
        <div className="analytics__content">

          {/* Error state */}
          {error && (
            <div className="analytics__error" role="alert">{error}</div>
          )}

          {/* ── Summary stat cards ────────────────────────── */}
          <div className="analytics__stat-cards">
            <StatCard
              label="Total Sessions"
              value={loading ? '…' : formatNumber(totalSessions)}
              sub="3W + 4W, verified only"
              valueClass="analytics__stat-card-value--green"
            />
            <StatCard
              label="Total Parked"
              value={loading ? '…' : formatNumber(totalParked)}
              sub="3W + 4W, verified only"
            />
            <StatCard
              label="Reports Filed"
              value={loading ? '…' : `${verifiedCount}/${expectedCount}`}
              sub={`${rangeDays}-day period`}
            />
          </div>

          {/* ── Line chart: Sessions over time ────────────── */}
          <div className="analytics__chart-panel">
            <h2 className="analytics__chart-title">Charging Sessions Over Time</h2>
            <div className="analytics__chart-container">
              {loading ? (
                <ChartSkeleton />
              ) : (
                <SessionsLineChart data={lineChartData} hubs={lineChartHubs} />
              )}
            </div>
          </div>

          {/* ── Bar chart: Parked by hub ──────────────────── */}
          <div className="analytics__chart-panel">
            <h2 className="analytics__chart-title">Parked Vehicles — Hub Comparison</h2>
            <div className="analytics__chart-container">
              {loading ? (
                <ChartSkeleton />
              ) : (
                <ParkedBarChart data={barChartData} />
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
```

---

## Expected Service Response Shape

`hubReportService.getAnalyticsData({ startDate, endDate, hubIds, shift })` must return:

```js
{
  // Summary stats
  totalSessions: 1247,
  totalParked: 389,
  verifiedCount: 12,
  expectedCount: 14,

  // Hub list (for filter dropdown and line chart key mapping)
  hubNames: [
    { id: 'hub_ect',  name: 'ECT'  },
    { id: 'hub_kia',  name: 'KIA'  },
    // ...
  ],

  // Line chart data: one object per date, keys = hub names
  sessionsByDate: [
    { date: '2026-07-24', ECT: 42, KIA: 31, KB: 18, HOODI: 27 },
    { date: '2026-07-25', ECT: 38, KIA: 40, KB: 21, HOODI: 19 },
    // ...
  ],

  // Bar chart data: one object per hub with Day and Night totals
  parkedByHub: [
    { hub: 'ECT',   Day: 18, Night: 12 },
    { hub: 'KIA',   Day: 24, Night: 9  },
    { hub: 'KB',    Day: 7,  Night: 5  },
    { hub: 'HOODI', Day: 11, Night: 6  },
    // ...
  ],
}
```

> **Critical:** The service must filter to `status = 'Verified'` records only. Drafts and missing reports must not appear in analytics output.

---

## Chart Color Usage

Recharts `stroke` / `fill` props accept CSS `var()` references in modern browsers. This allows the chart lines and bars to respond to theme changes (light/dark mode) automatically:

| Purpose | CSS Variable |
|---------|-------------|
| First hub line / Day bars | `var(--brand-green)` |
| Second hub line / Night bars | `var(--status-neutral)` |
| Additional hub lines (3rd+) | `HUB_LINE_COLORS[2..7]` — see component constant |
| Chart gridlines | `var(--border-subtle)` |
| Axis tick text | `var(--text-secondary)` |
| Tooltip background | `var(--surface-overlay)` |

---

## Notes on Recharts + CSS Variables

Recharts renders SVG elements. SVG attribute values like `stroke` and `fill` can accept CSS `var()` references **only when the variables are defined on an ancestor DOM element** (which they are, as PowerProject defines tokens on `:root` or `body`). This works in all Chromium-based browsers and Firefox. Safari 15+ also supports this.

If a CI/CD visual regression tool reports incorrect colors, it is likely using an older headless browser. This is not a code bug.

---

## Validation Checklist

- [ ] **`npm install recharts` completed** — `node_modules/recharts` exists
- [ ] **Recharts imports correct** — `LineChart`, `Line`, `BarChart`, `Bar`, `XAxis`, `YAxis`, `CartesianGrid`, `Tooltip`, `Legend`, `ResponsiveContainer` all imported
- [ ] **Date range filter** — changing dropdown triggers data re-fetch with correct `startDate`/`endDate`
- [ ] **Hub filter** — selecting a specific hub filters both charts and stats
- [ ] **Shift filter** — selecting Day/Night passes `shift` parameter to service
- [ ] **Stat cards** — display `totalSessions`, `totalParked`, `verifiedCount/expectedCount`
- [ ] **Line chart** — renders one line per hub, X-axis shows dates, Y-axis shows sessions
- [ ] **Bar chart** — renders grouped Day/Night bars per hub
- [ ] **Loading skeletons** — shimmer shown while data fetches
- [ ] **Empty state** — `'No verified data for the selected filters.'` shown when `data` is empty
- [ ] **Error state** — error message shown if fetch fails, with `role="alert"`
- [ ] **Custom tooltip** — hover shows hub name and value with color dot
- [ ] **CSS variables used for colors** — no hardcoded hex colors anywhere
- [ ] **`var(--brand-green)`** used for Day bars and first hub line
- [ ] **`var(--status-neutral)`** used for Night bars and second hub line
- [ ] **Chart border-radius** — bars have `radius={[3, 3, 0, 0]}` for rounded tops
- [ ] **No inline styles** (the `style={{ background: entry.color }}` in CustomTooltip is recharts-idiomatic and acceptable — it reads from the `entry.color` value recharts supplies, which itself comes from our CSS variable string)
- [ ] **Component line count** — stays under 400 lines

---

## Next Step

→ **Series complete.** All 8 runbooks for Hub Daily Shift Reports are written.

**Final integration step:** Update `HubReportsBoard.jsx` to orchestrate all four views (ComplianceTracker, ReportEntryForm, VerificationForm, AnalyticsDashboard) with a view-state machine and pass the correct props to each child component. This is covered in the board orchestration pattern from **Runbook 04: `04_BOARD_REGISTRATION.md`**.

**Implementation order:**
1. `HubReports.css` (shared tokens — created in Runbook 05)
2. `ComplianceTracker.jsx` + `ComplianceTracker.css`
3. `ReportEntryForm.jsx` + `ReportEntryForm.css`
4. `VerificationForm.jsx` + `VerificationForm.css`
5. `AnalyticsDashboard.jsx` + `AnalyticsDashboard.css`
6. `HubReportsBoard.jsx` (orchestrator — wires all four views)
