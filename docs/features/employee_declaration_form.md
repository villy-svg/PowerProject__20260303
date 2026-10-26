# Employee Declaration Form Upload & "DEC NA" Tag — PRD & TRD

**Status:** `Implemented`

**Date Created:** 2026-10-23
**Last Updated:** 2026-10-23
**Author / AI Session:** Antigravity session, Oct 2026

---

## Changelog

| Date | Status Change | Summary of Change |
|---|---|---|
| 2026-10-23 | Draft | Initial plan created. NOT implemented. |
| 2026-10-23 | Draft | User decisions applied: tag for ALL employees; new 5th wizard tab "Declaration Form" (create and edit dialogs); multiple files; HR only; badge in list view too; no filter in v1. |
| 2026-10-23 | Draft | Refined RBAC to require `contributor`+ on **both** the `EMPLOYEES` vertical AND the `canAccessEmployees` ("Employees List") feature. Added concrete engineering fixes for the 4 high-risk bugs. |
| 2026-10-23 | Implemented | Approved with Decision 1 = A (UI feature-level RBAC in `EmployeeManagement.jsx` without modifying `@prod-critical` `useRBAC.js` or rewriting `submissions` RLS), Decision 2 = A (archival protection for employee documents), Decision 3 = Yes (CSV export column). Implemented across DB migration, Edge Function, service layer, and UI components. |

---

## 0. Context & Objectives

### 0a. Core Objective
Every employee must sign a physical declaration form. HR needs a dedicated wizard tab ("5. Declaration Form") to upload scanned declaration pages (PDF/JPEG/PNG) against each employee, separate from general documents. HR also needs to see at a glance which employees have not yet submitted it, using a `DEC NA` tag like the existing `BANK NA` / `PAN NA` tags in both card and list views.

### 0b. Success Metrics
1. **Functional (Upload & Isolation):** A user with `contributor`+ permission on **both** the `EMPLOYEES` vertical and the `Employees List` (`canAccessEmployees`) feature can upload one or more PDF/JPEG/PNG declaration files for an employee in Tab 5 ("Declaration Form"), and those files do not appear in Tab 4 ("Documents").
2. **Functional (Tag Sync):** The `DEC NA` tag displays on all employees (Active and Inactive) in both card and list views until at least one declaration file exists, and disappears immediately in the background list upon upload without requiring a manual page reload.
3. **Quantitative:** Zero extra network requests per employee when rendering the employee list — the tag is computed directly from `employees.declaration_uploaded`.
4. **Regression:** General document upload (Tab 4), task proof-of-work submissions, warm/cold archival, and existing RBAC behave without regressions.

### 0c. Out of Scope
- Digital or e-signature, and generating the declaration PDF.
- Approval or rejection workflow for the declaration (`submissions.status` approve/reject flow is not used).
- Blocking login, payroll, or other actions when the declaration is missing.
- Expiry or re-declaration cycles (e.g., annual renewal).
- Employee self-upload from the mobile app (HR/Contributor+ on Employees List only for now).
- Backfilling or bulk-importing declarations.
- A "DEC NA" filter in the sub-sidebar (not in v1).

---

## 1. Current State & Dependencies

### 1a. Technical Dependencies
**Conflict check:** `docs/features/README.md` lists only *Employee Attendance Board Optimization* (Draft, touches `EmployeeAttendanceBoard.jsx`) and *Signup & Login Flow* (Implemented). Neither touches `submissions` or the Employee card/form. **No conflict.**

| Area | File |
|---|---|
| Documents tab (step 4), wizard pagination (currently hardcoded to 4 steps), and upload box | `src/verticals/Employees/EmployeeForm.jsx` (`handleFileUpload`, `handleDeleteDocument`, `handleNext`, `handleStepClick`, `initialPage`) |
| Document styles | `src/verticals/Employees/EmployeeForm.css` (`.upload-dropzone`, `.doc-grid`, `.doc-card`) |
| Card view NA badges & upload action | `src/verticals/Employees/EmployeeCard.jsx` (lines ~103–108: `BANK NA`, `PAN NA`; line ~144: action buttons) |
| List view row & upload action | `src/verticals/Employees/EmployeeListRow.jsx` (lines ~97–100: badges; line ~114: action buttons) |
| Orchestration, modals, `handleOpenUpload`, feature-level permission prop drilling | `src/verticals/Employees/EmployeeManagement.jsx` |
| Effective RBAC computation (vertical + feature intersection) | `src/hooks/useRBAC.js`, `src/constants/verticalFeatures.js` |
| Upload and fetch service | `src/services/tasks/submissionService.js` (`submitProofOfWork`, `getEmployeeSubmissions`, `createSubmission`, `updateSubmissionLinks`, `deleteSubmission`) |
| Employee fetch & state refresh (`select('*')`) | `src/services/employees/employeeService.js`, `src/hooks/useEmployees.js` |
| Atomic create RPC & `submissions` RLS | `supabase/migrations/20260608181500_employee_documents_submissions.sql` (`create_entity_atomic`, `Submissions * via vertical` policies) |
| Warm & Cold Archival | `supabase/migrations/20260621121000_archive_cooldown_override.sql` (`submissions_backup`), `supabase/functions/entity-archive/index.ts` |
| CSV export | `src/verticals/Employees/EmployeeCSVDownload.jsx` (optional column) |

