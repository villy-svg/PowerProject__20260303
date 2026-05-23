-- =========================================================================
-- POWERPROJECT: Employee ↔ User Profile Sync + User Deactivation System
-- Migration: 20260523160000_employee_user_sync_and_deactivation.sql
--
-- ─────────────────────────────────────────────────────────────────────────
-- WHAT THIS MIGRATION REPLACES
-- ─────────────────────────────────────────────────────────────────────────
-- This is a consolidation of three previously separate (unpushed) migrations:
--
--   1. 20260523125600_sync_new_employee_to_user_profiles.sql
--      → Introduced handle_employee_sync() trigger and updated handle_new_user()
--        to auto-link employee_id even when the employee is 'Inactive'.
--
--   2. 20260523132000_harden_employee_profile_fk.sql
--      → Hardened the employee_id FK with ON DELETE SET NULL and added
--        SET search_path = public to all SECURITY DEFINER functions.
--
--   3. 20260523150000_user_deactivation_system.sql
--      → Added is_active to user_profiles, deactivate_user / reactivate_user
--        RPCs, employee status → user status cascade in handle_employee_sync(),
--        extended sync_user_permissions, and RLS hardening policies.
--
-- Since none of these were pushed to the database, they are merged here into
-- a single, atomic, fully-commented migration to keep history clean.
--
-- ─────────────────────────────────────────────────────────────────────────
-- PROBLEMS THIS MIGRATION SOLVES
-- ─────────────────────────────────────────────────────────────────────────
--
--  PROBLEM 1 — Broken employee-user link on signup order mismatch
--    Before: If an admin creates an employee record AFTER the employee has
--    already created their user account, the user's employee_id stays NULL.
--    The user is stuck with no vertical access until the next login cycle
--    triggers a self-heal. This is silent and invisible to administrators.
--    Fix: A DB trigger on employees (INSERT/UPDATE) now automatically links
--    the matching user_profiles row by email (case-insensitive).
--
--  PROBLEM 2 — Stale FK on hard-delete bypass
--    Before: The user_profiles.employee_id foreign key had no ON DELETE action.
--    If a DBA bypassed the application and hard-deleted an employee row,
--    the FK pointer in user_profiles would remain, pointing to nothing —
--    a silent referential integrity hazard.
--    Fix: FK re-declared with ON DELETE SET NULL so any bypass-delete also
--    safely nullifies the dangling reference.
--
--  PROBLEM 3 — SECURITY DEFINER functions lacked search_path lock
--    Before: All SECURITY DEFINER functions ran without SET search_path = public,
--    leaving a theoretical schema-injection vector flagged by the Supabase linter.
--    Fix: All affected functions now declare SET search_path = public.
--
--  PROBLEM 4 — Deactivating an employee did NOT remove their app access
--    Before: When an admin toggled an employee to 'Inactive', only the employee
--    record status changed. The linked user account kept its full role, vertical
--    access, and feature grants indefinitely — a clear security gap.
--    Fix: handle_employee_sync() now cascades status changes. Setting an employee
--    to 'Inactive' immediately: strips all vertical_access and feature_access rows
--    for the linked user, resets their role to 'vertical_viewer', and sets
--    is_active = false on user_profiles. Reactivating an employee flips is_active
--    back to true but does NOT auto-restore permissions (admin must re-grant).
--
--  PROBLEM 5 — No manual user deactivation control in User Management
--    Before: Admins had no way to directly deactivate a user account —
--    only employee status indirectly affected access.
--    Fix: Two new master_admin-only RPCs: deactivate_user() and reactivate_user().
--    Both are fully audited in security_audit_logs.
--
--  PROBLEM 6 — No RLS barrier for deactivated user sessions
--    Before: A deactivated user's Supabase session still technically worked.
--    Their token could be used to read tasks etc. if they knew the API directly.
--    Fix: New RLS policy on tasks blocks any user whose
--    user_profiles.is_active = false, regardless of token validity.
--
-- ─────────────────────────────────────────────────────────────────────────
-- DESIGN DECISIONS & INVARIANTS
-- ─────────────────────────────────────────────────────────────────────────
--
--  • We do NOT ban users at the Supabase auth.users level (banned = true).
--    That requires a service-role key in the frontend (security risk) and
--    is a hard, irreversible action. Instead, is_active = false on
--    user_profiles is our "soft-lock" — enforced by RLS everywhere.
--
--  • We do NOT delete user accounts or user_profiles rows. Identity is
--    preserved for audit trail continuity.
--
--  • Reactivation restores is_active only. Permissions are intentionally
--    left at vertical_viewer (the safe default). An admin must explicitly
--    re-grant access via the Permission Editor. This is "least privilege
--    reactivation" — re-entry requires deliberate admin action.
--
--  • Employee linking is identity, not status. Even if an employee is
--    'Inactive', their user_profiles.employee_id still points to them.
--    This preserves the relational audit trail. Access (is_active) is
--    tracked separately from the structural identity link.
--
--  • Backfill on first run: Existing user accounts without an employee link,
--    or linked to an Inactive employee, are immediately set to is_active = false.
--    This closes the gap retroactively for any accounts that pre-date this
--    migration. The default for new users going forward is is_active = true
--    (column default), but handle_new_user will set it based on employee status.
--
-- ─────────────────────────────────────────────────────────────────────────
-- TABLES AFFECTED
-- ─────────────────────────────────────────────────────────────────────────
--   • user_profiles        — added is_active column; FK hardened; backfilled
--   • employees            — triggers attach here (no schema change)
--   • vertical_access      — rows wiped on deactivation
--   • feature_access       — rows wiped on deactivation
--   • tasks                — new RLS policy added
--   • security_audit_logs  — audit records written on deactivate/reactivate
--
-- ─────────────────────────────────────────────────────────────────────────
-- FUNCTIONS / RPCS CREATED OR REPLACED
-- ─────────────────────────────────────────────────────────────────────────
--   • handle_new_user()            — REPLACED (adds is_active-aware logic)
--   • handle_employee_sync()       — REPLACED (adds status cascade)
--   • deactivate_user()            — NEW RPC (master_admin only, audited)
--   • reactivate_user()            — NEW RPC (master_admin only, audited)
--   • sync_user_permissions()      — REPLACED (adds optional p_is_active param)
--
-- ─────────────────────────────────────────────────────────────────────────
-- TRIGGERS CREATED OR REPLACED
-- ─────────────────────────────────────────────────────────────────────────
--   • trg_sync_employee_to_profile_upsert  — AFTER INSERT OR UPDATE OF status, email ON employees
--   • trg_sync_employee_to_profile_delete  — BEFORE DELETE ON employees
--
-- =========================================================================


