# Step-by-Step Execution Plan

This document outlines the exact flow of execution. We will proceed one phase at a time.

---

### 🟢 PRE-FLIGHT (Ready)
- [x] Tech Stack Confirmed (Supabase + GDrive)
- [x] Initial Plan Drafted
- [x] User Thresholds Integrated (7 days for submissions)
- [x] Cron Strategy Selected (GitHub Actions)

---

### 🟦 PHASE 1: DATABASE FOUNDATION (Estimated: 1 Chat)
1. **Goal**: Create the "Source of Truth" for where data lives.
2. **Action**: Create `entities`, `entity_type_registry`, and link `submissions`.
3. **Outcome**: Submissions can now be referenced by an "Entity ID".

### 🟦 PHASE 2: ATOMIC CREATION (Estimated: 1 Chat)
1. **Goal**: Stop doing raw inserts into submissions; use the gateway.
2. **Action**: Implement `entity-create` Edge Function.
3. **Outcome**: Every new submission automatically gets an entry in the `entities` table.

### 🟦 PHASE 3: READ GATEWAY (Estimated: 1 Chat)
1. **Goal**: Abstract the read path.
2. **Action**: Implement `entity-read` Edge Function.
3. **Outcome**: The UI calls this function to get data, without knowing if it's hot or cold.

### 🟨 PHASE 4: CLOUD ADAPTER (Estimated: 1 Chat)
1. **Goal**: Build the bridge to Google Drive.
2. **Action**: Input GCP credentials and implement the `gdrive-adapter`.
3. **Outcome**: We can now programmatically upload/download files to Drive.

### 🟨 PHASE 5: BATCHING & COMPRESSION (Estimated: 1 Chat)
1. **Goal**: Save space and API calls.
2. **Action**: Implement Gzip logic and batching strategy.
3. **Outcome**: We can pack 25 historical records into 1 tiny file.

### 🟥 PHASE 6: THE ARCHIVAL ENGINE (The High-Stakes Phase)
1. **Goal**: Move the data.
2. **Action**: Fetch 7-day-old records > Batch > Upload > Update DB > Clear Hot Data.
3. **Outcome**: PostgreSQL stays lean; data stays safe in GDrive.

### 🟥 PHASE 7-10: POLISH & AUTOMATION
1. **Action**: Extend `entity-read` for cold reads.
2. **Action**: Set up GitHub Actions Workflow.
3. **Action**: Add logging and performance caching.

---

### Ready to proceed?
If you are satisfied with this breakdown, let's start with **Phase 1: Database Foundation**.