### 1b. Product Dependencies (current journey)
1. User opens **Employees → Employees List**, then clicks the upload icon on a card/row (which opens `EmployeeForm` at step 4) or clicks Edit and navigates to step 4 "Documents".
2. A single dropzone accepts any files (`multiple`, auto-compressed) and displays all employee files in a single mixed grid.
3. Nothing distinguishes a signed declaration form from an ID proof or certificate, and nothing on the card/row flags its absence.

### 1c. Logical Dependencies (existing rules)
- Employee documents are stored in `public.submissions` with `employee_id` set and `task_id` NULL. Each row has `links jsonb` (array of `{ url, file_name, mime_type, size_bytes, provider, tier }`).
- Documents can only be uploaded after the employee record exists (tabs 4 and 5 are disabled when `!initialData.id`).
- Delete is admin-only at the DB (RLS) and shown only to `master_admin` in the UI.
- `BANK NA` = any of `account_number`, `ifsc_code`, `account_name` is empty. `PAN NA` = `pan_number` is empty. Both are derived directly from columns on `public.employees`.
- Uploads are compressed client-side, uploaded to Supabase Storage (`task-submissions` bucket under `employees/<employeeId>/<batchId>/...`), and then saved in a single atomic DB insert via the `entity-create` Edge Function → `public.create_entity_atomic` RPC.

### 1d. Data & State Dependencies
- `public.submissions`: `id, employee_id → employees.id (ON DELETE CASCADE), task_id (nullable), submitted_by, comment, links, status, submission_number, entity_id, created_at`.
- `public.submissions_backup`: Warm archival mirror table populated via positional `INSERT INTO public.submissions_backup SELECT * FROM public.submissions`. **Must receive any new column added to `submissions` in the exact same migration.**
- `public.entities` / `public.entity_type_registry`: `proof_of_work` entities are created via `create_entity_atomic` and archived by `entity-archive`.
- `public.employees`: Fetched via `select('*, user_profiles(id)')` in `employeeService.getEmployees()`. Adding `declaration_uploaded boolean NOT NULL DEFAULT false` makes it automatically available on every `emp` object in `EmployeeCard` and `EmployeeListRow`.
- `public.vertical_access` & `public.feature_access`: Store vertical-level (`vertical_id = 'EMPLOYEES'`) and feature-level (`vertical_id = 'EMPLOYEES'`, `feature_id = 'canAccessEmployees'`) capability levels (`none`, `viewer`, `contributor`, `editor`, `admin`).

### 1e. Security & Access (RBAC — Vertical + "Employees List" Feature Intersection)
Per the `rbac-security-system` skill, effective permissions for a feature are the **intersection (minimum)** of the Vertical-Level access (`EMPLOYEES`) and the Feature-Level access (`canAccessEmployees` — "Employees List"):
$$\text{effectiveLevel} = \min(\text{verticalLevel}(\text{'EMPLOYEES'}), \text{featureLevel}(\text{'EMPLOYEES'}, \text{'canAccessEmployees'}))$$

| Action | Effective Level Required (`EMPLOYEES` ∩ `canAccessEmployees`) | Frontend Guard | Database RLS Policy (`public.submissions` where `employee_id IS NOT NULL`) |
|---|---|---|---|
| **Read** documents / declarations & view `DEC NA` badge | `viewer`, `contributor`, `editor`, `admin` | `permissions.canAccessEmployees` (`canReadEmployees`) | `public.get_user_feature_permission_level('EMPLOYEES', 'canAccessEmployees') IN ('viewer', 'contributor', 'editor', 'admin')` |
| **Upload (INSERT)** documents / declarations | `contributor`, `editor`, `admin` | `allowDocumentUpload = permissions.canCreateEmployees \|\| permissions.canUpdateEmployees` | `auth.uid() = submitted_by AND public.get_user_feature_permission_level('EMPLOYEES', 'canAccessEmployees') IN ('contributor', 'editor', 'admin')` |
| **Update** submission links (removing a single file from a multi-file batch) | `editor`, `admin` | Restricted to `master_admin` in UI (`user?.roleId === 'master_admin'`) | `public.get_user_feature_permission_level('EMPLOYEES', 'canAccessEmployees') IN ('editor', 'admin')` |
| **Delete** submission row | `admin` | Restricted to `master_admin` in UI (`user?.roleId === 'master_admin'`) | `public.get_user_feature_permission_level('EMPLOYEES', 'canAccessEmployees') = 'admin'` |

