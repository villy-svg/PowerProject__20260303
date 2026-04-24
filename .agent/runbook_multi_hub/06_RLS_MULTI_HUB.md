# Runbook 4.1 — Hybrid RLS (Hub + Role + Status)

## Phase 4: RLS & Indexes
## Subphase 4.1: Implementation of Junction-Aware Access Control

---

## 1. Objective: The "Three-Key" Security System
In the new Multi-Hub architecture, access to a task is no longer just about which "Vertical" you belong to. A user must possess **Three Keys** to see a task on their board:

1.  **The Hub Key**: The user's assigned Hub must match one of the Hubs linked to the task in `task_context_links`.
2.  **The Role Key**: If the task specifies required roles (e.g., "Manager only"), the user's role must match. If no roles are linked, it is "Public" to all roles at that Hub.
3.  **The Status Key**: Both the User's employee record AND the specific context link must be `is_active = true`.

### Why this is necessary:
Without this, a "Ground Staff" member at **Hub A** would see tasks meant for **Hub B** simply because they share the same vertical. This system ensures total horizontal isolation between physical locations.

---

## 2. Prerequisites (Validation)
Before deploying these policies, ensure the following function exists (from Phase 2) and that the columns added in Phase 3 are present.

| Entity | Required Component | Purpose |
| :--- | :--- | :--- |
| Function | `public.get_user_permission_level(uuid)` | To check global vertical access. |
| Table | `task_context_links` | Must have `is_active` (boolean) and `entity_type` (text). |
| Table | `employees` | Must have `hub_id`, `role_id`, and `status`. |

---

## 3. Implementation: The Security Helper Function

To keep RLS policies fast and readable, we encapsulate the logic into a `STABLE` function. 

**Logic Note**: `SECURITY DEFINER` is used so the function can query tables that the user might not have direct SELECT access to (like the full `employees` table).

**Action**: Run this in the Supabase SQL Editor: `supabase/migrations/20260424105000_phase_4_1_hybrid_rls_core.sql`

```sql
CREATE OR REPLACE FUNCTION public.check_task_junction(p_task_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE -- Critical for performance: Result is cached for the duration of a single query.
AS $$
  SELECT EXISTS (
    -- Step 1: Identify the Current User
    SELECT 1 
    FROM public.user_profiles up
    JOIN public.employees e ON e.id = up.employee_id
    WHERE up.id = auth.uid()
      AND e.status = 'Active' -- KEY 3: User must be an Active employee.
      
      -- KEY 1: HUB LINKAGE (The "Where")
      -- Check if there is an active link between this task and the user's hub.
      AND EXISTS (
        SELECT 1 FROM public.task_context_links tcl_hub
        WHERE tcl_hub.source_id = p_task_id
          AND tcl_hub.entity_type = 'hub'
          AND tcl_hub.entity_id = e.hub_id
          AND tcl_hub.is_active = true -- KEY 3: The link itself must be enabled.
      )
      
      -- KEY 2: ROLE LINKAGE (The "Who")
      AND (
        -- Option A: The task has NO role restrictions (Public to all roles at the hub).
        NOT EXISTS (
            SELECT 1 FROM public.task_context_links tcl_any_role
            WHERE tcl_any_role.source_id = p_task_id 
              AND tcl_any_role.entity_type = 'role' 
              AND tcl_any_role.is_active = true
        )
        -- Option B: The task IS restricted, and the user's role is in the allowed list.
        OR EXISTS (
            SELECT 1 FROM public.task_context_links tcl_role
            WHERE tcl_role.source_id = p_task_id
              AND tcl_role.entity_type = 'role'
              AND tcl_role.entity_id = e.role_id
              AND tcl_role.is_active = true
        )
      )
  );
$$;
```

---

## 4. Deploying the Policies

These policies replace any existing "Simple" policies on the `tasks` table.

### 4.1: Visibility (SELECT)
Allows a user to see a task if they are an Admin, the direct Assignee, or pass the "Three-Key" Junction check.

```sql
DROP POLICY IF EXISTS "Permit SELECT based on hybrid junction" ON public.tasks;
CREATE POLICY "Permit SELECT based on hybrid junction" ON public.tasks
FOR SELECT USING (
    -- Level 1: Admin/Editor override
    public.get_user_permission_level(vertical_id) IN ('editor','admin')
    
    -- Level 2: Personal Ownership
    OR auth.uid() = assigned_to
    OR EXISTS (
        SELECT 1 FROM public.task_context_links tcl
        JOIN public.user_profiles up ON up.employee_id = tcl.entity_id
        WHERE tcl.source_id = tasks.id
          AND tcl.entity_type = 'assignee'
          AND tcl.is_active = true
          AND up.id = auth.uid()
    )

    -- Level 3: The Multi-Hub Junction
    OR public.check_task_junction(id)
);
```

---

## 5. Security Validation Matrix (Manual Tests)

| User Role | Hub | Task Hub Links | Task Role Links | Expected Result |
| :--- | :--- | :--- | :--- | :--- |
| Ground Staff | Hub A | Hub A | [None] | **VISIBLE** |
| Ground Staff | Hub B | Hub A | [None] | **HIDDEN** (Wrong Hub) |
| Ground Staff | Hub A | Hub A | Manager | **HIDDEN** (Wrong Role) |
| Manager | Hub A | Hub A | Manager | **VISIBLE** |
| Manager | Hub A | Hub A | [None] | **VISIBLE** (Public to Hub) |

---

## 6. Performance Impact & Troubleshooting
- **Latency**: If boards take >2 seconds to load, you **MUST** apply the indexes in [Runbook 4.2](./07_INDEXES.md).
- **Missing Tasks**:
  - Check if `employees.status` is 'Active'.
  - Check if `task_context_links.is_active` is true.
  - Verify `entity_type` strings are exact matches ('hub', 'role', 'assignee').

---

## Next Step → [Runbook 4.2: Mission-Critical Indexes](./07_INDEXES.md)
