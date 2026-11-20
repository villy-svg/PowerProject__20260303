-- =========================================================================
-- POWERPROJECT: Phase 1 — Read-Only Orphan Org Hygiene Audit
--
-- Safe to run directly in Supabase SQL Editor (Staging or Production).
-- Performs SELECT queries ONLY — makes ZERO modifications to any data.
--
-- Purpose:
--   Surface broken reporting hierarchies BEFORE Phases 2-4 launch automated
--   Week-Off escalations and Unmarked Attendance Maker-Checker tasks.
-- =========================================================================

-- -------------------------------------------------------------------------
-- AUDIT 1: Orphan Employees (No valid active reporting manager)
-- Share this list with Ops/HR to fix manager_id in Employee Management.
-- -------------------------------------------------------------------------
SELECT
  e.emp_code,
  e.full_name                        AS employee_name,
  h.name                             AS hub_name,
  e.manager_id,
  m.emp_code                         AS manager_emp_code,
  m.full_name                        AS manager_name,
  m.status                           AS manager_emp_status,
  mup.is_active                      AS manager_account_active,
  CASE
    WHEN e.manager_id IS NULL THEN 'MISSING_MANAGER_ID'
    WHEN m.id IS NULL THEN 'BROKEN_MANAGER_FK'
    WHEN m.status IS DISTINCT FROM 'Active' THEN 'INACTIVE_MANAGER_EMPLOYEE'
    WHEN mup.id IS NULL THEN 'MANAGER_HAS_NO_LOGIN_ACCOUNT'
    WHEN mup.is_active IS DISTINCT FROM true THEN 'MANAGER_ACCOUNT_DEACTIVATED'
    ELSE 'OK'
  END                                AS issue_type
FROM public.employees e
LEFT JOIN public.hubs h           ON h.id = e.hub_id
LEFT JOIN public.employees m      ON m.id = e.manager_id
LEFT JOIN public.user_profiles mup ON mup.employee_id = m.id
WHERE e.status = 'Active'
  AND (
    e.manager_id IS NULL
    OR m.id IS NULL
    OR m.status IS DISTINCT FROM 'Active'
    OR mup.id IS NULL
    OR mup.is_active IS DISTINCT FROM true
  )
ORDER BY h.name NULLS LAST, issue_type, e.full_name;

-- -------------------------------------------------------------------------
-- AUDIT 2: Orphan Reporting Managers (No active Editor+ above them)
-- Any active manager who manages >= 1 active employee, but has NO active
-- Editor/Admin on the Employees vertical anywhere up their manager_id chain.
-- -------------------------------------------------------------------------
WITH RECURSIVE active_managers AS (
  SELECT DISTINCT m.id, m.emp_code, m.full_name, m.hub_id, m.manager_id
  FROM public.employees e
  JOIN public.employees m ON m.id = e.manager_id
  WHERE e.status = 'Active'
    AND m.status = 'Active'
),
upward_chain AS (
  -- Start walking UP from each manager's own manager_id (depth 1)
  SELECT
    am.id                              AS root_manager_id,
    am.manager_id                      AS ancestor_id,
    1                                  AS depth,
    ARRAY[am.id, am.manager_id]        AS visited_ids
  FROM active_managers am
  WHERE am.manager_id IS NOT NULL

  UNION ALL

  SELECT
    uc.root_manager_id,
    e.manager_id                       AS ancestor_id,
    uc.depth + 1                       AS depth,
    uc.visited_ids || e.manager_id     AS visited_ids
  FROM upward_chain uc
  JOIN public.employees e ON e.id = uc.ancestor_id
  WHERE e.status = 'Active'
    AND e.manager_id IS NOT NULL
    AND uc.depth < 10
    AND NOT (e.manager_id = ANY(uc.visited_ids))
),
editor_ancestors AS (
  SELECT DISTINCT uc.root_manager_id
  FROM upward_chain uc
  JOIN public.employees ae     ON ae.id = uc.ancestor_id AND ae.status = 'Active'
  JOIN public.user_profiles up ON up.employee_id = ae.id AND up.is_active = true
  LEFT JOIN public.vertical_access va
    ON va.user_id = up.id
   AND LOWER(va.vertical_id) = 'employees'
  WHERE up.role_id IN ('master_admin', 'master_editor')
     OR va.access_level IN ('editor', 'admin')
)
SELECT
  am.emp_code                        AS manager_emp_code,
  am.full_name                       AS manager_name,
  h.name                             AS hub_name,
  (SELECT COUNT(*) FROM public.employees rep WHERE rep.manager_id = am.id AND rep.status = 'Active') AS direct_reports_count,
  am.manager_id                      AS reports_to_id
FROM active_managers am
LEFT JOIN public.hubs h ON h.id = am.hub_id
LEFT JOIN editor_ancestors ea ON ea.root_manager_id = am.id
WHERE ea.root_manager_id IS NULL
ORDER BY direct_reports_count DESC, h.name NULLS LAST, am.full_name;

-- -------------------------------------------------------------------------
-- AUDIT 3: Manager Hierarchy Cycles (A -> A or A -> B -> A)
-- Must return 0 rows for clean upward hierarchy traversal in Phase 2+.
-- -------------------------------------------------------------------------
WITH RECURSIVE cycle_check AS (
  SELECT
    e.id                               AS start_id,
    e.emp_code                         AS start_emp_code,
    e.full_name                        AS start_name,
    e.manager_id                       AS next_id,
    ARRAY[e.id]                        AS path,
    (e.manager_id = e.id)              AS is_cycle,
    1                                  AS depth
  FROM public.employees e
  WHERE e.status = 'Active'
    AND e.manager_id IS NOT NULL

  UNION ALL

  SELECT
    cc.start_id,
    cc.start_emp_code,
    cc.start_name,
    e.manager_id                       AS next_id,
    cc.path || cc.next_id              AS path,
    (e.manager_id = ANY(cc.path || cc.next_id)) AS is_cycle,
    cc.depth + 1                       AS depth
  FROM cycle_check cc
  JOIN public.employees e ON e.id = cc.next_id
  WHERE NOT cc.is_cycle
    AND e.manager_id IS NOT NULL
    AND cc.depth < 10
)
SELECT DISTINCT start_emp_code, start_name, depth AS cycle_length
FROM cycle_check
WHERE is_cycle = true
ORDER BY start_name;

-- -------------------------------------------------------------------------
-- AUDIT 4: Master Admin Fallback & vertical_access Casing Sanity Check
-- -------------------------------------------------------------------------
SELECT
  up.id                              AS user_profile_id,
  up.email,
  up.role_id,
  up.is_active,
  up.employee_id,
  e.emp_code,
  e.full_name,
  e.status                           AS employee_status
FROM public.user_profiles up
LEFT JOIN public.employees e ON e.id = up.employee_id
WHERE up.role_id = 'master_admin'
ORDER BY up.is_active DESC, up.created_at ASC;

-- Verify exact vertical_id casing stored in vertical_access (for Phase 2 RPCs)
SELECT DISTINCT vertical_id, access_level, COUNT(*) AS user_count
FROM public.vertical_access
GROUP BY vertical_id, access_level
ORDER BY vertical_id, access_level;
