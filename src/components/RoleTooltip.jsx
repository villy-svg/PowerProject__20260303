import React, { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import './RoleTooltip.css';

/**
 * RoleTooltip
 *
 * Portal-based hover tooltip for RBAC role-level buttons.
 * Renders into document.body via createPortal (escapes all overflow clipping).
 * Uses position:fixed with viewport-relative coordinates from getBoundingClientRect().
 * 
 * Includes viewport edge detection:
 * - Flips below the button when too close to the top.
 * - Shifts left/right if too close to the edge of the screen, while keeping the caret pointing at the anchor.
 */

const ROLE_BASE = {
  none:        { headline: 'No Access',            color: 'var(--text-color)' },
  viewer:      { headline: 'Read-Only Access',      color: 'var(--brand-blue, #3b82f6)' },
  contributor: { headline: 'Read + Create',         color: 'var(--brand-emerald, #10b981)' },
  editor:      { headline: 'Read + Create + Edit',  color: 'var(--brand-amber, #f59e0b)' },
  admin:       { headline: 'Full Access',           color: 'var(--priority-urgent, #f43f5e)' },
};

/* --------------------------------------------------------------------------
   CONTEXTUAL DESCRIPTIONS
   -------------------------------------------------------------------------- */
const RAW_CONTEXT = {
  /* ── VERTICALS ── */
  'Hubs': {
    none:        { can: [], summary: 'Completely blocked from the Hubs vertical — no boards will be visible.' },
    viewer:      { can: ['View hub profiles, locations, and operational status', 'Browse hub task boards, daily logs, and escalations (read-only)'], summary: 'Good for oversight roles who monitor hub operations without making changes.' },
    contributor: { can: ['View all Hubs data', 'Submit new hub task entries and daily task completions'], summary: 'Suited for field staff who log work but should not modify existing records.' },
    editor:      { can: ['View all Hubs data', 'Create and update hub tasks, daily tasks, and escalation records'], summary: 'For hub supervisors who actively manage task flow and daily operations.' },
    admin:       { can: ['Full control over all Hubs features', 'Create, edit, and delete tasks, templates, and escalations'], summary: 'Grants complete authority over the Hubs vertical. Assign to hub managers only.' },
  },
  'Clients': {
    none:        { can: [], summary: 'Completely blocked from the Clients vertical.' },
    viewer:      { can: ['Browse client profiles, service contracts, and active tasks', 'View the leads funnel and billing models (read-only)'], summary: 'For senior stakeholders who review client relationships without editing them.' },
    contributor: { can: ['View all Client data', 'Add new clients, raise client tasks, and add leads to the funnel'], summary: 'Suited for business development staff who capture new clients and leads.' },
    editor:      { can: ['View all Client data', 'Create and update client profiles, tasks, and leads funnel entries'], summary: 'For account managers who maintain and update ongoing client relationships.' },
    admin:       { can: ['Full control over all Clients features', 'Create, edit, and delete clients, tasks, and leads'], summary: 'Grants complete authority over the Clients vertical.' },
  },
  'Employees': {
    none:        { can: [], summary: 'Completely blocked from the Employees vertical.' },
    viewer:      { can: ['View employee profiles, department assignments, and roles', 'Browse attendance records, remarks, and HR rules (read-only)'], summary: 'For auditors or senior stakeholders who need HR visibility.' },
    contributor: { can: ['View all Employee data', 'Submit new attendance entries and add task remarks'], summary: 'For team leads who log attendance and remarks for their direct reports.' },
    editor:      { can: ['View all Employee data', 'Create and update employee records, attendance logs, and remarks'], summary: 'For HR managers who actively manage employee data and attendance.' },
    admin:       { can: ['Full control over all Employees features', 'Manage profiles, attendance, rules & regulations, and all sub-boards'], summary: 'Grants complete authority over the Employees vertical.' },
  },
  'Partners': {
    viewer:      { can: ['View partner profiles and associated data (read-only)'], summary: 'Read-only visibility into partner relationships.' },
    contributor: { can: ['View all partner data', 'Add new partner records'], summary: 'Can register new partners but cannot modify existing ones.' },
    editor:      { can: ['View, add, and modify partner profiles and records'], summary: 'For partner managers who maintain and update partner relationships.' },
    admin:       { can: ['Full CRUD over all Partners data'], summary: 'Complete authority over Partners.' },
  },
  'Vendors': {
    viewer:      { can: ['View vendor profiles and associated data (read-only)'], summary: 'Read-only visibility into vendor relationships.' },
    contributor: { can: ['View all vendor data', 'Add new vendor records'], summary: 'Can register new vendors but cannot modify existing ones.' },
    editor:      { can: ['View, add, and modify vendor profiles and records'], summary: 'For vendor managers who maintain and update vendor relationships.' },
    admin:       { can: ['Full CRUD over all Vendors data'], summary: 'Complete authority over Vendors.' },
  },
  'Data': {
    viewer:      { can: ['View data sheets and model verification records (read-only)'], summary: 'For stakeholders who need data visibility without making changes.' },
    contributor: { can: ['View all data', 'Submit new data sheet entries and model verification requests'], summary: 'For analysts who input data but should not modify existing verified entries.' },
    editor:      { can: ['View, submit, and update data sheets and verification records'], summary: 'For data managers who actively maintain and correct data records.' },
    admin:       { can: ['Full control over all Data Manager features', 'Create, edit, and delete data and verification records'], summary: 'Complete authority over the Data vertical.' },
  },

  /* ── CLIENTS FEATURES ── */
  'Clients List': {
    viewer:      { can: ['Browse all client profiles and contact details', 'View service history and billing model info'], summary: 'For read-only stakeholders who review the client roster.' },
    contributor: { can: ['Browse all client profiles', 'Register new client profiles'], summary: 'For staff who onboard new clients but should not edit existing ones.' },
    editor:      { can: ['Browse all client profiles', 'Register new clients and update existing profiles'], summary: 'For account managers who maintain the client roster.' },
    admin:       { can: ['Full CRUD — add, edit, and permanently remove client profiles'], summary: 'Complete authority over the Clients List.' },
  },
  'Client Tasks Board': {
    viewer:      { can: ['View all client tasks, priorities, and completion statuses'], summary: 'For oversight roles who monitor task progress without assigning or editing.' },
    contributor: { can: ['View all client tasks', 'Create new client task assignments'], summary: 'For staff who raise tasks but should not update or close them.' },
    editor:      { can: ['View all client tasks', 'Create, reassign, and update task records and statuses'], summary: 'For task managers who actively manage client task flow.' },
    admin:       { can: ['Full CRUD — create, edit, reassign, and delete client tasks'], summary: 'Complete authority over the Client Tasks Board.' },
  },
  'Leads Funnel': {
    viewer:      { can: ['View all leads and their current funnel stage'], summary: 'For stakeholders who track pipeline progress without modifying it.' },
    contributor: { can: ['View all leads', 'Add new leads into the funnel'], summary: 'For BDEs who capture new leads but should not move or edit existing ones.' },
    editor:      { can: ['View all leads', 'Add new leads and move them through funnel stages', 'Update lead details and status'], summary: 'For sales managers who actively manage the lead pipeline.' },
    admin:       { can: ['Full CRUD — add, update, progress, and delete leads from the funnel'], summary: 'Complete authority over the Leads Funnel.' },
  },

  /* ── EMPLOYEES FEATURES ── */
  'Employees List': {
    viewer:      { can: ['Browse employee profiles, roles, and department assignments'], summary: 'Read-only access to the employee directory.' },
    contributor: { can: ['Browse employee profiles', 'Onboard and register new employee records'], summary: 'For HR staff who add new employees but do not edit existing profiles.' },
    editor:      { can: ['Browse employee profiles', 'Onboard new employees and update existing profiles'], summary: 'For HR managers who maintain the full employee directory.' },
    admin:       { can: ['Full CRUD — add, edit, and permanently remove employee records'], summary: 'Complete authority over the Employees List.' },
  },
  'Remarks Manager': {
    viewer:      { can: ['View all task remarks and their full history'], summary: 'For oversight roles who review remarks without adding new ones.' },
    contributor: { can: ['View all remarks', 'Submit new remarks for employees'], summary: 'For team leads who log feedback but should not edit past entries.' },
    editor:      { can: ['View all remarks', 'Submit new remarks and edit existing remark entries'], summary: 'For managers who actively maintain the remarks log.' },
    admin:       { can: ['Full CRUD — add, edit, and delete remark entries'], summary: 'Complete authority over the Remarks Manager.' },
  },
  'Attendance Board': {
    viewer:      { can: ['View attendance records for all employees', 'See attendance status breakdown and summaries'], summary: 'For HR auditors who monitor attendance without editing.' },
    contributor: { can: ['View attendance records for all employees', 'Submit new attendance entries'], summary: 'For team leads who log attendance for their team.' },
    editor:      { can: ['View attendance records', 'Submit new entries and correct existing attendance records'], summary: 'For HR managers who maintain and rectify attendance data.' },
    admin:       { can: ['Full CRUD — view, submit, edit, and remove any attendance entry'], summary: 'Complete authority over the Attendance Board.' },
  },
  'Rules & Regulations': {
    viewer:      { can: ['Read all published company rules and policy documents'], summary: 'Read-only access to the HR policy library.' },
    contributor: { can: ['Read all rules', 'Submit proposed new rule additions for review'], summary: 'For staff who can suggest policy additions but not publish or edit.' },
    editor:      { can: ['Read, propose, and edit existing rule entries'], summary: 'For HR officers who draft and maintain policy documents.' },
    admin:       { can: ['Full CRUD — publish, update, and delete rules & policy documents'], summary: 'Complete authority over Rules & Regulations.' },
  },
  'Current Attendance': {
    viewer:      { can: ["View today's attendance summary and all employee statuses"], summary: 'For supervisors who monitor live attendance without making changes.' },
    contributor: { can: ["View today's attendance summary", 'Submit self-service attendance check-ins'], summary: 'For employees who log their own attendance via self-service.' },
    editor:      { can: ["View today's attendance summary", 'Submit and correct attendance entries for today'], summary: 'For HR staff who manage and rectify current-day attendance.' },
    admin:       { can: ["Full CRUD — manage all current-day attendance records and overrides"], summary: 'Complete authority over the Current Attendance view.' },
  },

  /* ── CHARGING HUBS FEATURES ── */
  'Hub Tasks Board': {
    viewer:      { can: ['View all hub task assignments, priorities, and completion statuses'], summary: 'For oversight roles who monitor hub task flow without making changes.' },
    contributor: { can: ['View all hub tasks', 'Create new hub task assignments'], summary: 'For field staff who raise tasks but should not update or close them.' },
    editor:      { can: ['View all hub tasks', 'Create, reassign, and update hub task records and statuses'], summary: 'For hub supervisors who actively manage hub task workflow.' },
    admin:       { can: ['Full CRUD — create, edit, reassign, and delete hub tasks'], summary: 'Complete authority over the Hub Tasks Board.' },
  },
  'Daily Task Board': {
    viewer:      { can: ['View all daily task assignments, checklists, and completion logs'], summary: 'For supervisors who review daily task progress without submitting entries.' },
    contributor: { can: ['View all daily tasks', 'Submit task completion entries'], summary: 'For field agents who check off and log their daily task completions.' },
    editor:      { can: ['View all daily tasks', 'Submit and update daily task records and completion statuses'], summary: 'For team leads who manage and correct daily task completion logs.' },
    admin:       { can: ['Full CRUD — manage all daily tasks and completion records'], summary: 'Complete authority over the Daily Task Board.' },
  },
  'Daily Task Template': {
    viewer:      { can: ['Browse all configured daily task templates and their task items'], summary: 'For staff who reference templates without modifying them.' },
    contributor: { can: ['Browse all templates', 'Submit new template proposals'], summary: 'For staff who can suggest new templates but cannot publish or edit.' },
    editor:      { can: ['Browse templates', 'Create new templates and modify existing ones'], summary: 'For operations leads who maintain and configure the task template library.' },
    admin:       { can: ['Full CRUD — add, edit, and delete daily task templates'], summary: 'Complete authority over task templates.' },
  },
  'Escalation Task Board': {
    viewer:      { can: ['View all escalated tasks, urgency levels, and resolution statuses'], summary: 'For senior oversight roles who monitor escalations without editing them.' },
    contributor: { can: ['View all escalations', 'Raise and submit new escalation entries'], summary: 'For field staff who flag issues but should not resolve or close escalations.' },
    editor:      { can: ['View all escalations', 'Raise new entries and update escalation records and statuses'], summary: 'For supervisors who manage and progress escalation resolution.' },
    admin:       { can: ['Full CRUD — manage, update, resolve, and close escalation tasks'], summary: 'Complete authority over the Escalation Board.' },
  },

  /* ── DATA MANAGER FEATURES ── */
  'Data Sheet Board': {
    viewer:      { can: ['View and browse all data sheets and their entries'], summary: 'For stakeholders who review data records without modifying them.' },
    contributor: { can: ['View all data sheets', 'Submit new data entries to existing sheets'], summary: 'For analysts who input raw data but should not modify validated records.' },
    editor:      { can: ['View all data sheets', 'Submit new entries and modify existing data records'], summary: 'For data managers who maintain and correct data sheets.' },
    admin:       { can: ['Full CRUD — add, edit, and delete data sheet records'], summary: 'Complete authority over the Data Sheet Board.' },
  },
  'Model Verification Board': {
    viewer:      { can: ['View model verification requests and their current verification status'], summary: 'For auditors who review verification records without submitting or editing.' },
    contributor: { can: ['View all verification records', 'Submit new model verification requests'], summary: 'For analysts who raise verification requests but do not process them.' },
    editor:      { can: ['View all verification records', 'Submit requests and update verification findings'], summary: 'For QA leads who actively process and update verification outcomes.' },
    admin:       { can: ['Full CRUD — manage, process, and delete model verification records'], summary: 'Complete authority over the Model Verification Board.' },
  },
};

/* Expand the raw context with aliases so that names from `verticalFeatures` AND 
   names from `resolveVerticalLabels` both map correctly to the exact same text */
const CONTEXT_ACCESS = {
  ...RAW_CONTEXT,
  'Client Task Board': RAW_CONTEXT['Client Tasks Board'],
  'Hub Task Board': RAW_CONTEXT['Hub Tasks Board'],
  'Hubs Task Board': RAW_CONTEXT['Hub Tasks Board'],
  'Daily Task Templates': RAW_CONTEXT['Daily Task Template'],
  'My Attendance': RAW_CONTEXT['Current Attendance'],
  'Data Manager': RAW_CONTEXT['Data'],
};

/* --------------------------------------------------------------------------
   Generic fallback descriptions
   -------------------------------------------------------------------------- */
const GENERIC_ACCESS = {
  none:        { can: [], cannot: ['View any records', 'Create, edit, or delete anything'], summary: 'This user will be completely blocked from this area.' },
  viewer:      { can: ['View & browse all records', 'Search & filter data'], cannot: ['Create new records', 'Edit existing data', 'Delete records'], summary: 'For stakeholders who need read-only visibility.' },
  contributor: { can: ['View & browse all records', 'Create new entries'], cannot: ['Edit existing records', 'Delete records'], summary: 'For staff who submit new data but should not modify past entries.' },
  editor:      { can: ['View & browse all records', 'Create new entries', 'Edit & update existing records'], cannot: ['Delete records'], summary: 'For trusted members who fully manage day-to-day data.' },
  admin:       { can: ['View, create, edit, and delete all records'], cannot: [], summary: 'Full CRUD. Grant only to trusted administrators for this area.' },
};

/* --------------------------------------------------------------------------
   Component
   -------------------------------------------------------------------------- */
const TOOLTIP_WIDTH = 240;
const TOOLTIP_HEIGHT_ESTIMATE = 220; // px — used for viewport edge detection

const RoleTooltip = ({ level, contextName, isFeature, children }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords]       = useState({ top: 0, left: 0, flipBelow: false, caretOffset: 0 });
  const anchorRef = useRef(null);

  const base    = ROLE_BASE[level]    || ROLE_BASE.none;
  // If the specific board overrides 'none', use it, otherwise fallback to generic 'none'
  const ctx     = CONTEXT_ACCESS[contextName]?.[level];
  const ctxNone = CONTEXT_ACCESS[contextName]?.['none'];
  const generic = GENERIC_ACCESS[level] || GENERIC_ACCESS.none;

  const can     = ctx?.can     ?? generic.can;
  const cannot  = ctx          ? []       : (level === 'none' && ctxNone ? ctxNone.cannot || [] : generic.cannot);
  const summary = ctx?.summary ?? (level === 'none' && ctxNone ? ctxNone.summary : generic.summary);

  const show = useCallback(() => {
    if (anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      const centreX = rect.left + rect.width / 2;
      const spaceAbove = rect.top;
      const flipBelow = spaceAbove < TOOLTIP_HEIGHT_ESTIMATE + 12;

      let finalLeft = centreX;
      let caretOffset = 0;

      // Prevent tooltip from overflowing the right edge of the viewport
      if (finalLeft + (TOOLTIP_WIDTH / 2) > window.innerWidth - 10) {
        finalLeft = window.innerWidth - (TOOLTIP_WIDTH / 2) - 10;
        caretOffset = centreX - finalLeft; // Shift caret right to keep pointing at the button
      }
      // Prevent tooltip from overflowing the left edge
      if (finalLeft - (TOOLTIP_WIDTH / 2) < 10) {
        finalLeft = (TOOLTIP_WIDTH / 2) + 10;
        caretOffset = centreX - finalLeft; // Shift caret left
      }

      setCoords({
        top: flipBelow ? rect.bottom + 10 : rect.top,
        left: finalLeft,
        flipBelow,
        caretOffset,
      });
    }
    setIsVisible(true);
  }, []);

  const hide = useCallback(() => setIsVisible(false), []);

  return (
    <div
      ref={anchorRef}
      className="role-tooltip-anchor"
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      {children}

      {isVisible && createPortal(
        <div
          className={`role-tooltip${coords.flipBelow ? ' role-tooltip--below' : ''}`}
          role="tooltip"
          style={{ 
            '--tooltip-accent': base.color, 
            '--caret-offset': `${coords.caretOffset}px`,
            top: coords.top, 
            left: coords.left 
          }}
        >
          {/* Header */}
          <div className="role-tooltip-header">
            <span className="role-tooltip-badge">{level?.toUpperCase()}</span>
            <span className="role-tooltip-headline">{base.headline}</span>
          </div>

          {/* Context line */}
          {contextName && (
            <p className="role-tooltip-context">
              For <strong>{contextName}</strong> {isFeature ? 'feature' : 'vertical'}
            </p>
          )}

          {/* Permissions */}
          <div className="role-tooltip-perms">
            {can.length > 0 && (
              <ul className="role-tooltip-list role-tooltip-list--can">
                {can.map((item, i) => (
                  <li key={i}>
                    <span className="perm-icon perm-icon--yes">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            )}
            {cannot.length > 0 && (
              <ul className="role-tooltip-list role-tooltip-list--cannot">
                {cannot.map((item, i) => (
                  <li key={i}>
                    <span className="perm-icon perm-icon--no">✕</span>
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Summary */}
          <p className="role-tooltip-summary">{summary}</p>

          {/* Caret */}
          <div className="role-tooltip-caret" />
        </div>,
        document.body
      )}
    </div>
  );
};

export default RoleTooltip;
