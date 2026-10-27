// @prod-critical
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Capacitor } from '@capacitor/core';
import { VERTICAL_LIST } from '../../constants/verticals';
import { ROLE_LIST } from '../../constants/roles';
import { APP_VERSION } from '../../constants/appVersion';
import { otaUpdateService } from '../../services/core/otaUpdateService';
import BankChangeRequestModal from './BankChangeRequestModal';
import { useOTAContext } from '../../app/contexts/OTAContext';
import { useBackButtonClose } from '../../app/contexts/AppNavigationContext';
import { useIsMobile } from '../../hooks/useIsMobile';
import { supabase } from '../../services/core/supabaseClient';
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
  const [menuView, setMenuView] = useState('main'); // 'main' | 'impersonate'
  const [searchQuery, setSearchQuery] = useState('');
  const [showBankHint, setShowBankHint] = useState(false);
  const [showBankChangeModal, setShowBankChangeModal] = useState(false);
  const [isBankUpdatePending, setIsBankUpdatePending] = useState(false);
  const dropdownRef = useRef(null);

  const {
    updateAvailable,
    updateVersion,
    downloadComplete,
    isChecking,
    isApplying,
    manualCheckStatus,
    checkForUpdate,
  } = useOTAContext() || {};

  const { isMobile } = useIsMobile();

  // Always show "Update App" for phone/mobile users (native APK + mobile viewport in browser/dev) or if an update was detected
  const showUpdateButton = Boolean(Capacitor.isNativePlatform() || isMobile || updateAvailable);

  const getUpdateButtonClass = () => {
    if (updateAvailable) return 'dropdown-item update-item';
    if (isChecking) return 'dropdown-item update-item--checking';
    if (manualCheckStatus === 'up_to_date') return 'dropdown-item update-item--up-to-date';
    if (manualCheckStatus === 'error') return 'dropdown-item update-item--error';
    return 'dropdown-item update-item--idle';
  };

  const getUpdateButtonLabel = () => {
    if (downloadComplete) {
      return updateVersion ? `Restart to Update (v${updateVersion})` : 'Restart to Update';
    }
    if (isApplying) {
      return updateVersion ? `Downloading Update (v${updateVersion})…` : 'Downloading Update…';
    }
    if (updateAvailable) {
      return updateVersion ? `Update App Available (v${updateVersion})` : 'Update App Available';
    }
    if (isChecking) {
      return 'Checking for Updates…';
    }
    if (manualCheckStatus === 'up_to_date') {
      return `✓ App is Up to Date (v${APP_VERSION})`;
    }
    if (manualCheckStatus === 'error') {
      return 'Update Check Failed — Tap to Retry';
    }
    return 'Update App';
  };

  const closeMenu = () => {
    setIsOpen(false);
    setTimeout(() => {
      setMenuView('main');
      setSearchQuery('');
    }, 200);
  };

  useBackButtonClose(isOpen, closeMenu);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        closeMenu();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!user?.employeeId) return;

    const checkPendingBankTask = async () => {
      try {
        const { data, error } = await supabase
          .from('tasks')
          .select('id')
          .eq('text', `Bank Update Request: ${user.name}`)
          .eq('stage_id', 'REVIEW')
          .limit(1);
          
        if (error) throw error;
        setIsBankUpdatePending(data && data.length > 0);
      } catch (err) {
        console.error("Error checking pending bank task:", err);
      }
    };
    
    checkPendingBankTask();
  }, [user?.employeeId, user?.name, showBankChangeModal]);

  useEffect(() => {
    if (window.innerWidth <= 768) {
      setShowBankHint(true);
    }
  }, []);

  const displayName = user?.name || "Guest User";
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .map(n => n[0])
    .join('')
    .toUpperCase();

  const handleToggleClick = () => {
    if (!isOpen) {
      setIsOpen(true);
      if (showBankHint) setShowBankHint(false);
    } else {
      closeMenu();
    }
  };

  const filteredImpersonationUsers = useMemo(() => {
    if (!impersonationUsers) return [];
    if (!searchQuery) return impersonationUsers;
    const q = searchQuery.toLowerCase();
    return impersonationUsers.filter(u => 
      (u.name || '').toLowerCase().includes(q) || 
      (u.role_id || '').toLowerCase().includes(q)
    );
  }, [impersonationUsers, searchQuery]);

  return (
    <div className="user-profile-container" ref={dropdownRef}>
      <button className="user-profile-toggle" onClick={handleToggleClick}>
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
          {menuView === 'main' ? (
            <>
              <div className="dropdown-user-info">
                <div className="dropdown-user-details">
                  <span className="dropdown-user-name">{displayName}</span>
                  <span className="dropdown-user-role">
                    {user?.roleId ? user.roleId.replace('_', ' ').toUpperCase() : 'GUEST'}
                  </span>
                  {(user?.department || user?.employeeRole) && (
                    <span className="dropdown-user-employee-role">
                      {[
                        user?.department, 
                        user?.employeeRole ? user.employeeRole.replace('_', ' ').toUpperCase() : null
                      ].filter(Boolean).join(' • ')}
                    </span>
                  )}
                </div>
              </div>

              <div className="dropdown-divider" />

              <div className="dropdown-section">
                <div className="dropdown-section-header">
                  <div className="bank-section-title-row">
                    <span>Bank Details</span>
                    {isBankUpdatePending && (
                      <span className="ui-badge warning">
                        ⏳ Pending
                      </span>
                    )}
                  </div>
                  {(user?.employeeId || user?.bankDetails) && (
                    <button 
                      className="dropdown-action-btn" 
                      onClick={() => setShowBankChangeModal(true)}
                      disabled={isBankUpdatePending}
                    >
                      Update
                    </button>
                  )}
                </div>
                <div className="dropdown-static-content">
                  {user?.bankDetails ? (
                    <>
                      <div className="bank-info-grid">
                        <span className="bank-label">A/C Name</span>
                        <span className="bank-value">{user.bankDetails.accountName || 'N/A'}</span>
                        <span className="bank-label">A/C No</span>
                        <span className="bank-value">{user.bankDetails.accountNumber || 'N/A'}</span>
                        <span className="bank-label">IFSC</span>
                        <span className="bank-value">{user.bankDetails.ifscCode || 'N/A'}</span>
                      </div>
                      {/* Show inline pending status below account details — confirms submission to the user */}
                      {isBankUpdatePending && (
                        <div className="bank-pending-status">⏳ Submitted for Approval</div>
                      )}
                    </>
                  ) : (
                    <span className="text-muted">No linked bank account.</span>
                  )}
                </div>
              </div>

              {realUser?.roleId === 'master_admin' && (
                <>
                  <div className="dropdown-divider" />
                  <div className="dropdown-section">
                    <div className="dropdown-section-header">Admin Tools</div>
                    {impersonatedUser ? (
                      <button 
                        className="dropdown-item destructive"
                        onClick={() => { onImpersonate(null); closeMenu(); }}
                      >
                        Stop Simulating {impersonatedUser.name}
                      </button>
                    ) : (
                      <button 
                        className="dropdown-item nav-item"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuView('impersonate');
                        }}
                      >
                        <span>Simulate User</span>
                        <svg className="chevron-right" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                      </button>
                    )}
                  </div>
                </>
              )}

              <div className="dropdown-divider" />

              {showUpdateButton && (
                <button
                  className={getUpdateButtonClass()}
                  disabled={Boolean(isChecking || isApplying)}
                  onClick={() => {
                    // If bundle already downloaded → close menu and restart immediately into new version
                    if (downloadComplete) {
                      closeMenu();
                      otaUpdateService.restartNow();
                    } else if (!isChecking && !isApplying && typeof checkForUpdate === 'function') {
                      // Force an immediate check (bypasses 1-hour throttle); keep menu open for inline status
                      checkForUpdate({ force: true });
                    }
                  }}
                >
                  {updateAvailable ? (
                    <span className="update-dot" />
                  ) : (
                    <svg
                      className={`update-icon ${isChecking ? 'update-icon--spinning' : ''}`}
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3" />
                    </svg>
                  )}
                  <span>{getUpdateButtonLabel()}</span>
                </button>
              )}

              <button className="dropdown-item" onClick={() => { onConfigClick(); closeMenu(); }}>
                Configuration
              </button>

              <button 
                className="dropdown-item" 
                onClick={async () => { 
                  closeMenu();
                  if ('caches' in window) {
                    try {
                      const keys = await caches.keys();
                      await Promise.all(keys.map(key => caches.delete(key)));
                    } catch (e) { console.error(e); }
                  }
                  window.location.reload(true); 
                }}
              >
                Hard Refresh
              </button>

              <button className="dropdown-item" onClick={() => { onLogout(); closeMenu(); }}>
                Log Out
              </button>

              {/* App version — shown at the bottom so support can verify which build a user is running */}
              <div className="dropdown-version">v{APP_VERSION}</div>
            </>
          ) : (
            <>
              <div className="dropdown-header-nav">
                <button className="back-btn" onClick={() => setMenuView('main')}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                  Back
                </button>
                <span className="title">Simulate User</span>
              </div>
              <div className="dropdown-search-box">
                <input 
                  type="text" 
                  placeholder="Search users..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="dropdown-scroll-list">
                {filteredImpersonationUsers.map(u => (
                  <button 
                    key={u.id}
                    className="dropdown-item user-select-item"
                    onClick={() => { onImpersonate(u.id); closeMenu(); }}
                  >
                    <div className="user-select-info">
                      <span className="user-name">{u.name}</span>
                      <span className="user-role-sub">{u.role_id}</span>
                    </div>
                  </button>
                ))}
                {filteredImpersonationUsers.length === 0 && (
                  <div className="empty-search">No users found</div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {showBankChangeModal && (
        <BankChangeRequestModal 
          user={user}
          isBankUpdatePending={isBankUpdatePending}
          onClose={() => setShowBankChangeModal(false)}
          onSuccess={() => {
            // Success confirmation is shown inside the modal — just close it here.
            // No alert(), no auto-close of dropdown — user can see "Submitted for Approval" in bank section.
            setShowBankChangeModal(false);
          }}
        />
      )}
    </div>
  );
};

export default UserProfile;
