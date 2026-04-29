import React from 'react';
import './ImpersonationBanner.css';

export const ImpersonationBanner = ({
  realUser,
  impersonatedUser,
  impersonationUsers,
  onImpersonate,
}) => {
  if (realUser?.roleId !== 'master_admin') return null;

  return (
    <div className="impersonation-banner">
      <div className="banner-content">
        {impersonatedUser ? (
          <>
            <span className="banner-status">
              Currently Impersonating: <strong>{impersonatedUser.name}</strong> <span className="neutral-badge" style={{ fontSize: '0.75rem', padding: '2px 6px', opacity: 0.8 }}>{impersonatedUser.roleId}</span>
            </span>
            <button className="halo-button stop-btn" onClick={() => onImpersonate(null)}>
              Stop Impersonation
            </button>
          </>
        ) : (
          <>
            <span className="banner-status">
              Admin Mode: View application as a specific user
            </span>
            <div className="banner-actions">
              <select
                className="impersonation-select master-dropdown"
                onChange={(e) => onImpersonate(e.target.value)}
                defaultValue=""
              >
                <option value="" disabled>Select a user to simulate...</option>
                {impersonationUsers.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role_id})
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ImpersonationBanner;
