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
    viewer:      { can: ['View hub profiles, locations, and operational status', 'Browse hub task boards (Tasks limited by Sphere of Influence if Seniority ≤ 6)', 'Submit escalations and request support'], summary: 'Good for oversight roles and general staff requesting support. Note: Junior staff (Seniority ≤ 6) only see tasks assigned to or created by them/their reportees.' },
    contributor: { can: ['View Hubs data (Tasks limited if Seniority ≤ 6)', 'Submit new hub task entries and daily task completions'], summary: 'Suited for field staff who log work but should not modify existing records. Sphere of Influence applies to task visibility.' },
    editor:      { can: ['View Hubs data (Tasks limited if Seniority ≤ 6)', 'Create and update hub tasks, daily tasks, and escalation records'], summary: 'For hub supervisors who actively manage task flow and daily operations. Sphere of Influence applies to task visibility.' },
    admin:       { can: ['Full control over all Hubs features', 'Create, edit, and delete tasks, templates, and escalations'], summary: 'Grants complete authority over the Hubs vertical. Master Admins bypass all Sphere limitations.' },
  },
  'Clients': {
    none:        { can: [], summary: 'Completely blocked from the Clients vertical.' },
    viewer:      { can: ['Browse client profiles and service contracts', 'View active tasks and leads funnel (Tasks limited by Sphere of Influence if Seniority ≤ 6)'], summary: 'For senior stakeholders. Note: Junior staff only see client tasks tied to them or their reportees.' },
    contributor: { can: ['View Client data (Tasks limited if Seniority ≤ 6)', 'Add new clients, raise client tasks, and add leads to the funnel'], summary: 'Suited for business development staff who capture new clients and leads. Task visibility is restricted by Sphere of Influence for Junior staff.' },
    editor:      { can: ['View Client data (Tasks limited if Seniority ≤ 6)', 'Create and update client profiles, tasks, and leads funnel entries'], summary: 'For account managers who maintain and update ongoing client relationships. Task visibility is restricted by Sphere of Influence for Junior staff.' },
    admin:       { can: ['Full control over all Clients features', 'Create, edit, and delete clients, tasks, and leads'], summary: 'Grants complete authority over the Clients vertical. Master Admins bypass all Sphere limitations.' },
  },
  'Employees': {
    none:        { can: [], summary: 'Completely blocked from the Employees vertical.' },
    viewer:      { can: ['View employee profiles, department assignments, and roles', 'Browse attendance and remarks (Remarks limited by Sphere if Seniority ≤ 6)', 'Submit self-only bank details updates'], summary: 'For auditors or senior stakeholders. Note: Junior staff only see remarks tied to them or their reportees.' },
    contributor: { can: ['View Employee data (Remarks limited if Seniority ≤ 6)', 'Submit new attendance entries and add task remarks'], summary: 'For team leads who log attendance and remarks. Remark visibility is restricted by Sphere of Influence for Junior staff.' },
    editor:      { can: ['View Employee data (Remarks limited if Seniority ≤ 6)', 'Create and update employee records, attendance logs, and remarks'], summary: 'For HR managers who actively manage employee data. Remark visibility is restricted by Sphere of Influence for Junior staff.' },
    admin:       { can: ['Full control over all Employees features', 'Manage profiles, attendance, rules & regulations, and all sub-boards'], summary: 'Grants complete authority over the Employees vertical. Master Admins bypass all Sphere limitations.' },
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
    viewer:      { can: ['View data sheets and model verification records (Limited by Sphere if Seniority ≤ 6)'], summary: 'For stakeholders. Note: Junior staff only see records tied to them or their reportees.' },
    contributor: { can: ['View data records (Limited if Seniority ≤ 6)', 'Submit new data sheet entries and model verification requests'], summary: 'For analysts. Record visibility is restricted by Sphere of Influence for Junior staff.' },
    editor:      { can: ['View data records (Limited if Seniority ≤ 6)', 'Submit and update data sheets and verification records'], summary: 'For data managers. Record visibility is restricted by Sphere of Influence for Junior staff.' },
    admin:       { can: ['Full control over all Data Manager features', 'Create, edit, and delete data and verification records'], summary: 'Complete authority over the Data vertical. Master Admins bypass all Sphere limitations.' },
  },

  /* ── CLIENTS FEATURES ── */
  'Clients List': {
    viewer:      { can: ['Browse all client profiles and contact details', 'View service history and billing model info'], summary: 'For read-only stakeholders who review the client roster.' },
    contributor: { can: ['Browse all client profiles', 'Register new client profiles'], summary: 'For staff who onboard new clients but should not edit existing ones.' },
    editor:      { can: ['Browse all client profiles', 'Register new clients and update existing profiles'], summary: 'For account managers who maintain the client roster.' },
    admin:       { can: ['Full CRUD — add, edit, and permanently remove client profiles'], summary: 'Complete authority over the Clients List.' },
  },
  'Client Tasks Board': {
    viewer:      { can: ['View client tasks, priorities, and completion statuses (Limited by Sphere of Influence if Seniority ≤ 6)'], summary: 'For oversight roles. Note: Junior staff only see tasks assigned to/created by them or their reportees.' },
    contributor: { can: ['View client tasks (Limited if Seniority ≤ 6)', 'Create new client task assignments'], summary: 'For staff who raise tasks. Visibility restricted by Sphere of Influence for Junior staff.' },
    editor:      { can: ['View client tasks (Limited if Seniority ≤ 6)', 'Create, reassign, and update task records and statuses'], summary: 'For task managers. Visibility restricted by Sphere of Influence for Junior staff.' },
    admin:       { can: ['Full CRUD — create, edit, reassign, and delete client tasks'], summary: 'Complete authority over the Client Tasks Board. Master Admins bypass all Sphere limitations.' },
  },
  'Leads Funnel': {
    viewer:      { can: ['View all leads and their current funnel stage (Limited by Sphere of Influence if Seniority ≤ 6)'], summary: 'For stakeholders. Note: Junior staff only see leads assigned to/created by them or their reportees.' },
    contributor: { can: ['View leads (Limited if Seniority ≤ 6)', 'Add new leads into the funnel'], summary: 'For BDEs capturing leads. Visibility restricted by Sphere of Influence for Junior staff.' },
    editor:      { can: ['View leads (Limited if Seniority ≤ 6)', 'Add new leads and move them through funnel stages', 'Update lead details and status'], summary: 'For sales managers. Visibility restricted by Sphere of Influence for Junior staff.' },
    admin:       { can: ['Full CRUD — add, update, progress, and delete leads from the funnel'], summary: 'Complete authority over the Leads Funnel. Master Admins bypass all Sphere limitations.' },
  },

  /* ── EMPLOYEES FEATURES ── */
  'Employees List': {
    viewer:      { can: ['Browse employee profiles, roles, and department assignments'], summary: 'Read-only access to the employee directory.' },
    contributor: { can: ['Browse employee profiles', 'Onboard and register new employee records'], summary: 'For HR staff who add new employees but do not edit existing profiles.' },
    editor:      { can: ['Browse employee profiles', 'Onboard new employees and update existing profiles'], summary: 'For HR managers who maintain the full employee directory.' },
    admin:       { can: ['Full CRUD — add, edit, and permanently remove employee records'], summary: 'Complete authority over the Employees List.' },
  },
  'Remarks Manager': {
    viewer:      { can: ['View task remarks and their full history (Limited by Sphere of Influence if Seniority ≤ 6)'], summary: 'For oversight roles. Note: Junior staff only see remarks assigned to/created by them or their reportees.' },
    contributor: { can: ['View remarks (Limited if Seniority ≤ 6)', 'Submit new remarks for employees'], summary: 'For team leads. Remark visibility is restricted by Sphere of Influence for Junior staff.' },
    editor:      { can: ['View remarks (Limited if Seniority ≤ 6)', 'Submit new remarks and edit existing remark entries'], summary: 'For managers. Remark visibility is restricted by Sphere of Influence for Junior staff.' },
    admin:       { can: ['Full CRUD — add, edit, and delete remark entries'], summary: 'Complete authority over the Remarks Manager. Master Admins bypass all Sphere limitations.' },
  },
  'Attendance Board': {
    viewer:      { can: ['View your own historical attendance records only', 'See personal attendance status breakdown'], summary: 'For standard employees to view their own attendance history.' },
    contributor: { can: ['View attendance records for all employees', 'Suggest edits to existing attendance records (Maker)'], summary: 'For team leads who log attendance corrections requiring approval.' },
    editor:      { can: ['View attendance records', 'Review and approve pending attendance edits (Checker)', 'Directly correct attendance records'], summary: 'For HR managers who maintain and approve attendance data.' },
    admin:       { can: ['Full CRUD — view, suggest, approve, and remove any attendance entry'], summary: 'Complete authority over the Attendance Board.' },
  },
  'Rules & Regulations': {
    viewer:      { can: ['Read all published company rules and policy documents'], summary: 'Read-only access to the HR policy library.' },
    contributor: { can: ['Read all rules', 'Submit proposed new rule additions for review'], summary: 'For staff who can suggest policy additions but not publish or edit.' },
    editor:      { can: ['Read, propose, and edit existing rule entries'], summary: 'For HR officers who draft and maintain policy documents.' },
    admin:       { can: ['Full CRUD — publish, update, and delete rules & policy documents'], summary: 'Complete authority over Rules & Regulations.' },
  },
  'Current Attendance': {
    viewer:      { can: ["Submit self-service attendance check-ins for yourself only"], summary: 'For field employees who only need to log their own daily attendance.' },
    contributor: { can: ["Submit self-service attendance check-ins", "View today's live attendance summary and all employee statuses"], summary: 'For supervisors who monitor live attendance and also log their own.' },
    editor:      { can: ["View today's attendance summary", 'Submit and correct attendance entries for today'], summary: 'For HR staff who manage and rectify current-day attendance.' },
    admin:       { can: ["Full CRUD — manage all current-day attendance records and overrides"], summary: 'Complete authority over the Current Attendance view.' },
  },

  /* ── CHARGING HUBS FEATURES ── */
  'Hub Tasks Board': {
    viewer:      { can: ['View all hub task assignments, priorities, and completion statuses (Limited by Sphere of Influence if Seniority ≤ 6)'], summary: 'For oversight roles. Note: Junior staff only see tasks assigned to/created by them or their reportees.' },
    contributor: { can: ['View hub tasks (Limited if Seniority ≤ 6)', 'Create new hub task assignments'], summary: 'For field staff raising tasks. Visibility restricted by Sphere of Influence for Junior staff.' },
    editor:      { can: ['View hub tasks (Limited if Seniority ≤ 6)', 'Create, reassign, and update hub task records and statuses'], summary: 'For hub supervisors. Visibility restricted by Sphere of Influence for Junior staff.' },
    admin:       { can: ['Full CRUD — create, edit, reassign, and delete hub tasks'], summary: 'Complete authority over the Hub Tasks Board. Master Admins bypass all Sphere limitations.' },
  },
  'Daily Task Board': {
    viewer:      { can: ['View all daily task assignments, checklists, and completion logs (Limited by Sphere of Influence if Seniority ≤ 6)'], summary: 'For oversight roles. Note: Junior staff only see tasks assigned to/created by them or their reportees.' },
    contributor: { can: ['View daily tasks (Limited if Seniority ≤ 6)', 'Submit task completion entries'], summary: 'For field agents logging completions. Visibility restricted by Sphere of Influence for Junior staff.' },
    editor:      { can: ['View daily tasks (Limited if Seniority ≤ 6)', 'Submit and update daily task records and completion statuses'], summary: 'For team leads correcting logs. Visibility restricted by Sphere of Influence for Junior staff.' },
    admin:       { can: ['Full CRUD — manage all daily tasks and completion records'], summary: 'Complete authority over the Daily Task Board. Master Admins bypass all Sphere limitations.' },
  },
  'Daily Task Template': {
    viewer:      { can: ['Browse all configured daily task templates and their task items'], summary: 'For staff who reference templates without modifying them.' },
    contributor: { can: ['Browse all templates', 'Submit new template proposals'], summary: 'For staff who can suggest new templates but cannot publish or edit.' },
    editor:      { can: ['Browse templates', 'Create new templates and modify existing ones'], summary: 'For operations leads who maintain and configure the task template library.' },
    admin:       { can: ['Full CRUD — add, edit, and delete daily task templates'], summary: 'Complete authority over task templates.' },
  },
  'Escalation Task Board': {
    viewer:      { can: ['View escalations (Limited by Sphere if Seniority ≤ 6)', 'Raise and submit new escalation entries'], summary: 'For oversight roles and general staff to request support. Note: Junior staff only see escalations tied to them or their reportees.' },
    contributor: { can: ['View escalations (Limited if Seniority ≤ 6)', 'Raise and submit new escalation entries'], summary: 'For field staff flagging issues. Visibility restricted by Sphere of Influence for Junior staff.' },
    editor:      { can: ['View escalations (Limited if Seniority ≤ 6)', 'Raise new entries and update escalation records and statuses'], summary: 'For supervisors managing resolution. Visibility restricted by Sphere of Influence for Junior staff.' },
    admin:       { can: ['Full CRUD — manage, update, resolve, and close escalation tasks'], summary: 'Complete authority over the Escalation Board. Master Admins bypass all Sphere limitations.' },
  },

  /* ── DATA MANAGER FEATURES ── */
  'Data Sheet Board': {
    viewer:      { can: ['View and browse data sheets and their entries (Limited by Sphere if Seniority ≤ 6)'], summary: 'For stakeholders. Note: Junior staff only see records tied to them or their reportees.' },
    contributor: { can: ['View data sheets (Limited if Seniority ≤ 6)', 'Submit new data entries to existing sheets'], summary: 'For analysts. Record visibility is restricted by Sphere of Influence for Junior staff.' },
    editor:      { can: ['View data sheets (Limited if Seniority ≤ 6)', 'Submit new entries and modify existing data records'], summary: 'For data managers. Record visibility is restricted by Sphere of Influence for Junior staff.' },
    admin:       { can: ['Full CRUD — add, edit, and delete data sheet records'], summary: 'Complete authority over the Data Sheet Board. Master Admins bypass all Sphere limitations.' },
  },
  'Model Verification Board': {
    viewer:      { can: ['View model verification requests and their current verification status (Limited by Sphere if Seniority ≤ 6)'], summary: 'For auditors. Note: Junior staff only see requests tied to them or their reportees.' },
    contributor: { can: ['View verification records (Limited if Seniority ≤ 6)', 'Submit new model verification requests'], summary: 'For analysts. Record visibility is restricted by Sphere of Influence for Junior staff.' },
    editor:      { can: ['View verification records (Limited if Seniority ≤ 6)', 'Submit requests and update verification findings'], summary: 'For QA leads. Record visibility is restricted by Sphere of Influence for Junior staff.' },
    admin:       { can: ['Full CRUD — manage, process, and delete model verification records'], summary: 'Complete authority over the Model Verification Board. Master Admins bypass all Sphere limitations.' },
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
  'Current Attendance': RAW_CONTEXT['Current Attendance'],
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
