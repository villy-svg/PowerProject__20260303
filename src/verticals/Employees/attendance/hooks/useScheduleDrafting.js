import { useState, useCallback, useMemo } from 'react';
import { getCurrentWeekString, getDatesFromWeekString } from '../utils/attendanceDateUtils';

export function useScheduleDrafting({ planner, getLiveCellData, refreshBoard }) {
  // Planner State
  const [weekString, setWeekString] = useState(getCurrentWeekString());
  const [activePlanId, setActivePlanId] = useState(null);
  const [employeeSelections, setEmployeeSelections] = useState({}); // Record<empId, Record<date, { attendance_status, hub_id }>>
  
  const [isSubmittingPlanner, setIsSubmittingPlanner] = useState(false);
  const [plannerError, setPlannerError] = useState(null);
  const [plannerSuccess, setPlannerSuccess] = useState(null);

  // Paintbrush State (Internal to this hook)
  const [paintbrushStatus, setPaintbrushStatus] = useState('cursor');
  const [paintbrushHubId, setPaintbrushHubId] = useState('');
  
  const [activeCellEdit, setActiveCellEdit] = useState(null);

  // Derived Date Ranges
  const { from: plannerDateFrom, to: plannerDateTo } = useMemo(() => getDatesFromWeekString(weekString), [weekString]);
  
  const plannerDateRange = useMemo(() => {
    if (!plannerDateFrom || !plannerDateTo) return [];
    const arr = [];
    const cur = new Date(plannerDateFrom);
    const end = new Date(plannerDateTo);
    while (cur <= end) {
      arr.push(cur.toISOString().split('T')[0]);
      cur.setDate(cur.getDate() + 1);
    }
    return arr;
  }, [plannerDateFrom, plannerDateTo]);

  const totalEntries = useMemo(() => {
    return Object.values(employeeSelections).reduce(
      (count, datesObj) => count + Object.keys(datesObj).length, 0
    );
  }, [employeeSelections]);

  const buildPlannerPayload = useCallback(() => {
    return Object.entries(employeeSelections)
      .map(([empId, datesObj]) => ({
        employeeId: empId,
        dates: Object.entries(datesObj).map(([date, sel]) => ({
          date,
          attendance_status: sel.attendance_status,
          hub_id: sel.hub_id,
        }))
      }))
      .filter(sel => sel.dates.length > 0);
  }, [employeeSelections]);

  // Callbacks
  const handleCellClick = useCallback((empId, date) => {
    // Note: To truly make this independent of viewMode, the check for viewMode === 'planner'
    // should ideally happen in the component that routes the click, or we assume this hook is
    // only used for planner mode cell interactions. We assume planner mode interaction here.

    const liveData = getLiveCellData(empId, date);
    const isAlreadyMarked = liveData && !liveData.is_scheduled_only && liveData.attendance_status !== 'null';
    if (isAlreadyMarked) {
      return; // do not allow editing already marked attendance
    }

    if (paintbrushStatus === 'cursor') {
      setActiveCellEdit(prev => (prev?.empId === empId && prev?.date === date) ? null : { empId, date });
      return;
    }
    
    const applyStatus = paintbrushStatus === 'eraser' ? 'null' : paintbrushStatus;
    
    setActiveCellEdit(null);
    setPlannerError(null);
    setPlannerSuccess(null);
    
    setEmployeeSelections(prev => {
      const currentDates = prev[empId] || {};
      const existing = currentDates[date];
      
      if (existing && existing.attendance_status === applyStatus && existing.hub_id === paintbrushHubId) {
        // Remove if toggling the same status
        const { [date]: _, ...remainingDates } = currentDates;
        return { ...prev, [empId]: remainingDates };
      }
      
      return {
        ...prev,
        [empId]: {
          ...currentDates,
          [date]: { attendance_status: applyStatus, hub_id: paintbrushHubId }
        }
      };
    });
  }, [getLiveCellData, paintbrushStatus, paintbrushHubId]);

  const handleCellChange = useCallback((empId, date, newStatus, newHubId) => {
    setEmployeeSelections(prev => {
      const currentDates = prev[empId] || {};
      
      if (newStatus === 'null') {
        const { [date]: _, ...remainingDates } = currentDates;
        return { ...prev, [empId]: remainingDates };
      }

      return {
        ...prev,
        [empId]: {
          ...currentDates,
          [date]: { attendance_status: newStatus, hub_id: newHubId }
        }
      };
    });
  }, []);

  const handleSaveDraft = useCallback(async () => {
    if (totalEntries === 0) {
      setPlannerError('Please assign at least one date to an employee.');
      return;
    }
    setIsSubmittingPlanner(true);
    setPlannerError(null);
    setPlannerSuccess(null);

    try {
      const { data, error } = await planner.saveDraft({
        planId: activePlanId,
        dateFrom: plannerDateFrom,
        dateTo: plannerDateTo,
        employeeSelections: buildPlannerPayload(),
      });
      if (error) throw error;

      if (!activePlanId && data?.id) setActivePlanId(data.id);
      setPlannerSuccess('Draft saved. You can submit for approval when ready.');
      planner.refreshPlanner();
    } catch (err) {
      setPlannerError(err?.message || 'Failed to save draft. Please try again.');
    } finally {
      setIsSubmittingPlanner(false);
    }
  }, [activePlanId, plannerDateFrom, plannerDateTo, totalEntries, buildPlannerPayload, planner]);

  const handleSubmitForApproval = useCallback(async () => {
    if (totalEntries === 0) {
      setPlannerError('Please assign at least one date to an employee.');
      return;
    }
    setIsSubmittingPlanner(true);
    setPlannerError(null);
    setPlannerSuccess(null);

    try {
      const { data: draftData, error: draftErr } = await planner.saveDraft({
        planId: activePlanId,
        dateFrom: plannerDateFrom,
        dateTo: plannerDateTo,
        employeeSelections: buildPlannerPayload(),
      });
      if (draftErr) throw draftErr;

      const resolvedPlanId = activePlanId || draftData?.id;
      if (!resolvedPlanId) throw new Error('Failed to resolve plan ID after save.');

      const { error: submitErr } = await planner.submitPlan({
        planId: resolvedPlanId,
        dateFrom: plannerDateFrom,
        dateTo: plannerDateTo,
      });
      if (submitErr) throw submitErr;

      setPlannerSuccess(`Plan submitted! ${totalEntries} entries are pending Editor approval.`);
      setActivePlanId(null);
      setEmployeeSelections({});
      planner.refreshPlanner();
    } catch (err) {
      setPlannerError(err?.message || 'Failed to submit plan.');
    } finally {
      setIsSubmittingPlanner(false);
    }
  }, [activePlanId, plannerDateFrom, plannerDateTo, totalEntries, buildPlannerPayload, planner]);

  const loadPlanIntoGrid = useCallback((plan, setViewMode, setShowMyPlans) => {
    setActivePlanId(plan.id);
    
    const d = new Date(plan.date_from);
    const year = d.getFullYear();
    const firstThursday = new Date(d.getFullYear(), 0, 4);
    const days = Math.round((d.getTime() - firstThursday.getTime()) / 86400000);
    const weekNumber = 1 + Math.ceil(days / 7);
    setWeekString(`${year}-W${weekNumber.toString().padStart(2, '0')}`);

    const newSelections = {};
    const entries = plan.employee_schedule_plan_entries || [];
    entries.forEach(entry => {
      if (!newSelections[entry.employee_id]) {
        newSelections[entry.employee_id] = {};
      }
      newSelections[entry.employee_id][entry.shift_date] = {
        attendance_status: entry.attendance_status,
        hub_id: entry.hub_id
      };
    });
    setEmployeeSelections(newSelections);
    setViewMode('planner');
    setPlannerError(null);
    setPlannerSuccess(null);
    if (setShowMyPlans) setShowMyPlans(false);
  }, []);

  return {
    weekString, setWeekString,
    activePlanId,
    employeeSelections, setEmployeeSelections,
    isSubmittingPlanner,
    plannerError, setPlannerError,
    plannerSuccess, setPlannerSuccess,
    paintbrushStatus, setPaintbrushStatus,
    paintbrushHubId, setPaintbrushHubId,
    activeCellEdit, setActiveCellEdit,
    plannerDateFrom, plannerDateTo,
    plannerDateRange,
    totalEntries,
    handleCellClick,
    handleCellChange,
    handleSaveDraft,
    handleSubmitForApproval,
    loadPlanIntoGrid,
  };
}
