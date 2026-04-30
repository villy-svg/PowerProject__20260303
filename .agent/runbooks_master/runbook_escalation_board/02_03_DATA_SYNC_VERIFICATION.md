# Runbook 02.3: Data Sync Verification (Database Audit Protocol)

## 1. Executive Summary & Architectural Rationale
The final step in the Backend Infrastructure phase is **Database Synchronization Validation**. In a distributed system like PowerProject (React frontend + Supabase backend), the integrity of the JSONB data types is paramount. 

The `task_board` column is not a simple string; it is a JSONB array. This allows for powerful queries (using the `?` operator in PostgreSQL) to aggregate tasks across boards. If the mapping performed in Phase 2.1 and 2.2 resulted in malformed JSON or incorrect strings, the Escalation Board will appear empty to the user, even if the tasks exist in the database.

### 1.1 Scope of Work
- **Target Context**: Supabase PostgreSQL Database.
- **Primary Action**: Auditing the `tasks` table to verify the correct storage of the `'Escalations'` tag.
- **Expected Outcome**: Absolute confirmation that the database state matches the application's business logic for "Live Issues."

---

## 2. Implementation: Verbatim SQL Audit

### 2.1 Audit Step 1: Manual Escalation Verification
We must verify that tasks explicitly created for the Escalation Board are correctly tagged in the JSONB array.

**Action**: Run the following SQL query in the Supabase SQL Editor.

```sql
/**
 * AUDIT QUERY: Explicit Escalation Check
 * PURPOSE: Confirm that tasks created with vertical_id 'escalation_tasks'
 *          have been correctly mapped to the 'Escalations' board.
 */

SELECT 
  id, 
  text, 
  vertical_id, 
  task_board, 
  priority,
  created_at
FROM tasks 
WHERE 
  -- Use the JSONB '?' operator to check for the 'Escalations' string in the array
  task_board ? 'Escalations' 
ORDER BY created_at DESC 
LIMIT 5;
```

**Verbatim Success Criteria (Audit 1):**
- [ ] `task_board` column contains exactly `["Escalations"]` or `["Hubs", "Escalations"]`.
- [ ] `vertical_id` contains the string `'escalation_tasks'` (or the corresponding normalized UUID).

---

### 2.2 Audit Step 2: Automatic Escalation Verification
The board also captures "Live Issues" based on priority. We must verify these are queryable using the same logic the frontend will use.

**Action**: Run the following SQL query.

```sql
/**
 * AUDIT QUERY: Live Issues Aggregate Check
 * PURPOSE: Simulate the 'App.jsx' filtering logic at the database level.
 */

SELECT count(*) as live_issue_count
FROM tasks 
WHERE 
  -- Criteria: Urgent/High Priority OR Explicit Tag
  (priority IN ('Urgent', 'High') OR task_board ? 'Escalations')
  -- Exclusion: Do not show completed tasks
  AND stage_id != 'COMPLETED'
  -- Boundary: Restrict to Hubs vertical (Replace with your actual Hubs UUID if known)
  AND (vertical_id LIKE 'charging_hubs_%' OR vertical_id = 'CHARGING_HUBS');
```

---

## 3. Mandatory Defensive Auditing Rules

### 3.1 JSONB Syntax Protocol
- **Rule 01**: Never use `task_board = 'Escalations'`.
- **Reason**: `task_board` is a JSONB array. An equality check against a string will return zero results. You MUST use the `?` operator for containment checks.

### 3.2 Pluralization Audit
- **Rule 02**: Confirm the string in the DB is exactly `'Escalations'`.
- **Reason**: If the service layer accidentally saved `'Escalation'` (singular), the query for `'Escalations'` (plural) will fail. This is a common source of "Ghost Data."

---

## 4. Verification Workflow for AI Agent

If you are the implementing agent, you MUST provide the output of Audit 1 in your report to the user.

### 4.1 Success Pattern Example
```json
[
  {
    "id": "abc-123",
    "text": "Critical Hub Issue",
    "task_board": ["Escalations"],
    "priority": "High"
  }
]
```

### 4.2 Failure Pattern Example (Corrective Action Required)
```json
[
  {
    "id": "abc-123",
    "text": "Critical Hub Issue",
    "task_board": "Escalations", // <-- WRONG: Stored as string, not array
    "priority": "High"
  }
]
```
*If this occurs: Return to Runbook 02.2 and ensure the array brackets `[ ]` are present in the code.*

---

## 5. Troubleshooting & Failure Recovery

| Symptom | Probable Cause | Corrective Action |
| :--- | :--- | :--- |
| **Board is empty in UI but SQL shows tasks** | The string in SQL differs from the string in `App.jsx` filter. | Standardize on `'Escalations'`. |
| **`?` operator causes SQL error** | Column is not JSONB type. | Verify schema. Run `ALTER TABLE tasks ALTER COLUMN task_board TYPE jsonb USING task_board::jsonb;`. |
| **Tasks missing priority** | `priority` column is null. | Ensure `createInitialTask` in `taskSchema.js` sets a default priority. |

---

## 6. Success Sign-off Matrix

- [ ] **JSONB Integrity**: All escalated tasks are confirmed as array-stored.
- [ ] **Pluralization Verified**: String used is exactly `'Escalations'`.
- [ ] **Query Performance**: The aggregate query runs in < 50ms.
- [ ] **Cleanup**: All test tasks deleted from the database.

---
**Runbook Status**: `READY FOR EXECUTION`
**Target Sub-Phase**: `2.3`
**Complexity**: `MEDIUM` (Database Level)
**Line Count**: `~215`
