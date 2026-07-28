# Digitize Daily Shift Reports (Plan)

This plan outlines the architecture to digitize daily shift vehicle reports for the **desktop version only**, housed within the **Data Manager** vertical. We will implement a CSV Import/Export flow to mimic current Excel behaviors, add distinct tracking for draft vs. verified numbers, and introduce daily compliance trackers, analytical graphs, and proper RBAC security.

## Goal Description

Currently, hub teams capture vehicle data in Excel and share it. We will transition this to a structured workflow within the desktop app:
1. **Draft Stage (CSV Import):** Hub teams select their Hub & Shift, download a CSV template, fill it out in Excel, and upload it to the app.
2. **Verification Stage:** The Data Team reviews these drafts and inputs the finalized numbers. The system explicitly separates "draft" values from "verified" values for auditing.
3. **Tracking & Analytics:** New daily trackers will ensure compliance, and a graph section will allow dynamic filtering of the data.
4. **Security & Routing:** The entire feature will be governed by the RBAC system and placed securely within the Data Manager vertical.

## Open Questions
1. **Pre-populating Verification:** When the data team goes to verify a draft, should the system automatically copy the `draft` numbers into the `verified` columns so they only have to edit the discrepancies, or should they start blank?
2. **Graphing Library:** Are you currently using a specific charting library in the app (like Recharts, Chart.js, or ApexCharts), or should we introduce one for the new graph section?

## Proposed Changes

### Database Schema (Supabase)

#### `supabase/migrations/[TIMESTAMP]_shift_reports.sql`
Create new tables with distinct draft vs. verified counts and proper RBAC (Row Level Security) policies.

- `hub_shift_reports`
  - `id` (uuid, primary key)
  - `hub_id` (uuid, references hubs)
  - `date` (date)
  - `shift` (text: 'Day' or 'Night')
  - `status` (text: 'Draft', 'Verified')
  - `submitted_by` (uuid)
  - `verified_by` (uuid)
  - `created_at`, `updated_at` (timestamps)

- `hub_shift_report_entries`
  - `id` (uuid, primary key)
  - `report_id` (uuid, references hub_shift_reports)
  - `client_id` (uuid, references clients)
  - **Draft Columns:** `draft_charged_3w`, `draft_charged_4w`, `draft_charging_3w`, `draft_charging_4w`, `draft_pending_3w`, `draft_pending_4w`, `draft_parking_3w`, `draft_parking_4w`
  - **Verified Columns:** `verified_charged_3w`, `verified_charged_4w`, `verified_charging_3w`, `verified_charging_4w`, `verified_pending_3w`, `verified_pending_4w`, `verified_parking_3w`, `verified_parking_4w`

### Security & Routing (RBAC)

#### Route Registration
- The feature will be built as a new module within the **Data Manager** vertical.
- We will register a new "feature" flag (e.g., `shift_reports_management`) in the RBAC system.
- This will allow User Management to grant specific employees access to the Import, Verification, or Reporting layers of this feature.

### Frontend Application (Desktop Only)

We will restrict these new views to desktop layouts using the app's existing adaptive shell architecture (e.g., `DesktopLayout` / Phase 2 architecture).

#### CSV Import/Export Flow (Hub Team)
- A dashboard to select Date, Hub, and Shift.
- **Download Template:** Generates a CSV with a list of active clients and columns for 3W/4W counts.
- **Upload CSV:** Parses the uploaded file, validates the data, and saves it into the `draft_*` columns.

#### Verification View (Data Team)
- A view to open a submitted draft.
- Displays the draft numbers side-by-side with inputs for the verified numbers.
- A "Submit Verification" button that saves to the `verified_*` columns and updates the report status to 'Verified'.

#### Daily Compliance Trackers
- A matrix/grid view (Hubs on Y-axis, Dates on X-axis).
- Visual indicators (e.g., traffic light colors) to quickly show:
  - 🔴 Missing Draft
  - 🟡 Draft Submitted, Pending Verification
  - 🟢 Verified

#### Analytics & Master Summary Reports
- **Graph Section:** Interactive charts showing metrics (e.g., Total Charged over time). Includes robust filters (Date Range, Hub, Client, Shift).
- **Master Tables:** Recreating the exact Excel summary views from your screenshots, running exclusively off the `verified_*` columns.