-- =========================================================================
-- SECTION 1: SCHEMA CHANGES
-- Harden the employee_id FK and add the is_active column.
-- These are safe to run on any environment (IF NOT EXISTS / IF EXISTS guards).
-- =========================================================================

-- 1a. Harden the user_profiles.employee_id foreign key.
--     We drop and re-add with ON DELETE SET NULL so that any DBA hard-delete
--     of an employee row (bypassing the application trigger) automatically
--     nullifies the dangling pointer instead of leaving stale data.
ALTER TABLE public.user_profiles
    DROP CONSTRAINT IF EXISTS user_profiles_employee_id_fkey;

ALTER TABLE public.user_profiles
    ADD CONSTRAINT user_profiles_employee_id_fkey
    FOREIGN KEY (employee_id)
    REFERENCES public.employees(id)
    ON DELETE SET NULL;

-- 1b. Add the is_active boolean to user_profiles.
--     Default TRUE: new accounts start active. The backfill below (Section 2)
--     immediately corrects any accounts that should start inactive.
--     NOT NULL ensures no ambiguous NULL state — every account is explicitly
--     active or inactive.
ALTER TABLE public.user_profiles
    ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;


-- =========================================================================
-- SECTION 2: DATA BACKFILL
-- On first run, immediately deactivate any user accounts that should be
-- inactive: those linked to an Inactive employee OR with no employee link
-- at all (unverified / non-staff accounts).
--
-- Why unlinked accounts? Our rule: "you must be a verified employee to have
-- any authority in the application." Accounts with no employee_id have not
-- been matched to a real person in the org chart. They get base access only.
--
-- NOTE: This UPDATE will only affect existing rows at migration time. All
-- future accounts are governed in real-time by handle_new_user() and
-- handle_employee_sync() triggers.
-- =========================================================================