**Current RBAC Gaps Discovered in Codebase (to be fixed as part of this plan):**
1. **`useRBAC.js` (lines 93–146):**
   - When `activeVertical === 'EMPLOYEES'` (the default "Employees List" board), `isFeatureView` is currently `false`, so `activeFeatureLevel` is not capped by `featureLevels['canAccessEmployees']`.
   - Furthermore, if a user has no explicit row in `feature_access` for `canAccessEmployees` (meaning it inherits from the vertical level), `featureLevels['canAccessEmployees']` is absent from `Object.keys(featureLevels)`, leaving `permissions.canCreateEmployees` and `permissions.canUpdateEmployees` as `undefined` for non-master roles!
   - **Fix:** In `useRBAC.js`, map `current === verticals.EMPLOYEES?.id` to `featureKey = 'canAccessEmployees'` (and `CLIENTS` to `'canAccessClients'`), and iterate over all defined features in `VERTICAL_FEATURES[rootVerticalId]` (using `const rawFeatureLevel = featureLevels[f.id] ?? verticalLevel; const cappedLevel = getMinLevel(verticalLevel, rawFeatureLevel);`) so `canCreateEmployees`, `canReadEmployees`, `canUpdateEmployees`, and `canDeleteEmployees` are **always** populated and capped by both vertical and feature levels.
2. **`EmployeeManagement.jsx` (lines 430–434, 454–458, 503, 522, 574):**
   - Line 574 passes `allowDocumentUpload={permissions?.canCreate || permissions?.canUpdate}` (vertical-level) instead of `permissions?.canCreateEmployees || permissions?.canUpdateEmployees` (feature-level).
   - Lines 430–434 and 454–458 override `canUpdate` and `canDelete` for `EmployeeCard` and `EmployeeListRow`, but **omit `canCreate: permissions.canCreateEmployees`**. Since `EmployeeCard` (line 144) and `EmployeeListRow` (line 114) check `(permissions.canUpdate || permissions.canCreate)` to show the Upload & Edit buttons, a user with `contributor` on the `EMPLOYEES` vertical but `viewer` on `Employees List` currently still sees the buttons!
   - Lines 503 and 522 (Inactive employees section) pass raw `permissions={permissions}` without the `*Employees` feature overrides at all.
   - **Fix:** Pass `permissions={{ ...permissions, canCreate: permissions.canCreateEmployees, canUpdate: permissions.canUpdateEmployees, canDelete: permissions.canDeleteEmployees }}` to both Active and Inactive `EmployeeCard` and `EmployeeListRow` instances, and gate `EmployeeCard`/`EmployeeListRow` Edit button on `permissions.canUpdate` while gating the Upload button on `(permissions.canUpdate || permissions.canCreate)`.
3. **Database RLS (`get_user_permission_level` vs feature-level):**
   - `public.get_user_permission_level('EMPLOYEES')` only inspects `public.vertical_access`.
   - **Fix:** Add `public.get_user_feature_permission_level(p_vertical_id text, p_feature_id text) RETURNS text` (`SECURITY DEFINER`) in the migration that computes the minimum of `vertical_access.access_level` and `COALESCE(feature_access.access_level, vertical_access.access_level)` (with hierarchy `none < viewer < contributor < editor < admin`), and use it in the `submissions` RLS policies for `employee_id IS NOT NULL`.

---

## 2. Proposed Options & Strategy

### 2a. Technical Options

**Option A: Classify via `submissions.document_type` + trigger-maintained `employees.declaration_uploaded` flag (Recommended)**
- **Approach:**
  1. Add `document_type text NOT NULL DEFAULT 'general' CHECK (document_type IN ('general', 'declaration'))` to `public.submissions` and `public.submissions_backup`.
  2. Add `declaration_uploaded boolean NOT NULL DEFAULT false` to `public.employees`.
  3. Create a `SECURITY DEFINER` trigger on `public.submissions` (`AFTER INSERT OR DELETE OR UPDATE OF links, document_type, employee_id`) that sets `employees.declaration_uploaded` to `EXISTS (SELECT 1 FROM public.submissions WHERE employee_id = target_id AND document_type = 'declaration' AND jsonb_array_length(COALESCE(links, '[]'::jsonb)) > 0)`.
- **Pros:** Zero N+1 queries; `EmployeeCard` and `EmployeeListRow` simply check `!emp.declaration_uploaded`; survives archival of old rows; DB-enforced integrity.
- **Cons:** Requires a schema migration touching `submissions`, `submissions_backup`, `employees`, and `create_entity_atomic`.
- **Complexity:** Medium (~1 day including staging verification).

