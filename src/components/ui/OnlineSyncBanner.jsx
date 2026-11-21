import React, { useState, useEffect } from 'react';
import {
  isOfflineBypassEnv,
  hasSyncedOfflineSnapshotThisSession,
  sendOfflineSnapshotOtp,
  syncLiveSnapshotToOfflineCache,
} from '../../services/core/offlineSnapshotService';
import './OnlineSyncBanner.css';

const OnlineSyncBanner = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [showAuthForm, setShowAuthForm] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const isBypassActive = isOfflineBypassEnv();

  useEffect(() => {
    // Only register online listener if in dev mode with offline bypass capability
    if (!isBypassActive) return;

    const handleOnlineStatusChange = () => {
      // Skip re-prompting if the user already pulled a fresh snapshot in this tab
      if (hasSyncedOfflineSnapshotThisSession()) return;

      // Check if we have cached offline bypass files in localStorage
      const hasOfflineCache = localStorage.getItem('power_project_user') || 
                              localStorage.getItem('powerpod_tasks_v5') ||
                              localStorage.getItem('powerpod_employee_rules_offline');
      
      if (navigator.onLine && hasOfflineCache) {
        setIsVisible(true);
      }
    };

    window.addEventListener('online', handleOnlineStatusChange);
    
    // Initial check in case internet connected immediately after initialization
    handleOnlineStatusChange();

    return () => {
      window.removeEventListener('online', handleOnlineStatusChange);
    };
  }, [isBypassActive]);

  if (!isVisible) return null;

  const runReadOnlySync = async (credentials = {}) => {
    setIsSyncing(true);
    setErrorMessage('');
    setStatusMessage('Pulling read-only snapshot from live database...');

    try {
      const summary = await syncLiveSnapshotToOfflineCache(credentials);
      setOtp('');
      setOtpSent(false);
      setShowAuthForm(false);
      setStatusMessage(
        `Synced ${summary.taskCount} tasks & ${summary.ruleCount} rules (read-only). Reloading...`
      );
      setTimeout(() => {
        window.location.reload();
      }, 900);
    } catch (err) {
      setStatusMessage('');
      if (err?.code === 'AUTH_REQUIRED') {
        // Prompt inline for Email OTP to satisfy RLS during the read-only pull
        setShowAuthForm(true);
      } else {
        setErrorMessage(err?.message || 'Failed to sync live snapshot.');
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleReconnect = () => {
    runReadOnlySync();
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setIsSyncing(true);
    setErrorMessage('');
    setStatusMessage('Sending OTP to your email...');
    try {
      await sendOfflineSnapshotOtp(email);
      setOtpSent(true);
      setStatusMessage('OTP sent! Check your email and enter the code below.');
    } catch (err) {
      setStatusMessage('');
      setErrorMessage(err?.message || 'Failed to send OTP.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleVerifyOtpSubmit = (e) => {
    e.preventDefault();
    runReadOnlySync({ email, otp });
  };

  const handleDismiss = () => {
    setIsVisible(false);
    setShowAuthForm(false);
    setOtpSent(false);
    setOtp('');
    setErrorMessage('');
    setStatusMessage('');
  };

  return (
    <div className="online-sync-banner-overlay">
      <div className="online-sync-banner">
        <div className="sync-banner-row">
          <div className="sync-banner-left">
            <span className="online-indicator-dot"></span>
            <p className="sync-banner-text">
              <strong>System Back Online!</strong> Pull fresh live data into your read-only offline sandbox? (Local edits will not affect Supabase.)
            </p>
          </div>
          <div className="sync-banner-right">
            <button
              type="button"
              className="halo-button dismiss-banner-btn"
              onClick={handleDismiss}
              disabled={isSyncing}
            >
              Keep Offline
            </button>
            <button
              type="button"
              className="halo-button reconnect-sync-btn"
              onClick={handleReconnect}
              disabled={isSyncing}
            >
              {isSyncing ? '⏳ Syncing...' : '🔌 Reconnect & Sync'}
            </button>
          </div>
        </div>

        {showAuthForm && !otpSent && (
          <form className="sync-banner-auth-form" onSubmit={handleSendOtp}>
            <input
              type="email"
              className="sync-banner-input"
              placeholder="Enter your PowerProject email for OTP"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isSyncing}
            />
            <button
              type="submit"
              className="halo-button reconnect-sync-btn"
              disabled={isSyncing}
            >
              {isSyncing ? 'Sending...' : 'Send OTP'}
            </button>
          </form>
        )}

        {showAuthForm && otpSent && (
          <form className="sync-banner-auth-form" onSubmit={handleVerifyOtpSubmit}>
            <input
              type="text"
              inputMode="numeric"
              className="sync-banner-input"
              placeholder={`Enter OTP sent to ${email}`}
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              required
              disabled={isSyncing}
            />
            <button
              type="button"
              className="halo-button dismiss-banner-btn"
              onClick={() => {
                setOtpSent(false);
                setOtp('');
                setErrorMessage('');
                setStatusMessage('');
              }}
              disabled={isSyncing}
            >
              Change Email
            </button>
            <button
              type="submit"
              className="halo-button reconnect-sync-btn"
              disabled={isSyncing}
            >
              {isSyncing ? 'Syncing...' : 'Verify & Pull'}
            </button>
          </form>
        )}

        {statusMessage && (
          <div className="sync-banner-feedback sync-banner-feedback--status">
            {statusMessage}
          </div>
        )}

        {errorMessage && (
          <div className="sync-banner-feedback sync-banner-feedback--error">
            {errorMessage}
          </div>
        )}
      </div>
    </div>
  );
};

export default OnlineSyncBanner;
