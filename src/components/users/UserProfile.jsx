import React, { useState, useRef, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { VERTICAL_LIST } from '../../constants/verticals';
import { ROLE_LIST } from '../../constants/roles';
import CustomSelect from '../ui/CustomSelect';
import BankChangeRequestModal from './BankChangeRequestModal';
import { useOTAContext } from '../../app/contexts/OTAContext';
import './UserProfile.css';

const UserProfile = ({ 
  user, 
  onRoleChange, 
  onConfigClick, 
  onLogout,
  realUser,
  impersonatedUser,
  impersonationUsers,
  onImpersonate,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showBankHint, setShowBankHint] = useState(false);
  const [showBankChangeModal, setShowBankChangeModal] = useState(false);
  const dropdownRef = useRef(null);

  // OTA update state — consumed from context, no prop drilling needed
  const { updateAvailable } = useOTAContext();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Show bank hint on mobile
  useEffect(() => {
    if (window.innerWidth <= 768) {
      setShowBankHint(true);
    }
  }, []);

  const roles = ROLE_LIST;

  const handleRoleSelect = (roleId) => {
    // If switching to a vertical role, we default to the first vertical if none assigned
    const defaultVertical = (roleId.includes('vertical') && !user.assignedVertical) 
      ? VERTICAL_LIST[0].id 
      : user.assignedVertical;

    onRoleChange(roleId, defaultVertical);
  };

  const handleVerticalSelect = (vId) => {
    onRoleChange(user.roleId, vId);
  };

  const displayName = user?.name || "Guest User";
  // Updated initials logic to handle single names or empty strings safely
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .map(n => n[0])
    .join('')
    .toUpperCase();

  const isVerticalRole = user?.roleId === 'vertical_admin' || user?.roleId === 'vertical_viewer';

  const handleToggleClick = () => {
    setIsOpen(!isOpen);
    if (showBankHint) {
      setShowBankHint(false);
    }
  };

  return (
    <div className="user-profile-container" ref={dropdownRef}>
      <button className="user-profile-toggle" onClick={handleToggleClick}>
        {/* WRAPPER FOR TEXT: This div is styled in CSS to stack vertically */}
        <div className="user-info-text">
          <span className="user-name">{displayName}</span>
          <span className="user-role">{user?.role}</span>
        </div>
        <div className={`user-avatar ${showBankHint ? 'bank-hint-glow' : ''}`}>
          <svg 
            width="16" 
            height="16" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2.5" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
      </button>

      {showBankHint && !isOpen && (
        <div className="bank-details-hint-dialog" onClick={() => setShowBankHint(false)}>
          <div className="hint-pointer"></div>
          <span className="hint-text-en">Your Bank Details Here</span>
          <span className="hint-text-kn">ಬ್ಯಾಂಕ್ ವಿವರಗಳು ಇಲ್ಲಿ</span>
        </div>
      )}

      {isOpen && (
        <div className="user-dropdown-menu">
          {/* 1. Name */}
          <div className="dropdown-header">Name</div>
          <div className="dropdown-item static name-display">
            {displayName}
          </div>
          
          <div className="dropdown-divider" />

          {/* 2. Bank Details of User */}
          <div className="dropdown-header user-profile-bank-header">
            <span>Bank Details</span>
            {(user?.employeeId || user?.bankDetails) && (
              <button 
                className="bank-edit-btn" 
                onClick={() => setShowBankChangeModal(true)}
                title="Request Bank Details Update"
              >
                ✏️ Update
              </button>
            )}
          </div>
          <div className="dropdown-item static bank-details-display">
            {user?.bankDetails ? (
              <>
                <span><strong>Name:</strong> {user.bankDetails.accountName || 'N/A'}</span>
                <span><strong>A/C No:</strong> {user.bankDetails.accountNumber || 'N/A'}</span>
                <span><strong>IFSC:</strong> {user.bankDetails.ifscCode || 'N/A'}</span>
              </>
            ) : (
              <span className="bank-empty">No linked bank account.</span>
            )}
          </div>

          {/* OTA Update Button — shown below bank details on native platform when update is available */}
          {Capacitor.isNativePlatform() && updateAvailable && (
            <button
              id="profile-update-app-btn"
              className="dropdown-item update-app-btn"
              onClick={() => { setIsOpen(false); }}
            >
              <span className="update-app-btn__dot" aria-hidden="true" />
              Update App
            </button>
          )}

          <div className="dropdown-divider" />

          {/* 3. Employee Role */}
          <div className="dropdown-header">Employee Role</div>
          <div className="dropdown-item static">
            <span className="role-label">
              {user?.employeeRole ? user.employeeRole.replace('_', ' ').toUpperCase() : 'NO EMPLOYEE ROLE'}
            </span>
          </div>

          <div className="dropdown-divider" />

          {/* 4. User Role */}
          <div className="dropdown-header">User Role</div>
          <div className="dropdown-item static">
            <span className="role-label">
              {user?.roleId ? user.roleId.replace('_', ' ').toUpperCase() : 'GUEST'}
            </span>
          </div>

          {/* 5. Simulate User */}
          {realUser?.roleId === 'master_admin' && (
            <>
              <div className="dropdown-divider" />
              <div className="dropdown-header impersonation-section-title">Impersonation Simulator</div>
              <div className="dropdown-impersonation-container">
                {impersonatedUser ? (
                  <div className="impersonation-menu-active">
                    <span className="impersonation-menu-label">
                      Viewing: <strong>{impersonatedUser.name}</strong>
                    </span>
                    <button 
                      className="halo-button impersonation-menu-stop-btn" 
                      onClick={() => { onImpersonate(null); setIsOpen(false); }}
                    >
                      Stop Simulation
                    </button>
                  </div>
                ) : (
                  <CustomSelect
                    id="impersonation-select-menu"
                    placeholder="Simulate User..."
                    options={impersonationUsers?.map(u => ({
                      value: u.id,
                      label: `${u.name} (${u.role_id})`
                    })) || []}
                    onChange={(val) => { onImpersonate(val); setIsOpen(false); }}
                  />
                )}
              </div>
            </>
          )}

          <div className="dropdown-divider" />
          
          <button className="dropdown-item config-link" onClick={() => { onConfigClick(); setIsOpen(false); }}>
            Configuration
          </button>
          
          <button className="dropdown-item logout-button" onClick={() => { onLogout(); setIsOpen(false); }}>
            Log Out
          </button>
        </div>
      )}

      {showBankChangeModal && (
        <BankChangeRequestModal 
          user={user} 
          onClose={() => setShowBankChangeModal(false)}
          onSuccess={() => {
            setShowBankChangeModal(false);
            setIsOpen(false);
            alert('Bank update request submitted successfully.');
          }}
        />
      )}
    </div>
  );
};

export default UserProfile;