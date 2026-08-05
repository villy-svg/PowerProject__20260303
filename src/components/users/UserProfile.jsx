// @prod-critical
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Capacitor } from '@capacitor/core';
import { VERTICAL_LIST } from '../../constants/verticals';
import { ROLE_LIST } from '../../constants/roles';
import BankChangeRequestModal from './BankChangeRequestModal';
import { useOTAContext } from '../../app/contexts/OTAContext';
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

  const { updateAvailable } = useOTAContext();

  const closeMenu = () => {
    setIsOpen(false);
    setTimeout(() => {
      setMenuView('main');
      setSearchQuery('');
    }, 200);
  };

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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>Bank Details</span>
                    {isBankUpdatePending && (
                      <span className="ui-badge warning" style={{ fontSize: '0.7rem', padding: '2px 6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        ⏳ Pending
                      </span>
                    )}
                  </div>
                  {(user?.employeeId || user?.bankDetails) && (
                    <button 
                      className="dropdown-action-btn" 
                      onClick={() => setShowBankChangeModal(true)}
                      disabled={isBankUpdatePending}
                      style={{ opacity: isBankUpdatePending ? 0.5 : 1 }}
                    >
                      Update
                    </button>
                  )}
                </div>
                <div className="dropdown-static-content">
                  {user?.bankDetails ? (
                    <div className="bank-info-grid">
                      <span className="bank-label">A/C Name</span>
                      <span className="bank-value">{user.bankDetails.accountName || 'N/A'}</span>
                      <span className="bank-label">A/C No</span>
                      <span className="bank-value">{user.bankDetails.accountNumber || 'N/A'}</span>
                      <span className="bank-label">IFSC</span>
                      <span className="bank-value">{user.bankDetails.ifscCode || 'N/A'}</span>
                    </div>
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

              {updateAvailable && (
                <button
                  className="dropdown-item update-item"
                  onClick={() => closeMenu()}
                >
                  <span className="update-dot" />
                  Update App Available
                </button>
              )}

              <button className="dropdown-item" onClick={() => { onConfigClick(); closeMenu(); }}>
                Configuration
              </button>

              <button className="dropdown-item" onClick={() => { onLogout(); closeMenu(); }}>
                Log Out
              </button>
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
          onClose={() => setShowBankChangeModal(false)}
          onSuccess={() => {
            setShowBankChangeModal(false);
            closeMenu();
            alert('Bank update request submitted successfully.');
          }}
        />
      )}
    </div>
  );
};

export default UserProfile;