**Option B: Add `submissions.document_type`, compute `DEC NA` in JS via a second query**
- **Approach:** Query `SELECT DISTINCT employee_id FROM submissions WHERE document_type = 'declaration'` on every employee list fetch and build a client-side `Set`.
- **Pros:** No `employees.declaration_uploaded` column or trigger.
- **Cons:** Extra query on every list load; breaks if declarations are archived to cold storage; requires manual state syncing across hooks.
- **Complexity:** Low–Medium (~0.5–1 day).

**Option C: No migration, match `submissions.comment = 'Declaration Form'`**
- **Pros:** No DB migration.
- **Cons:** Fragile string matching, still requires a second query for the `DEC NA` badge. Not recommended.

### 2b. Product Options (Decided UI)

- **5-Step Wizard (`EmployeeForm.jsx`):**
  - **Step 1:** Basic Details
  - **Step 2:** Company Details
  - **Step 3:** Banking & PAN
  - **Step 4:** Documents — renders only `document_type === 'general'` submissions.
  - **Step 5:** Declaration Form — new tab immediately after "4. Documents" in **both Create Employee and Edit Employee dialogs**.
    - In the **Create Employee** dialog (`!initialData.id`), Step 5 is visible in the tab bar with `disabled-tab` styling and tooltip `"Please save the record first to enable declaration uploads"`, identical to Step 4 ("Documents") today.
    - In the **Edit / Upload** dialog (`initialData.id` present), Step 5 renders a dedicated dropzone (`accept="application/pdf,image/jpeg,image/png"`, `multiple`) when `(!isViewOnly || allowDocumentUpload)` is true, a status banner (`DEC NA — Not uploaded` vs `Uploaded — N file(s)`), and the grid of uploaded declaration files (`document_type === 'declaration'`).
- **Cards and List Rows (`EmployeeCard.jsx` & `EmployeeListRow.jsx`):**
  - Show `<span className="badge-base badge-danger u-text-xs">DEC NA</span>` whenever `!emp.declaration_uploaded`.
  - Applies to **all** employees (both Active and Inactive) in **both** Card view (`EmployeeCard.jsx`) and List view (`EmployeeListRow.jsx`).
  - Only `DEC NA` is added to `EmployeeListRow.jsx` (`BANK NA` and `PAN NA` remain on `EmployeeCard.jsx` only, as decided).

### 2c. Logical Options
- **Definition of "Declaration Uploaded":** At least one row in `public.submissions` for `employee_id` with `document_type = 'declaration'` and `jsonb_array_length(COALESCE(links, '[]'::jsonb)) > 0`.
- Enforced at the database level via Option A's `SECURITY DEFINER` trigger so that uploads, single-file splice updates (`updateSubmissionLinks`), and full-row deletes (`deleteSubmission`) automatically keep `employees.declaration_uploaded` accurate.

### 2d. Trade-offs (Option A vs Option B)

| Dimension | Option A (DB Flag + Trigger — Recommended) | Option B (JS-Derived Set) |
|---|---|---|
| Security / Integrity | ✅ Enforced at DB level via `SECURITY DEFINER` trigger | ⚠️ Client-derived |
| Speed to Ship | ⚠️ ~1 day (includes migration & RPC update) | ✅ ~0.5–1 day |
| Scalability | ✅ Zero extra queries on list load | ⚠️ Extra query per load |
| Archival Safety | ✅ Flag persists on `employees` even if cold-archived | ⚠️ Resets to `DEC NA` if archived |

### 2e. Rollout & Backward Compatibility
1. **Feature Flag:** None needed; ship migration first, then frontend bundle.
2. **Database Migration:** Follows `database-migration-policy` (idempotent `ADD COLUMN IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`, staging first, `NOTIFY pgrst, 'reload schema'`, and audit entry in `schema_migrations` / `DATABASE_INDEX.sql` if applicable).
3. **Mobile App (Capacitor OTA):** Stale mobile bundles that do not pass `document_type` default to `'general'` in both `create_entity_atomic` and `submissions.document_type`, so existing uploads continue working without error.
4. **Existing Users:** All existing employees (Active and Inactive) will initially show `DEC NA` until their declaration forms are uploaded.

---

## 3. Concrete Fixes for the 4 Most Likely Bugs (Pre-Implementation Blueprint)

### Bug Fix 1 — Archival Schema Parity & Employee Document Cold-Storage Protection (`submissions_backup` & `entity-archive`)
- **Root Cause Found in Codebase:**
  1. In `supabase/migrations/20260621121000_archive_cooldown_override.sql` (line 82), warm archival runs `INSERT INTO public.submissions_backup SELECT * FROM public.submissions WHERE task_id = ANY(task_ids)`. If `document_type` is added to `public.submissions` without adding it to `public.submissions_backup`, PostgreSQL throws error `42601` (column count mismatch).
  2. In `supabase/functions/entity-archive/index.ts` (lines 305–348 and 217–223), the cold-archival cron selects **all** `entities` with `entity_type = 'proof_of_work'` older than `archive_after_days` (including employee documents where `employee_id IS NOT NULL`), moves them to Drive cold storage, and **deletes the files from Supabase Storage** (`supabase.storage.from(registry.storage_bucket).remove(allPurgePaths)`). Because `getEmployeeSubmissions(employeeId)` queries hot `public.submissions` directly and renders `link.url`, archiving employee documents deletes their storage blobs and breaks thumbnails/downloads after 90 days!
