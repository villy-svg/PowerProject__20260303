import React from 'react';
import powerLogo from '../../assets/logo.svg';
import './PendingActivation.css';

const PendingActivation = ({ onLogout }) => {
  return (
    <div className="pending-activation-container">
      <div className="pending-activation-card">
        <div className="pending-activation-header">
          <img src={powerLogo} alt="PowerProject Logo" className="logo-svg-large" />
          <h1 className="brand-title">PowerProject</h1>
        </div>

        <div className="activation-status-badge">
          <span className="badge-glow"></span>
          <span className="badge-text">Account Pending Activation</span>
        </div>

        <div className="pending-activation-content">
          <h2>Access Request Submitted</h2>
          <p>
            Your profile has been created successfully and is currently set to <strong>inactive</strong>.
          </p>
          <p className="instruction-text">
            For security, a Master Admin must verify and activate your account before you can access the workspace.
          </p>
          <div className="support-notice">
            <svg 
              width="16" 
              height="16" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              style={{ opacity: 0.6 }}
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span>If you believe this is in error, please contact your operations manager.</span>
          </div>
        </div>

        <button onClick={onLogout} className="halo-button logout-btn">
          Sign Out & Return
        </button>
      </div>
    </div>
  );
};

export default PendingActivation;
