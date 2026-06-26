/**
 * useSchedulePlanner.js
 *
 * State management hook for the bulk Schedule Planner feature.
 *
 * Provides:
 *   - myPlans: The current user's own plans (draft, pending, rejected)
 *   - pendingPlans: All org-wide pending plans (for Editors)
 *   - isLoading, error
 *   - saveDraft(), submitPlan(), approvePlan(), rejectPlan()
 *   - refreshPlanner() — re-fetches all data
 *
 * Skill compliance:
 *   development-best-practices §10 (Zero raw fetching; delegates to service layer)
 *   rbac-security-system §2        (canApprove / canSuggestEdit from parent props)
 *   safe-code-modification §1C     (Documentation for all logic blocks)
 */

import { useState, useCallback, useEffect } from 'react';
import {
  saveDraft        as serviceSaveDraft,
  submitPlan       as serviceSubmitPlan,
  fetchMyPlans     as serviceFetchMyPlans,
  fetchPendingPlans as serviceFetchPendingPlans,
  approvePlan      as serviceApprovePlan,
  rejectPlan       as serviceRejectPlan,
} from '../services/employees/schedulePlannerService';

// ---------------------------------------------------------------------------
// useSchedulePlanner
//
// @param {object} params
//   @param {object}  params.user       - Current user object (needs .id)
//   @param {boolean} params.canApprove - True if the user is Editor or Admin
// @returns {object} planner state and action handlers
// ---------------------------------------------------------------------------
export function useSchedulePlanner({ user, canApprove }) {
  const [myPlans,      setMyPlans]      = useState([]);
  const [pendingPlans, setPendingPlans] = useState([]);
  const [isLoading,    setIsLoading]    = useState(false);
  const [error,        setError]        = useState(null);

  // ---------------------------------------------------------------------------
  // refreshPlanner — fetches both "My Plans" and (if editor) "Pending Plans"
  // ---------------------------------------------------------------------------
  const refreshPlanner = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    setError(null);

    try {
      // Always fetch the user's own plans
      const { data: myData, error: myErr } = await serviceFetchMyPlans(user.id);
      if (myErr) throw myErr;
      setMyPlans(myData || []);

      // Only fetch org-wide pending plans if the user can approve
      if (canApprove) {
        const { data: pendingData, error: pendingErr } = await serviceFetchPendingPlans();
        if (pendingErr) throw pendingErr;
        setPendingPlans(pendingData || []);
      }
    } catch (err) {
      console.error('[useSchedulePlanner] refreshPlanner error:', err);
      setError(err?.message || 'Failed to load schedule plans.');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, canApprove]);

  // Auto-fetch on mount and when user/canApprove changes
  useEffect(() => {
    refreshPlanner();
  }, [refreshPlanner]);

  // ---------------------------------------------------------------------------
  // saveDraft — saves (or updates) a plan without submitting it
  // ---------------------------------------------------------------------------
  const saveDraft = useCallback(async ({ planId, dateFrom, dateTo, employeeSelections }) => {
    if (!user?.id) return { error: new Error('User not authenticated') };
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: err } = await serviceSaveDraft({
        planId,
        dateFrom,
        dateTo,
        employeeSelections,
        submittedBy: user.id,
      });
      if (err) throw err;
      // Refresh to show updated plan in "My Plans" list
      await refreshPlanner();
      return { data, error: null };
    } catch (err) {
      console.error('[useSchedulePlanner] saveDraft error:', err);
      setError(err?.message || 'Failed to save draft.');
      return { data: null, error: err };
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, refreshPlanner]);

  // ---------------------------------------------------------------------------
  // submitPlan — transitions a draft/rejected plan to 'pending'
  // ---------------------------------------------------------------------------
  const submitPlan = useCallback(async ({ planId, dateFrom, dateTo }) => {
    if (!user?.id) return { error: new Error('User not authenticated') };
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: err } = await serviceSubmitPlan({
        planId,
        submittedBy: user.id,
        dateFrom,
        dateTo,
      });
      if (err) throw err;
      await refreshPlanner();
      return { data, error: null };
    } catch (err) {
      console.error('[useSchedulePlanner] submitPlan error:', err);
      setError(err?.message || 'Failed to submit plan.');
      return { data: null, error: err };
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, refreshPlanner]);

  // ---------------------------------------------------------------------------
  // approvePlan — Editor approves a plan and writes entries to daily_attendances
  // ---------------------------------------------------------------------------
  const approvePlan = useCallback(async ({ planId, entries }) => {
    if (!user?.id) return { error: new Error('User not authenticated') };
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: err } = await serviceApprovePlan({
        planId,
        reviewedBy: user.id,
        entries,
      });
      if (err) throw err;
      await refreshPlanner();
      return { data, error: null };
    } catch (err) {
      console.error('[useSchedulePlanner] approvePlan error:', err);
      setError(err?.message || 'Failed to approve plan.');
      return { data: null, error: err };
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, refreshPlanner]);

  // ---------------------------------------------------------------------------
  // rejectPlan — Editor rejects a plan with an optional note
  // ---------------------------------------------------------------------------
  const rejectPlan = useCallback(async ({ planId, reviewNote }) => {
    if (!user?.id) return { error: new Error('User not authenticated') };
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: err } = await serviceRejectPlan({
        planId,
        reviewedBy: user.id,
        reviewNote,
      });
      if (err) throw err;
      await refreshPlanner();
      return { data, error: null };
    } catch (err) {
      console.error('[useSchedulePlanner] rejectPlan error:', err);
      setError(err?.message || 'Failed to reject plan.');
      return { data: null, error: err };
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, refreshPlanner]);

  return {
    myPlans,
    pendingPlans,
    pendingPlansCount: pendingPlans.length,
    isLoading,
    error,
    refreshPlanner,
    saveDraft,
    submitPlan,
    approvePlan,
    rejectPlan,
  };
}