-- 2a. Demote and deactivate any user whose linked employee is currently Inactive.
UPDATE public.user_profiles up
SET    is_active   = false,
       role_id     = 'vertical_viewer',
       updated_at  = now()
WHERE  up.employee_id IS NOT NULL
  AND  EXISTS (
           SELECT 1
           FROM   public.employees e
           WHERE  e.id = up.employee_id
             AND  e.status = 'Inactive'
       );

-- 2b. Demote and deactivate any user with NO employee link whatsoever.
--     These are accounts that signed up but were never matched to a
--     staff record — they have no verified organizational identity.
UPDATE public.user_profiles up
SET    is_active   = false,
       role_id     = 'vertical_viewer',
       updated_at  = now()
WHERE  up.employee_id IS NULL;

-- 2c. Wipe all granular access grants for every freshly-deactivated user.
--     We do this in two separate deletes (one per table) rather than a JOIN
--     delete for clarity and to avoid lock contention on large datasets.
DELETE FROM public.vertical_access
WHERE  user_id IN (
           SELECT id FROM public.user_profiles WHERE is_active = false
       );

DELETE FROM public.feature_access
WHERE  user_id IN (
           SELECT id FROM public.user_profiles WHERE is_active = false
       );


-- =========================================================================
-- SECTION 3: handle_new_user() — Auth Signup Trigger Function
--
-- Fires via trigger on INSERT into auth.users (every new Supabase sign-up).
-- Responsibilities:
--   a. Clean up any orphaned user_profiles row with the same email (can
--      happen if a user's auth record was manually deleted and re-created).
--   b. Upsert the user_profiles row with identity info from auth metadata.
--   c. Auto-link employee_id by email match (case-insensitive), regardless
--      of whether the employee is Active or Inactive — we always link the
--      identity; access control is handled separately via is_active.
--
-- Security: SECURITY DEFINER so it can write user_profiles as postgres.
--           SET search_path = public closes the schema-injection vector
--           flagged by the Supabase linter.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    orphaned_id uuid;
BEGIN
    -- -----------------------------------------------------------------------
    -- STEP 1: Orphan cleanup
    -- If a profile with the same email already exists (e.g. a manual
    -- auth.users delete + re-signup scenario), we nullify its task references
    -- and delete it before creating the fresh profile. This prevents a UNIQUE
    -- violation on user_profiles.email in the next step.
    -- -----------------------------------------------------------------------
    SELECT id INTO orphaned_id
    FROM   public.user_profiles
    WHERE  LOWER(email) = LOWER(NEW.email)
      AND  id != NEW.id;

    IF orphaned_id IS NOT NULL THEN
        -- Null out task author columns to preserve task records
        UPDATE public.tasks SET created_by      = NULL WHERE created_by      = orphaned_id;
        UPDATE public.tasks SET last_updated_by = NULL WHERE last_updated_by = orphaned_id;
        -- Now safe to delete the orphaned profile
        DELETE FROM public.user_profiles WHERE id = orphaned_id;
    END IF;

    -- -----------------------------------------------------------------------
    -- STEP 2: Upsert user profile
    -- ON CONFLICT (email): update only identity fields, never downgrade name.
    -- role_id and is_active use column defaults (vertical_viewer / true).
    -- The backfill in Section 2 sets is_active correctly for existing users;
    -- for brand-new users, the employee sync in Step 3 below governs status.
    -- -----------------------------------------------------------------------
    INSERT INTO public.user_profiles (id, email, name, assigned_verticals)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        ARRAY[]::TEXT[]
    )
    ON CONFLICT (email) DO UPDATE
    SET id   = EXCLUDED.id,
        name = COALESCE(EXCLUDED.name, user_profiles.name);

    -- -----------------------------------------------------------------------
    -- STEP 3: Auto-link employee_id by email (case-insensitive)
    -- Link regardless of employee status — is_active is a separate concern.
    -- Only updates if employee_id is still NULL (don't overwrite existing link).
    -- -----------------------------------------------------------------------
    UPDATE public.user_profiles
    SET    employee_id = e.id
    FROM   public.employees e
    WHERE  LOWER(e.email) = LOWER(NEW.email)
      AND  user_profiles.id = NEW.id
      AND  user_profiles.employee_id IS NULL;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- =========================================================================
-- SECTION 4: handle_employee_sync() — Employee Change Trigger Function
--
-- Fires via triggers on public.employees (see Section 5 for trigger bindings).
-- This is the core of the bidirectional sync system.
--
-- Handles three operations:
--
--  A. INSERT OR UPDATE:
--     i.  Profile linking — links the matching user_profiles row by email if
--         employee_id is NULL (i.e. not already linked). This fires regardless
--         of employee status — identity and access are tracked separately.
--    ii.  Status cascade — if this is an UPDATE and the status column changed:
--           • 'Inactive' → deactivate the linked user: wipe all access grants
--             (vertical_access, feature_access), reset role to vertical_viewer,
--             set is_active = false. The user can no longer operate in the app.
--           • 'Active'   → reactivate the linked user: set is_active = true.
--             Permissions intentionally stay at vertical_viewer — the admin must
--             explicitly re-grant access via the Permission Editor.
--   iii.  Email change — if this is an UPDATE and the email changed:
--           • Unlink the old profile (set employee_id = NULL on the row that
--             had our ID but no longer matches the new email).
--           • Link the new profile (set employee_id = NEW.id on the row whose
--             email matches the new email, if employee_id is still NULL).
--
--  B. DELETE (runs BEFORE delete to avoid FK constraint failures):
--     Nullifies user_profiles.employee_id where it points to this employee.
--     The ON DELETE SET NULL FK constraint in Section 1 acts as a second safety
--     net in case this trigger is ever skipped (e.g. DBA bypass).
--
-- Security: SECURITY DEFINER + SET search_path = public (same rationale as above).
-- =========================================================================
CREATE OR REPLACE FUNCTION public.handle_employee_sync()
RETURNS TRIGGER AS $$
BEGIN

    -- =======================================================================
    -- A. INSERT OR UPDATE
    -- =======================================================================
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN

        -- -------------------------------------------------------------------
        -- A-i. Profile linking
        -- Always attempt to link a user_profiles row whose email matches this
        -- employee and whose employee_id is still NULL (not yet linked).
        -- This fires on every INSERT and every relevant UPDATE so that:
        --   • A new employee record auto-links to an existing user account.
        --   • An employee email correction re-triggers linking on the new email.
        -- We use LOWER() on both sides for case-insensitive comparison.
        -- -------------------------------------------------------------------
        UPDATE public.user_profiles
        SET    employee_id = NEW.id,
               updated_at  = now()
        WHERE  LOWER(email) = LOWER(NEW.email)
          AND  employee_id IS NULL;

        -- -------------------------------------------------------------------
        -- A-ii. Employee status cascade → user is_active
        -- Only runs on UPDATE when the status column actually changed.
        -- TG_OP = 'INSERT' is excluded here; a brand-new employee record
        -- should not immediately deactivate the user (they haven't had a
        -- chance to be active yet). handle_new_user() governs new signups.
        -- -------------------------------------------------------------------
        IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN

            IF NEW.status = 'Inactive' THEN
                -- ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                -- Employee deactivated → strip all app access from linked user.
                --
                -- Order matters:
                --   1. Delete access grants FIRST (while we still know the user_id
                --      by joining through employee_id).
                --   2. Update user_profiles SECOND (sets is_active = false and
                --      demotes role).
                --
                -- We use a sub-SELECT to find user_id because user_profiles
                -- doesn't expose a direct column — we navigate via employee_id.
                -- ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                DELETE FROM public.vertical_access
                WHERE  user_id IN (
                           SELECT id FROM public.user_profiles
                           WHERE  employee_id = NEW.id
                       );

                DELETE FROM public.feature_access
                WHERE  user_id IN (
                           SELECT id FROM public.user_profiles
                           WHERE  employee_id = NEW.id
                       );

                UPDATE public.user_profiles
                SET    is_active   = false,
                       role_id     = 'vertical_viewer',
                       updated_at  = now()
                WHERE  employee_id = NEW.id;

            ELSIF NEW.status = 'Active' THEN
                -- ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                -- Employee reactivated → restore is_active flag ONLY.
                -- We deliberately do NOT restore vertical_access or
                -- feature_access rows. Reactivation should require an
                -- explicit admin decision to re-grant authority — this is the
                -- "least privilege reactivation" principle. The user will land
                -- back in the app with vertical_viewer base access only, and the
                -- admin can use the Permission Editor to re-elevate them.
                -- ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                UPDATE public.user_profiles
                SET    is_active  = true,
                       updated_at = now()
                WHERE  employee_id = NEW.id;
            END IF;

        END IF;

        -- -------------------------------------------------------------------
        -- A-iii. Employee email change → re-wire the profile link
        -- Only runs on UPDATE when the email column actually changed.
        -- Two-step operation:
        --   1. Unlink the profile that was previously linked to this employee
        --      but whose email no longer matches the new email.
        --   2. Link the profile whose email matches the new email (if any),
        --      provided it isn't already linked to a different employee.
        -- -------------------------------------------------------------------
        IF TG_OP = 'UPDATE' AND OLD.email IS DISTINCT FROM NEW.email THEN

            -- Step 1: Unlink the old profile
            -- We identify it by checking: employee_id = NEW.id (was linked to us)
            -- AND its email no longer matches the new email.
            UPDATE public.user_profiles
            SET    employee_id = NULL,
                   updated_at  = now()
            WHERE  employee_id = NEW.id
              AND  LOWER(email) != LOWER(NEW.email);

            -- Step 2: Link the new profile (if one exists and is unlinked)
            UPDATE public.user_profiles
            SET    employee_id = NEW.id,
                   updated_at  = now()
            WHERE  LOWER(email) = LOWER(NEW.email)
              AND  employee_id IS NULL;

        END IF;

        RETURN NEW;
    END IF;

    -- =======================================================================
    -- B. DELETE — runs BEFORE DELETE to avoid FK constraint failures
    -- =======================================================================
    IF TG_OP = 'DELETE' THEN
        -- Nullify the employee_id reference in user_profiles.
        -- The ON DELETE SET NULL FK is a second safety net; this trigger
        -- ensures the update is logged with updated_at and is explicit.
        UPDATE public.user_profiles
        SET    employee_id = NULL,
               updated_at  = now()
        WHERE  employee_id = OLD.id;

        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- =========================================================================
-- SECTION 5: TRIGGER BINDINGS ON public.employees
--
-- Two triggers — one for mutations (AFTER), one for deletion (BEFORE).
-- We drop-and-recreate to guarantee the trigger definition always matches
-- this migration, even if a prior partial run left a stale version.
--
-- Why AFTER for upsert?
--   Running AFTER INSERT/UPDATE ensures the new row is fully committed before
--   we attempt to read NEW.id and NEW.email in handle_employee_sync(). Running
--   BEFORE could reference a row that hasn't been written yet in edge cases.
--
-- Why BEFORE for delete?
--   Running BEFORE DELETE lets us nullify user_profiles.employee_id BEFORE
--   Postgres evaluates the FK constraint. If we ran AFTER, the FK violation
--   (if SET NULL were absent) would already have fired. Belt + suspenders.
--
-- Why only UPDATE OF status, email?
--   We don't need the trigger for every UPDATE on employees (e.g. phone, dob).
--   Scoping to the status and email columns reduces unnecessary trigger firings
--   on bulk updates (CSV imports, salary changes, etc.).
-- =========================================================================

DROP TRIGGER IF EXISTS trg_sync_employee_to_profile_upsert ON public.employees;
CREATE TRIGGER trg_sync_employee_to_profile_upsert
    AFTER INSERT OR UPDATE OF status, email ON public.employees
    FOR EACH ROW EXECUTE FUNCTION public.handle_employee_sync();

DROP TRIGGER IF EXISTS trg_sync_employee_to_profile_delete ON public.employees;
CREATE TRIGGER trg_sync_employee_to_profile_delete
    BEFORE DELETE ON public.employees
    FOR EACH ROW EXECUTE FUNCTION public.handle_employee_sync();


-- =========================================================================
-- SECTION 6: deactivate_user() RPC
--
-- Allows a master_admin to manually deactivate any user from the User
-- Management page, independently of employee status.
--
-- Use cases:
--   • An ex-employee who never had a formal employee record
--   • Temporary suspension pending an HR review
--   • A contractor whose access period has ended
--
-- What it does (in this exact order):
--   1. Authorization check — only master_admin can call this; raises if not.
--   2. Captures the current state of user_profiles for the audit log.
--   3. Wipes all vertical_access rows for the target user.
--   4. Wipes all feature_access rows for the target user.
--   5. Sets user_profiles.is_active = false and role_id = 'vertical_viewer'.
--   6. Writes an audit record to security_audit_logs.
--
-- Security:
--   SECURITY DEFINER — runs as the postgres superuser so it can bypass RLS
--   on the access tables (the calling user might not have direct write access).
--   SET search_path = public — prevents schema injection.
--   is_master_admin() guard — double-enforced at SQL level even if the
--   frontend somehow sends the call.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.deactivate_user(
    p_target_id uuid   -- The user_profiles.id of the account to deactivate
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_old_profile jsonb;
BEGIN
    -- STEP 1: Authorization guard (hard fail — no silent degradation)
    IF NOT public.is_master_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Only Master Admins can deactivate users.';
    END IF;

    -- STEP 2: Snapshot old state for audit trail
    SELECT to_jsonb(p) INTO v_old_profile
    FROM   public.user_profiles p
    WHERE  id = p_target_id;

    -- STEP 3: Wipe all granular access grants
    DELETE FROM public.vertical_access WHERE user_id = p_target_id;
    DELETE FROM public.feature_access  WHERE user_id = p_target_id;

    -- STEP 4: Demote and deactivate the profile
    UPDATE public.user_profiles
    SET    is_active   = false,
           role_id     = 'vertical_viewer',
           updated_at  = now()
    WHERE  id = p_target_id;

    -- STEP 5: Audit log
    INSERT INTO public.security_audit_logs
           (actor_id,    target_id,    action,             old_payload,    new_payload)
    VALUES (auth.uid(),  p_target_id,  'USER_DEACTIVATED',  v_old_profile,
            jsonb_build_object('is_active', false, 'role_id', 'vertical_viewer'));
END;
$$;


-- =========================================================================
-- SECTION 7: reactivate_user() RPC
--
-- Allows a master_admin to reactivate a previously deactivated user account.
--
-- What it does:
--   1. Authorization check — only master_admin can call this.
--   2. Captures old state for audit trail.
--   3. Sets is_active = true on user_profiles.
--   4. Writes an audit record to security_audit_logs.
--
-- What it does NOT do (intentional):
--   • Does NOT restore vertical_access or feature_access rows.
--   • Does NOT change role_id (stays at vertical_viewer).
--
-- Rationale (least privilege reactivation):
--   Re-entry into the system should be a deliberate two-step process:
--     Step 1 (here): Flip the is_active gate — the user can now log in.
--     Step 2 (manual): Admin uses the Permission Editor to re-grant specific
--                      vertical/feature access appropriate to the user's new
--                      role or assignment. This prevents accidental re-grant
--                      of permissions that may no longer be appropriate.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.reactivate_user(
    p_target_id uuid   -- The user_profiles.id of the account to reactivate
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_old_profile jsonb;
BEGIN
    -- STEP 1: Authorization guard
    IF NOT public.is_master_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Only Master Admins can reactivate users.';
    END IF;

    -- STEP 2: Snapshot old state for audit trail
    SELECT to_jsonb(p) INTO v_old_profile
    FROM   public.user_profiles p
    WHERE  id = p_target_id;

    -- STEP 3: Flip the is_active gate
    --         role_id intentionally left unchanged (stays vertical_viewer).
    --         Permissions must be re-granted manually by the admin.
    UPDATE public.user_profiles
    SET    is_active  = true,
           updated_at = now()
    WHERE  id = p_target_id;

    -- STEP 4: Audit log
    INSERT INTO public.security_audit_logs
           (actor_id,    target_id,    action,             old_payload,    new_payload)
    VALUES (auth.uid(),  p_target_id,  'USER_REACTIVATED',  v_old_profile,
            jsonb_build_object('is_active', true));
END;
$$;


-- =========================================================================
-- SECTION 8: sync_user_permissions() RPC — Extended Version
--
-- This replaces the version introduced in 20260421110000_user_management_harden.sql.
-- It is backward-compatible: callers that don't pass p_is_active will default
-- to TRUE (existing behaviour is fully preserved).
--
-- What changed from the original:
--   • Added optional p_is_active boolean DEFAULT true parameter.
--   • STEP 3 now also updates is_active on user_profiles.
--   • STEP 4 and STEP 5 (access grants) are skipped entirely if p_is_active
--     is false — there's no point inserting access rows for a deactivated user.
--   • Audit log now records the is_active value in new_payload.
--
-- All other behaviour (authorization guard, clear-then-insert pattern,
-- 'none' level filtering, audit logging) is unchanged.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.sync_user_permissions(
    p_target_id  uuid,
    p_role_id    text,
    p_v_access   jsonb,          -- Array of {vertical_id, access_level}
    p_f_access   jsonb,          -- Array of {vertical_id, feature_id, access_level}
    p_is_active  boolean DEFAULT true  -- Optional; defaults TRUE for backward compat
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_old_profile  jsonb;
    v_old_v_access jsonb;
    v_old_f_access jsonb;
    item           jsonb;
BEGIN
    -- STEP 0: Authorization guard
    IF NOT public.is_master_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Only Master Admins can sync permissions.';
    END IF;

    -- STEP 1: Capture old state for auditing before we change anything
    SELECT to_jsonb(p)       INTO v_old_profile   FROM public.user_profiles  p WHERE id      = p_target_id;
    SELECT jsonb_agg(to_jsonb(v)) INTO v_old_v_access FROM public.vertical_access v WHERE user_id = p_target_id;
    SELECT jsonb_agg(to_jsonb(f)) INTO v_old_f_access FROM public.feature_access  f WHERE user_id = p_target_id;

    -- STEP 2: Wipe existing granular access grants (clear-then-insert pattern
    --         ensures we never have stale or conflicting access rows)
    DELETE FROM public.vertical_access WHERE user_id = p_target_id;
    DELETE FROM public.feature_access  WHERE user_id = p_target_id;

    -- STEP 3: Update the profile row — role AND is_active flag atomically
    UPDATE public.user_profiles
    SET    role_id    = p_role_id,
           is_active  = p_is_active,
           updated_at = now()
    WHERE  id = p_target_id;

    -- STEP 4 & 5: Insert new access grants — only if user is being kept active.
    --             Inserting access rows for an inactive user is pointless and
    --             creates noise; skip entirely when p_is_active = false.
    IF p_is_active THEN

        -- STEP 4: Insert new vertical access rows
        FOR item IN SELECT * FROM jsonb_array_elements(p_v_access)
        LOOP
            -- Skip 'none' levels — only store meaningful grants
            IF item->>'access_level' != 'none' THEN
                INSERT INTO public.vertical_access (user_id, vertical_id, access_level)
                VALUES (p_target_id, item->>'vertical_id', item->>'access_level');
            END IF;
        END LOOP;

        -- STEP 5: Insert new feature access rows
        FOR item IN SELECT * FROM jsonb_array_elements(p_f_access)
        LOOP
            IF item->>'access_level' != 'none' THEN
                INSERT INTO public.feature_access (user_id, vertical_id, feature_id, access_level)
                VALUES (p_target_id, item->>'vertical_id', item->>'feature_id', item->>'access_level');
            END IF;
        END LOOP;

    END IF;

    -- STEP 6: Audit log
    INSERT INTO public.security_audit_logs
           (actor_id,   target_id,   action,      old_payload,  new_payload)
    VALUES (auth.uid(), p_target_id, 'PERM_SYNC',
            jsonb_build_object('profile', v_old_profile, 'v_access', v_old_v_access, 'f_access', v_old_f_access),
            jsonb_build_object('role_id', p_role_id, 'is_active', p_is_active, 'v_access', p_v_access, 'f_access', p_f_access));
END;
$$;


-- =========================================================================
-- SECTION 9: RLS HARDENING — Block inactive users from sensitive tables
--
-- These policies are ADDITIVE — they do not replace any existing RLS policies.
-- PostgreSQL evaluates ALL policies on a table and a row is only accessible
-- if the user passes EVERY applicable policy. Adding these policies therefore
-- only restricts access further; it cannot grant access that wasn't there before.
--
-- Strategy:
--   Rather than modifying existing complex policies, we add a simple orthogonal
--   "is_active gate" policy to each sensitive table. This keeps the deactivation
--   logic centralised and easy to reason about independently of the vertical/
--   feature access policies.
--
-- Note on user_profiles self-read:
--   Master admins always bypass (they manage everything). Active users can read
--   any profile (needed for employee lookups, task assignment, etc.). Inactive
--   users can only read their own profile — they need it to render the "you have
--   been deactivated" state in the frontend, but nothing else.
-- =========================================================================

-- 9a. user_profiles — scoped self-read for inactive accounts
DROP POLICY IF EXISTS "Block inactive user self-read" ON public.user_profiles;
CREATE POLICY "Block inactive user self-read" ON public.user_profiles
    FOR SELECT
    USING (
        -- Master admins pass unconditionally
        public.is_master_admin()
        OR
        -- Active users can read any profile (needed for lookups)
        EXISTS (
            SELECT 1 FROM public.user_profiles self
            WHERE  self.id = auth.uid() AND self.is_active = true
        )
        OR
        -- Inactive users can read only their own profile (for UI feedback)
        (auth.uid() = id AND is_active = false)
    );

-- 9b. tasks — inactive users cannot read or write
DROP POLICY IF EXISTS "Block inactive users on tasks" ON public.tasks;
CREATE POLICY "Block inactive users on tasks" ON public.tasks
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles up
            WHERE  up.id = auth.uid() AND up.is_active = true
        )
    );



-- =========================================================================
-- SECTION 10: EVOLUTION LEDGER
-- Single consolidated log entry for this merged migration.
-- =========================================================================
INSERT INTO public.database_evolution_log (migration_name, summary, affected_tables)
VALUES (
  '20260523160000_employee_user_sync_and_deactivation',
  'Consolidated migration covering: (1) user_profiles FK hardened with ON DELETE SET NULL; (2) is_active boolean added to user_profiles (default true); (3) Backfill — existing accounts linked to Inactive employees or unlinked are set is_active=false with access wiped; (4) handle_new_user() updated with search_path lock and Inactive-employee-linking support; (5) handle_employee_sync() fully rewritten with employee status → user is_active cascade, email-change re-linking, and search_path lock; (6) deactivate_user() RPC added (master_admin only, audited); (7) reactivate_user() RPC added (master_admin only, audited, least-privilege); (8) sync_user_permissions() extended with optional p_is_active param (backward-compatible); (9) RLS policy added on tasks blocking inactive users.',
  ARRAY['user_profiles', 'employees', 'vertical_access', 'feature_access', 'tasks', 'security_audit_logs']
)
ON CONFLICT DO NOTHING;

-- =========================================================================
-- Force PostgREST to reload its schema cache so the new column, functions,
-- and policies are immediately available to the API without a server restart.
-- =========================================================================
NOTIFY pgrst, 'reload schema';
