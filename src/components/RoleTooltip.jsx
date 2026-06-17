import React, { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import './RoleTooltip.css';

/**
 * RoleTooltip
 *
 * A portal-based hover tooltip that escapes any overflow:hidden/auto parent.
 * Wraps its children in a `.role-tooltip-anchor` div and renders the tooltip
 * panel into document.body via createPortal using position:fixed coordinates.
 *
 * Usage:
 *   <RoleTooltip level="viewer" contextName="Attendance Board" isFeature>
 *     <button>VIEWER</button>
 *   </RoleTooltip>
 *
 * Props:
 *   level       {string}    — 'none' | 'viewer' | 'contributor' | 'editor' | 'admin'
 *   contextName {string}    — e.g. "Attendance Board" or "Employees"
 *   isFeature   {boolean}   — true → "feature", false → "vertical"
 *   children    {ReactNode} — the button or element to wrap
 */

const ROLE_DATA = {
  none: {
    headline: 'No Access',
    color: 'var(--text-color)',
    can: [],
    cannot: ['View any records', 'Create new entries', 'Edit existing data', 'Delete records'],
    summary: 'This user will be completely blocked from accessing this area.',
  },
  viewer: {
    headline: 'Read-Only Access',
    color: 'var(--brand-blue, #3b82f6)',
    can: ['View & browse all records', 'Search & filter data'],
    cannot: ['Create new records', 'Edit existing data', 'Delete any records'],
    summary: 'For stakeholders who need visibility without write access.',
  },
  contributor: {
    headline: 'Read + Create',
    color: 'var(--brand-emerald, #10b981)',
    can: ['View & browse all records', 'Create new entries'],
    cannot: ['Edit or update existing records', 'Delete any records'],
    summary: 'For team members who submit data but should not modify past entries.',
  },
  editor: {
    headline: 'Read + Create + Edit',
    color: 'var(--brand-amber, #f59e0b)',
    can: ['View & browse all records', 'Create new entries', 'Edit & update existing records'],
    cannot: ['Permanently delete records'],
    summary: 'For trusted members who manage day-to-day data with full write access.',
  },
  admin: {
    headline: 'Full Access',
    color: 'var(--priority-urgent, #f43f5e)',
    can: ['View, create, edit & delete records', 'Manage sub-settings (if available)'],
    cannot: [],
    summary: 'Full CRUD control. Grant only to trusted administrators for this area.',
  },
};

const RoleTooltip = ({ level, contextName, isFeature, children }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const anchorRef = useRef(null);

  const data = ROLE_DATA[level] || ROLE_DATA.none;
  const contextType = isFeature ? 'feature' : 'vertical';

  const show = useCallback(() => {
    if (anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setCoords({
        top: rect.top + window.scrollY,
        left: rect.left + rect.width / 2 + window.scrollX,
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
          className="role-tooltip"
          role="tooltip"
          style={{ '--tooltip-accent': data.color, top: coords.top, left: coords.left }}
        >
          {/* Header */}
          <div className="role-tooltip-header">
            <span className="role-tooltip-badge">{level?.toUpperCase()}</span>
            <span className="role-tooltip-headline">{data.headline}</span>
          </div>

          {/* Context line */}
          {contextName && (
            <p className="role-tooltip-context">
              For <strong>{contextName}</strong> {contextType}
            </p>
          )}

          {/* Permissions */}
          <div className="role-tooltip-perms">
            {data.can.length > 0 && (
              <ul className="role-tooltip-list role-tooltip-list--can">
                {data.can.map((item, i) => (
                  <li key={i}>
                    <span className="perm-icon perm-icon--yes">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            )}
            {data.cannot.length > 0 && (
              <ul className="role-tooltip-list role-tooltip-list--cannot">
                {data.cannot.map((item, i) => (
                  <li key={i}>
                    <span className="perm-icon perm-icon--no">✕</span>
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Summary */}
          <p className="role-tooltip-summary">{data.summary}</p>

          {/* Caret */}
          <div className="role-tooltip-caret" />
        </div>,
        document.body
      )}
    </div>
  );
};

export default RoleTooltip;
