import React from 'react';
import './RoleTooltip.css';

/**
 * RoleTooltip
 *
 * Renders a rich hover tooltip explaining what a given RBAC access level grants
 * within a specific feature or vertical context.
 *
 * Props:
 *   level       {string}  — 'none' | 'viewer' | 'contributor' | 'editor' | 'admin'
 *   contextName {string}  — e.g. "Attendance Board" or "Employees vertical"
 *   isFeature   {boolean} — true if this is a feature-level tooltip (vs vertical-level)
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
    can: ['View & browse all records', 'Export data (if enabled)', 'Search & filter data'],
    cannot: ['Create new records', 'Edit existing data', 'Delete any records'],
    summary: 'Perfect for stakeholders and observers who need visibility without write access.',
  },
  contributor: {
    headline: 'Read + Create',
    color: 'var(--brand-emerald, #10b981)',
    can: ['View & browse all records', 'Create new entries', 'Search & filter data'],
    cannot: ['Edit or update existing records', 'Delete any records'],
    summary: 'Ideal for team members who submit data but should not modify past entries.',
  },
  editor: {
    headline: 'Read + Create + Edit',
    color: 'var(--brand-amber, #f59e0b)',
    can: ['View & browse all records', 'Create new entries', 'Edit & update existing records', 'Search & filter data'],
    cannot: ['Permanently delete records'],
    summary: 'For trusted team members who manage day-to-day data with full write access.',
  },
  admin: {
    headline: 'Full Access',
    color: 'var(--priority-urgent, #f43f5e)',
    can: ['View & browse all records', 'Create new entries', 'Edit & update existing records', 'Permanently delete records', 'Manage sub-settings (if available)'],
    cannot: [],
    summary: 'Full CRUD control. Grant only to trusted administrators for this area.',
  },
};

const RoleTooltip = ({ level, contextName, isFeature }) => {
  const data = ROLE_DATA[level] || ROLE_DATA.none;
  const contextType = isFeature ? 'feature' : 'vertical';

  return (
    <div className="role-tooltip" role="tooltip" style={{ '--tooltip-accent': data.color }}>
      {/* Header */}
      <div className="role-tooltip-header">
      <span className="role-tooltip-badge">
          {level?.toUpperCase()}
        </span>
        <span className="role-tooltip-headline">{data.headline}</span>
      </div>

      {/* Context Line */}
      <p className="role-tooltip-context">
        {contextName
          ? <>For <strong>{contextName}</strong> {contextType}</>
          : `For this ${contextType}`}
      </p>

      {/* Permissions grid */}
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
    </div>
  );
};

export default RoleTooltip;