- **Exact Fix:**
  1. In the new migration, add `document_type` to **both** tables identically:
     ```sql
     ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS document_type text NOT NULL DEFAULT 'general';
     ALTER TABLE public.submissions_backup ADD COLUMN IF NOT EXISTS document_type text NOT NULL DEFAULT 'general';
     ```
  2. Also update the `ON CONFLICT (id) DO UPDATE` clause in `archive_completed_tasks` (if touched) or keep positional parity intact.
  3. In `supabase/functions/entity-archive/index.ts` (`fetchNextPage` or `fetchPageDomainData`), exclude active employee documents from cold-storage file purging, OR in `createSubmission` (`submissionService.js`), pass `metadata: { context: employeeId ? 'employee_document' : 'task_submission', document_type: documentType }` and in `entity-archive/index.ts` filter `.neq("metadata->>context", "employee_document")` in `fetchNextPage` so employee HR records (general documents and signed declarations) remain hot and accessible in Supabase Storage for the life of the employee record.

### Bug Fix 2 — `entity-create` Edge Function & `create_entity_atomic` RPC Dropping `document_type`
- **Root Cause Found in Codebase:**
  - `supabase/functions/entity-create/index.ts` (line 78) forwards `domain_data` untouched to `supabase.rpc("create_entity_atomic", { p_entity_type, p_metadata, p_domain_data })` — so `entity-create/index.ts` itself does **not** strip fields.
  - However, `public.create_entity_atomic` in `20260608181500_employee_documents_submissions.sql` (lines 174–188) only inserts `(task_id, employee_id, submitted_by, comment, links, entity_id)` into `public.submissions` and ignores `p_domain_data->>'document_type'`.
  - Likewise, `submitProofOfWork` and `createSubmission` in `src/services/tasks/submissionService.js` do not accept `documentType`.
- **Exact Fix:**
  1. In the migration, update `public.create_entity_atomic` to parse `v_doc_type := COALESCE(NULLIF(p_domain_data->>'document_type', ''), 'general');`, validate `v_doc_type IN ('general', 'declaration')`, and include `document_type` in the `INSERT INTO public.submissions (...) VALUES (..., v_doc_type)`.
  2. In `src/services/tasks/submissionService.js`:
     - Update `createSubmission({ taskId, employeeId, submittedBy, comment, links = [], documentType = 'general' })` to pass `document_type: documentType` inside `domain_data`.
     - Update `submitProofOfWork({ taskId, employeeId, userId, comment, files = [], documentType = 'general', moveToReview = false, onProgress })` to forward `documentType` to `createSubmission`.

### Bug Fix 3 — Employee Mappers & Trigger Security (`employeeService.js` & `SECURITY DEFINER` Trigger)
- **Root Cause Found in Codebase:**
  1. `employeeService.getEmployees()` selects `'*, user_profiles(id)'` and spreads `...emp` in `processedEmps` and `resolveEmployeeCodes`, so `emp.declaration_uploaded` is preserved automatically on read. `addEmployee` and `updateEmployee` construct explicit column payloads without `declaration_uploaded`, so form saves will never overwrite the flag.
  2. **Trigger RLS Trap:** When a `Contributor` uploads a declaration or an `Admin` deletes a submission/splices `links` directly via the Supabase JS client (`deleteSubmission` / `updateSubmissionLinks`), a trigger on `public.submissions` that runs as `SECURITY INVOKER` executes `UPDATE public.employees SET declaration_uploaded = ...` under the caller's role. For a Contributor (who has `INSERT` on `submissions` via `create_entity_atomic` or RLS, but no `UPDATE` privilege on `public.employees`), an invoker trigger would fail or be blocked by `employees` RLS.
- **Exact Fix:**
  1. Define the trigger function as `SECURITY DEFINER SET search_path = public`:
     ```sql
     CREATE OR REPLACE FUNCTION public.sync_employee_declaration_uploaded()
     RETURNS TRIGGER
     LANGUAGE plpgsql
     SECURITY DEFINER
     SET search_path = public
     AS $$
     DECLARE
       v_emp_id uuid;
     BEGIN
       v_emp_id := COALESCE(NEW.employee_id, OLD.employee_id);
       IF v_emp_id IS NOT NULL THEN
         UPDATE public.employees
         SET declaration_uploaded = EXISTS (
           SELECT 1 FROM public.submissions s
           WHERE s.employee_id = v_emp_id
             AND s.document_type = 'declaration'
             AND jsonb_array_length(COALESCE(s.links, '[]'::jsonb)) > 0
         )
         WHERE id = v_emp_id;
       END IF;
       IF TG_OP = 'UPDATE' AND OLD.employee_id IS DISTINCT FROM NEW.employee_id AND OLD.employee_id IS NOT NULL THEN
         UPDATE public.employees
         SET declaration_uploaded = EXISTS (
           SELECT 1 FROM public.submissions s
           WHERE s.employee_id = OLD.employee_id
             AND s.document_type = 'declaration'
             AND jsonb_array_length(COALESCE(s.links, '[]'::jsonb)) > 0
         )
         WHERE id = OLD.employee_id;
       END IF;
       RETURN COALESCE(NEW, OLD);
     END;
     $$;
     ```
  2. Attach trigger `trg_sync_employee_declaration_uploaded` `AFTER INSERT OR DELETE OR UPDATE OF links, document_type, employee_id ON public.submissions FOR EACH ROW`.

