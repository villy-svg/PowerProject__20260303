/**
 * schedulePlannerService.js
 *
 * Repository layer for the bulk Schedule Planner workflow.
 *
 * Lifecycle:
 *   Contributor/Editor (Maker) → saveDraft() / submitPlan()
 *   Editor (Checker)           → fetchPendingPlans() / approvePlan() / rejectPlan()
 *
 * Table naming: employee_schedule_plans + employee_schedule_plan_entries
 * (database-table-naming-convention: [vertical]_[feature]_[details])
 *
 * Skill compliance:
 *   development-best-practices §10 (Zero raw fetching in components)
 *   rbac-security-system §2        (Role enforcement via RLS; UI guards in components)
 *   safe-code-modification §1C     (Documentation for all logic blocks)
 *   database-migration-policy §5   (No direct schema changes — use migrations)
 */

import { supabase } from '../core/supabaseClient';

// Define which statuses should automatically be upserted to daily_attendances upon plan approval.
// This allows future extensibility (e.g., auto-upserting 'leave' or similar states).
const AUTO_UPSERT_STATUSES = ['week-off'];

// ---------------------------------------------------------------------------
// CONTRIBUTOR/EDITOR (MAKER): Save or update a draft plan
//
// Creates a new plan header + replaces all its entries atomically:
//   1. If planId is null → INSERT new plan + INSERT all entries.
//   2. If planId is provided → DELETE existing entries + UPDATE plan + INSERT new entries.
//      This covers the "re-edit a rejected/draft plan" case.
//
// The plan remains in 'draft' status. To submit, call submitPlan().
//
// @param {object} params
//   @param {string|null} params.planId      - Existing plan UUID (null for new)
//   @param {string}      params.dateFrom    - 'YYYY-MM-DD' (start of schedule window)
//   @param {string}      params.dateTo      - 'YYYY-MM-DD' (end of schedule window, max +14 days)
//   @param {Array}       params.employeeSelections - Array of { employeeId, dates: [] }
//   @param {string}      params.submittedBy - user_profiles UUID (auth.uid())
// @returns {Promise<{ data: object|null, error: object|null }>}
// ---------------------------------------------------------------------------
export async function saveDraft({ planId, dateFrom, dateTo, employeeSelections, submittedBy }) {
  // --- Validate the 15-day window client-side before hitting the DB ---
  const from  = new Date(dateFrom);
  const to    = new Date(dateTo);
  const dayDiff = Math.round((to - from) / (1000 * 60 * 60 * 24));
  if (dayDiff > 14) {
    return { data: null, error: new Error('schedule plan cannot exceed 15 days.') };
  }
  if (from > to) {
    return { data: null, error: new Error('Start date must be before end date.') };
  }

  // --- Build the list of (employeeId, shiftDate) entry tuples ---
  // Iterate over specific dates selected per employee
  const entries = [];
  for (const selection of employeeSelections) {
    if (!selection.dates || selection.dates.length === 0) continue;
    
    for (const d of selection.dates) {
      if (!d || !d.date) continue; // Skip empty dates
      // Safety check: ensure date is within the plan's overall window
      if (d.date >= dateFrom && d.date <= dateTo) {
        entries.push({ 
          employee_id: selection.employeeId, 
          shift_date: d.date,
          attendance_status: d.attendance_status || 'present',
          hub_id: d.hub_id || null
        });
      }
    }
  }

  // --- CASE 1: New plan — INSERT plan header then INSERT entries ---
  if (!planId) {
    const { data: newPlan, error: planError } = await supabase
      .from('employee_schedule_plans')
      .insert({
        submitted_by: submittedBy,
        plan_status:  'draft',
        date_from:    dateFrom,
        date_to:      dateTo,
      })
      .select('id, plan_status, date_from, date_to, created_at')
      .single();

    if (planError) {
      console.error('[schedulePlannerService] saveDraft INSERT plan error:', planError);
      return { data: null, error: planError };
    }

    // Insert all entries linked to the new plan
    const entryRows = entries.map(e => ({ ...e, plan_id: newPlan.id }));
    const { error: entriesError } = await supabase
      .from('employee_schedule_plan_entries')
      .insert(entryRows);

    if (entriesError) {
      console.error('[schedulePlannerService] saveDraft INSERT entries error:', entriesError);
      return { data: null, error: entriesError };
    }

    return { data: newPlan, error: null };
  }

  // --- CASE 2: Existing draft/rejected plan — replace entries + update header ---

  // Step A: Delete existing entries for this plan (re-building from scratch)
  const { error: deleteError } = await supabase
    .from('employee_schedule_plan_entries')
    .delete()
    .eq('plan_id', planId);

  if (deleteError) {
    console.error('[schedulePlannerService] saveDraft DELETE entries error:', deleteError);
    return { data: null, error: deleteError };
  }

  // Step B: Update the plan header with new dates + reset to draft
  const { data: updatedPlan, error: updateError } = await supabase
    .from('employee_schedule_plans')
    .update({
      date_from:   dateFrom,
      date_to:     dateTo,
      plan_status: 'draft',
      updated_at:  new Date().toISOString(),
    })
    .eq('id', planId)
    .select('id, plan_status, date_from, date_to, updated_at')
    .single();

  if (updateError) {
    console.error('[schedulePlannerService] saveDraft UPDATE plan error:', updateError);
    return { data: null, error: updateError };
  }

  // Step C: Insert fresh entries
  const entryRows = entries.map(e => ({ ...e, plan_id: planId }));
  const { error: insertError } = await supabase
    .from('employee_schedule_plan_entries')
    .insert(entryRows);

  if (insertError) {
    console.error('[schedulePlannerService] saveDraft INSERT entries (update path) error:', insertError);
    return { data: null, error: insertError };
  }

  return { data: updatedPlan, error: null };
}

// ---------------------------------------------------------------------------
// CONTRIBUTOR/EDITOR (MAKER): Submit a draft plan for approval
//
// Two-step operation:
//   1. Auto-cancel any other PENDING plan from the same submitter that
//      overlaps the same date range (prevents duplicate approval conflicts).
//   2. Update this plan's status to 'pending'.
//
// @param {object} params
//   @param {string} params.planId      - UUID of the plan to submit
//   @param {string} params.submittedBy - user_profiles UUID (auth.uid())
//   @param {string} params.dateFrom    - 'YYYY-MM-DD' (needed to find overlaps)
//   @param {string} params.dateTo      - 'YYYY-MM-DD'
// @returns {Promise<{ data: object|null, error: object|null }>}
// ---------------------------------------------------------------------------
export async function submitPlan({ planId, submittedBy, dateFrom, dateTo }) {
  // --- STEP 1: Cancel any overlapping pending plans from the same submitter ---
  // A plan overlaps if: its date_from <= our date_to AND its date_to >= our date_from
  const { error: cancelError } = await supabase
    .from('employee_schedule_plans')
    .update({
      plan_status: 'cancelled',
      updated_at:  new Date().toISOString(),
    })
    .eq('submitted_by', submittedBy)
    .eq('plan_status',  'pending')
    .neq('id', planId)
    .lte('date_from', dateTo)
    .gte('date_to',   dateFrom);

  if (cancelError) {
    console.error('[schedulePlannerService] submitPlan cancel overlapping plans error:', cancelError);
    return { data: null, error: cancelError };
  }

  // --- STEP 2: Set this plan to 'pending' ---
  const { data, error } = await supabase
    .from('employee_schedule_plans')
    .update({
      plan_status: 'pending',
      updated_at:  new Date().toISOString(),
    })
    .eq('id', planId)
    .eq('submitted_by', submittedBy) // Ownership guard
    .select('id, plan_status, updated_at')
    .single();

  if (error) {
    console.error('[schedulePlannerService] submitPlan update to pending error:', error);
    return { data: null, error };
  }

  return { data, error: null };
}

// ---------------------------------------------------------------------------
// CONTRIBUTOR/EDITOR: Fetch all plans belonging to the current user
//
// Returns draft, pending, approved, and rejected plans for the "My Plans"
// section in the planner modal. Includes entry count for summary display.
//
// @param {string} userId - user_profiles UUID of the submitter
// @returns {Promise<{ data: Array, error: object|null }>}
// ---------------------------------------------------------------------------
export async function fetchMyPlans(userId) {
  const { data, error } = await supabase
    .from('employee_schedule_plans')
    .select(`
      id,
      plan_status,
      date_from,
      date_to,
      review_note,
      created_at,
      updated_at,
      employee_schedule_plan_entries ( id, employee_id, shift_date, attendance_status, hub_id )
    `)
    .eq('submitted_by', userId)
    .in('plan_status', ['draft', 'pending', 'approved', 'rejected'])
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[schedulePlannerService] fetchMyPlans error:', error);
    return { data: null, error };
  }

  return { data: data || [], error: null };
}

// ---------------------------------------------------------------------------
// EDITOR (CHECKER): Fetch all pending bulk plans for the approval queue
//
// Returns plans with status='pending', joined with submitter info and entries.
//
// @returns {Promise<{ data: Array, error: object|null }>}
// ---------------------------------------------------------------------------
export async function fetchPendingPlans() {
  const { data, error } = await supabase
    .from('employee_schedule_plans')
    .select(`
      id,
      plan_status,
      date_from,
      date_to,
      created_at,
      submitter:submitted_by ( id, name, email ),
      employee_schedule_plan_entries (
        id,
        shift_date,
        attendance_status,
        hub_id,
        employees ( id, full_name, emp_code )
      )
    `)
    .eq('plan_status', 'pending')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[schedulePlannerService] fetchPendingPlans error:', error);
    return { data: null, error };
  }

  return { data: data || [], error: null };
}