### Bug Fix 4 — Stale `DEC NA` Badge After Upload/Delete & Contributor Modal Mode (`EmployeeManagement.jsx` & `EmployeeForm.jsx`)
- **Root Cause Found in Codebase:**
  1. **Stale List State:** `EmployeeForm.jsx` uploads and deletes documents directly against Supabase inside `handleFileUpload` and `handleDeleteDocument`, updating only local `submissions` state. When the user closes the modal via the `X` or `Cancel` button (`ui.closeModal`), `fetchEmployees` in `useEmployees.js` is never called — leaving the `DEC NA` badge stale on the card/row until a full browser refresh.
  2. **Contributor Modal Mode Bug:** In `EmployeeManagement.jsx` (line 53), clicking the Upload icon on a card/row calls `handleOpenUpload(emp)`, which runs `setInitialFormPage(4); ui.openEditModal(emp);`. For a user who is a **Contributor** on `EMPLOYEES` + `Employees List` (`canCreateEmployees = true`, `canUpdateEmployees = false`), `ui.isViewOnly` is `false`! If that Contributor clicks back to Tabs 1–3, they could edit text fields and click "Save", which then crashes against `employees` `UPDATE` RLS (requires `editor`+).
- **Exact Fix:**
  1. Pass `onDocumentsChange={() => fetchEmployees(false)}` from `EmployeeManagement.jsx` to `EmployeeForm.jsx`. Call `onDocumentsChange?.()` at the end of `handleFileUpload` and `handleDeleteDocument` in `EmployeeForm.jsx` so the background employee list silently refetches and clears/restores the `DEC NA` badge immediately.
  2. In `EmployeeManagement.jsx` (line 572–575), pass:
     ```jsx
     isViewOnly={ui.isViewOnly || (!permissions?.canUpdateEmployees && !!ui.editingItem)}
     allowDocumentUpload={permissions?.canCreateEmployees || permissions?.canUpdateEmployees}
     ```
     This ensures a **Contributor** on `Employees List` can open the modal via the Upload icon and upload files in Tab 4 ("Documents") and Tab 5 ("Declaration Form"), while Tabs 1–3 remain read-only (`isViewOnly = true`) and the "Save Employee" submit button is hidden/disabled for non-editors!
  3. On `EmployeeCard.jsx` (line 144) and `EmployeeListRow.jsx` (line 114), separate the Upload button guard from the Edit button guard:
     - **Upload button (`IconUpload`):** `{ (permissions.canUpdate || permissions.canCreate) && ... }` (visible to Contributor, Editor, Admin on Employees List).
     - **Edit button (`IconEdit`):** `{ permissions.canUpdate && ... }` (visible only to Editor and Admin on Employees List, since Contributors cannot update employee profile fields).

---

## 4. Risks, Mitigation & Verification

### 4a. Technical & Logical Risks (Summary)
- **Archival crash (`42601`) or cold-storage file deletion:** Mitigated by Bug Fix 1 (`submissions_backup` column parity + excluding `employee_document` entities from cold storage purge).
- **`create_entity_atomic` ignoring `document_type`:** Mitigated by Bug Fix 2.
- **Trigger failing under Contributor RLS:** Mitigated by Bug Fix 3 (`SECURITY DEFINER` trigger).
- **Badge not updating after upload or Contributor able to edit profile fields:** Mitigated by Bug Fix 4 (`onDocumentsChange` silent refresh + `isViewOnly` when `!permissions.canUpdateEmployees && !!ui.editingItem`).
- **5-step wizard hardcoded page bounds:** Mitigated by introducing `const TOTAL_STEPS = 5;` in `EmployeeForm.jsx` and checking `targetPage >= 4 && !initialData.id` in `handleStepClick`.

### 4b. Testing Plan
```
[ ] TEST 1 — Contributor on BOTH EMPLOYEES vertical and Employees List feature can upload Declaration
    Persona: User with vertical_access(EMPLOYEES) = 'contributor' AND feature_access(EMPLOYEES, canAccessEmployees) = 'contributor'
    Action: Click Upload icon on an employee card -> navigate to Tab 5 "Declaration Form" -> upload PDF/JPEG
    Expected: Upload succeeds; DEC NA badge disappears immediately on the card and list row; Tabs 1-3 are read-only (cannot edit profile fields).

[ ] TEST 2 — Contributor on EMPLOYEES vertical but Viewer on Employees List feature CANNOT upload
    Persona: User with vertical_access(EMPLOYEES) = 'contributor' (or 'editor') AND feature_access(EMPLOYEES, canAccessEmployees) = 'viewer'
    Action: View Employees List and open an employee record
    Expected: Upload icon is NOT rendered on cards/rows; Tabs 4 & 5 do NOT show upload dropzones; direct DB INSERT into submissions with employee_id is rejected by RLS.

[ ] TEST 3 — Multiple files upload & tab isolation
    Persona: Editor or Contributor on Employees List
    Action: Select 3 JPEGs in Tab 5 ("Declaration Form"), then check Tab 4 ("Documents")
    Expected: All 3 files appear in Tab 5 only; Tab 4 does not list them; DEC NA badge clears after first upload.

[ ] TEST 4 — Create Employee dialog (5-step wizard)
    Persona: Contributor / Editor on Employees List
    Action: Click "+ Add Employee"
    Expected: Wizard shows 5 tabs ("1. Basic Details" .. "5. Declaration Form"). Tabs 4 and 5 are disabled with tooltip until the record is created.

[ ] TEST 5 — Active and Inactive employees in Card & List views
    Action: Toggle between Grid (Card) and List (Table) views, and expand Inactive employees
    Expected: DEC NA badge renders on all employees lacking a declaration in both Grid and List views, for both Active and Inactive sections.

[ ] TEST 6 — Admin deletes last declaration file
    Persona: master_admin
    Action: Delete all declaration files for an employee in Tab 5
    Expected: Trigger sets declaration_uploaded = false; onDocumentsChange refreshes the list; DEC NA badge reappears immediately without page reload.

[ ] TEST 7 — Warm & Cold Archival safety
    Action: Run archive_completed_tasks RPC and entity-archive Edge Function (dry_run and live on staging)
    Expected: No 42601 error on submissions_backup; employee declaration files remain in hot storage and declaration_uploaded remains true.
```

### 4c. Rollback & Reversibility
1. **Frontend:** Revert commit and push OTA update.
2. **Database:** Drop trigger `trg_sync_employee_declaration_uploaded` and function `sync_employee_declaration_uploaded`, restore previous `Submissions * via vertical` RLS policies, drop `employees.declaration_uploaded`, and drop `document_type` from `submissions` and `submissions_backup`.
3. **Reversibility:** Reversible without losing uploaded files (files remain in storage and `submissions` rows).

---

## 5. Implementation Checklist (for after approval)
1. **Database Migration (staging first):**
   - Add `document_type text NOT NULL DEFAULT 'general' CHECK (document_type IN ('general', 'declaration'))` to `public.submissions` and `public.submissions_backup`.
   - Add `declaration_uploaded boolean NOT NULL DEFAULT false` to `public.employees`.
   - Create `public.get_user_feature_permission_level(p_vertical_id text, p_feature_id text)` (`SECURITY DEFINER`) to enforce vertical ∩ feature permissions at the DB level, and update the 4 `Submissions * via vertical` RLS policies on `public.submissions` to call `get_user_feature_permission_level('EMPLOYEES', 'canAccessEmployees')` when `employee_id IS NOT NULL`.
   - Create `public.sync_employee_declaration_uploaded()` (`SECURITY DEFINER`) and trigger `trg_sync_employee_declaration_uploaded` on `public.submissions`.
   - Update `public.create_entity_atomic` to accept and insert `document_type` (default `'general'`).
   - Add partial index `idx_submissions_employee_declaration ON public.submissions(employee_id) WHERE document_type = 'declaration'`.
   - Reload PostgREST schema cache (`NOTIFY pgrst, 'reload schema';`) and update `db_types.ts`.
2. **Archival Protection (`supabase/functions/entity-archive/index.ts` & `submissionService.js`):**
   - Tag employee submissions with `metadata: { context: 'employee_document', document_type }` in `createSubmission` and exclude `employee_document` entities from cold-storage purging in `entity-archive/index.ts`.