// ---------------------------------------------------------------------------
// EDITOR (CHECKER): Approve a bulk schedule plan
//
// Three-step operation:
//   1. Mark the plan as 'approved'.
//   2. For each entry, upsert into daily_attendances as status='schedule'.
//      Uses ON CONFLICT on (employee_id, shift_date) to safely update
//      existing records or create new ones.
//
// NOTE: These are sequential Supabase calls — not a single transaction.
// If the server crashes mid-approval, some entries may be applied.
// A future RPC can wrap this in a DB-level transaction.
//
// @param {object} params
//   @param {string} params.planId     - UUID of the plan to approve
//   @param {string} params.reviewedBy - user_profiles UUID (editor's auth.uid())
//   @param {Array}  params.entries    - Array of { employee_id, shift_date } from the plan
// @returns {Promise<{ data: object|null, error: object|null }>}
// ---------------------------------------------------------------------------
export async function approvePlan({ planId, reviewedBy, entries }) {
  // --- STEP 1: Mark plan as approved ---
  const { error: approveError } = await supabase
    .from('employee_schedule_plans')
    .update({
      plan_status: 'approved',
      reviewed_by: reviewedBy,
      updated_at:  new Date().toISOString(),
    })
    .eq('id', planId);

  if (approveError) {
    console.error('[schedulePlannerService] approvePlan update plan error:', approveError);
    return { data: null, error: approveError };
  }

  // --- STEP 2: Upsert ONLY allowed entries into daily_attendances ---
  // The remaining scheduled entries stay entirely in the schedule plan tables.
  const entriesToUpsert = entries.filter(entry => 
    AUTO_UPSERT_STATUSES.includes(entry.attendance_status)
  );

  if (entriesToUpsert.length > 0) {
    const upsertRows = entriesToUpsert.map(entry => ({
      employee_id:       entry.employee_id,
      shift_date:        entry.shift_date,
      attendance_status: entry.attendance_status,
      hub_id:            entry.hub_id,
    }));

    const { error: upsertError } = await supabase.rpc('rpc_upsert_schedule_attendances', {
      p_entries: upsertRows,
    });

    if (upsertError) {
      console.error('[schedulePlannerService] approvePlan upsert daily_attendances error:', upsertError);
      // NOTE: Plan is already marked approved above. Log prominently.
      // TODO: Phase 2 — wrap in atomic RPC to prevent partial writes.
      return { data: null, error: upsertError };
    }
  }

  // --- STEP 3: Clear any ghost attendances for non-auto-upserted statuses ---
  // If the manager is overriding a week-off (auto-upserted) with a present/absent (not auto-upserted),
  // we must delete the stranded week-off from daily_attendances if they haven't checked in yet.
  const entriesToClear = entries.filter(entry => 
    !AUTO_UPSERT_STATUSES.includes(entry.attendance_status)
  );

  if (entriesToClear.length > 0) {
    const clearPayload = entriesToClear.map(entry => ({
      employee_id: entry.employee_id,
      shift_date:  entry.shift_date,
    }));

    const { error: clearError } = await supabase.rpc('rpc_clear_ghost_attendances', {
      p_entries: clearPayload,
    });

    if (clearError) {
      console.error('[schedulePlannerService] approvePlan rpc_clear_ghost_attendances error:', clearError);
      // Non-fatal to the approval itself, but log it.
    }
  }

  return { data: { planId, approved: true, entriesCount: entries.length }, error: null };
}

// ---------------------------------------------------------------------------
// EDITOR (CHECKER): Reject a bulk schedule plan
//
// Sets status to 'rejected' and records the review note. The plan returns
// to an editable state for the contributor (status='rejected' is treated as
// a re-editable draft in the UI, just with a visible rejection note).
//
// @param {object} params
//   @param {string}      params.planId     - UUID of the plan
//   @param {string}      params.reviewedBy - user_profiles UUID (editor's auth.uid())
//   @param {string|null} params.reviewNote - Optional rejection reason
// @returns {Promise<{ data: object|null, error: object|null }>}
// ---------------------------------------------------------------------------
export async function rejectPlan({ planId, reviewedBy, reviewNote = '' }) {
  const { data, error } = await supabase
    .from('employee_schedule_plans')
    .update({
      plan_status: 'rejected',
      reviewed_by: reviewedBy,
      review_note: reviewNote,
      updated_at:  new Date().toISOString(),
    })
    .eq('id', planId)
    .select('id, plan_status, review_note, updated_at')
    .single();

  if (error) {
    console.error('[schedulePlannerService] rejectPlan error:', error);
    return { data: null, error };
  }

  return { data, error: null };
}

// ---------------------------------------------------------------------------
// MANAGER BOARD: Fetch Approved Schedules for a Date Range
//
// Queries the highly optimized Postgres View which automatically filters
// overlapping plans and returns only the single most recently approved 
// entry per employee per date.
//
// @param {string} startDate - 'YYYY-MM-DD'
// @param {string} endDate   - 'YYYY-MM-DD'
// @returns {Promise<{ data: Array, error: object|null }>}
// ---------------------------------------------------------------------------
export async function fetchApprovedSchedulesForDateRange(startDate, endDate) {
  const { data, error } = await supabase
    .from('vw_latest_approved_schedules')
    .select('*')
    .gte('shift_date', startDate)
    .lte('shift_date', endDate);

  if (error) {
    console.error('[schedulePlannerService] fetchApprovedSchedules error:', error);
    return { data: null, error };
  }

  return { data: data || [], error: null };
}