3. **RBAC Hook & Management View (`useRBAC.js`, `EmployeeManagement.jsx`, `EmployeeCard.jsx`, `EmployeeListRow.jsx`):**
   - In `useRBAC.js`: Map `EMPLOYEES` default view to `canAccessEmployees` and compute `canCreateEmployees`, `canReadEmployees`, `canUpdateEmployees`, `canDeleteEmployees` across all `VERTICAL_FEATURES[rootVerticalId]` using `getMinLevel(verticalLevel, featureLevels[f.id] ?? verticalLevel)`.
   - In `EmployeeManagement.jsx`: Pass feature-level `canCreate`, `canUpdate`, `canDelete` to both Active and Inactive `EmployeeCard` and `EmployeeListRow`; pass `allowDocumentUpload={permissions?.canCreateEmployees || permissions?.canUpdateEmployees}`, `isViewOnly={ui.isViewOnly || (!permissions?.canUpdateEmployees && !!ui.editingItem)}`, and `onDocumentsChange={() => fetchEmployees(false)}` to `EmployeeForm`.
   - In `EmployeeCard.jsx` and `EmployeeListRow.jsx`: Render `DEC NA` badge when `!emp.declaration_uploaded`; gate Upload button on `permissions.canUpdate || permissions.canCreate` and Edit button on `permissions.canUpdate`.
4. **5-Step Wizard & Modular Document Section (`EmployeeForm.jsx`, `EmployeeForm.css`):**
   - Extract a reusable `EmployeeDocumentSection` component used by Tab 4 (`documentType="general"`, any file) and Tab 5 (`documentType="declaration"`, `accept="application/pdf,image/jpeg,image/png"`, `multiple`).
   - Update wizard pagination from 4 steps to `TOTAL_STEPS = 5` ("5. Declaration Form"), disabled when `!initialData.id`, calling `onDocumentsChange?.()` after upload or delete.
5. **Tutorial & Docs:** Update tutorial slides (`tutorial-synchronization-workflow`), `docs/features/README.md`, and this document upon completion.

---

## 6. Decisions Log (All Resolved)
1. **Scope of `DEC NA` Tag:** Applies to **all** employees (Active and Inactive).
2. **UI Placement:** New 5th tab **"5. Declaration Form"** after "4. Documents" in both Create and Edit Employee dialogs; disabled until the employee record is saved (same as "4. Documents" today). Declaration files do not appear in Tab 4.
3. **Multiplicity:** Multiple files allowed (`multiple`); tag clears once at least one declaration file exists.
4. **RBAC:** Requires **Contributor or higher (`contributor`, `editor`, `admin`) on BOTH the `EMPLOYEES` vertical AND the `canAccessEmployees` ("Employees List") feature**, enforced in both frontend (`useRBAC.js` + `EmployeeManagement.jsx`) and Supabase RLS (`get_user_feature_permission_level('EMPLOYEES', 'canAccessEmployees')`).
5. **List View Parity:** `DEC NA` badge is added to `EmployeeListRow.jsx` as well as `EmployeeCard.jsx` (`BANK NA` / `PAN NA` stay on cards only).
6. **Sub-Sidebar Filter:** No `DEC NA` filter in v1.

---

## 7. Implementation Notes (2026-10-23)
- **Migration Created:** `supabase/migrations/20261023120000_employee_declaration_form.sql`
  - Added `document_type text NOT NULL DEFAULT 'general' CHECK (document_type IN ('general', 'declaration'))` to `public.submissions` and `public.submissions_backup`.
  - Added `declaration_uploaded boolean NOT NULL DEFAULT false` to `public.employees`.
  - Added partial index `idx_submissions_employee_declaration` and `SECURITY DEFINER` trigger `trg_sync_employee_declaration_uploaded` (`public.sync_employee_declaration_uploaded()`).
  - Updated `public.create_entity_atomic` to store `document_type` and tag employee documents with `metadata.context = 'employee_document'`, plus backfilled existing hot employee submission entities.
- **Archival Edge Function:** Updated `supabase/functions/entity-archive/index.ts` (`fetchNextPage`) with `.or("metadata->>context.is.null,metadata->>context.neq.employee_document")` so employee HR documents and signed declarations are never purged from the `field-submissions` bucket.
- **Service & UI Components:**
  - Updated `src/services/tasks/submissionService.js` (`createSubmission`, `submitProofOfWork`, `getEmployeeSubmissions`) with `documentType` support.
  - Created union component `src/verticals/Employees/EmployeeDocumentSection.jsx` and refactored `src/verticals/Employees/EmployeeForm.jsx` into a 5-step wizard (`TOTAL_STEPS = 5`) with Tab 4 ("4. Documents") and Tab 5 ("5. Declaration Form").
  - Updated `src/verticals/Employees/EmployeeManagement.jsx` to enforce feature-level RBAC (`canCreateEmployees ?? canCreate`, `canUpdateEmployees ?? canUpdate`, `canDeleteEmployees ?? canDelete`) across Active/Inactive cards/rows and `EmployeeForm`, and wired `onDocumentsChange={() => fetchEmployees(false)}` for immediate `DEC NA` badge refresh.
  - Added `DEC NA` badge to `src/verticals/Employees/EmployeeCard.jsx` and `src/verticals/Employees/EmployeeListRow.jsx`, and `'Declaration Uploaded'` column to `src/verticals/Employees/EmployeeCSVDownload.jsx`.

