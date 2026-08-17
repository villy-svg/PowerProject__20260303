import React, { useState } from 'react';
import { supabase } from '../../services/core/supabaseClient';
import { useAuth } from '../../app/contexts/AuthContext';
import powerLogo from '../../assets/logo.svg';
import './ProfileNameSetup.css';

/**
 * ProfileNameSetup
 * Shown as a gate in AppShell when a user has registered without providing a name.
 * Captures the name, persists it to both Supabase Auth user_metadata and the
 * user_profiles table, then refreshes the profile to lift the gate.
 */
const ProfileNameSetup = () => {
  const { user, fetchUserProfile, handleLogout } = useAuth();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;

    setLoading(true);
    setError('');

    try {
      // 1. Update Supabase Auth user_metadata
      await supabase.auth.updateUser({ data: { name: trimmedName } });

      // 2. Update the user_profiles table (source of truth for profileService)
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ name: trimmedName })
        .eq('id', user.id);

      if (updateError) throw updateError;

      // 3. Refresh the profile in AuthContext — re-evaluates needsNameSetup
      //    and removes this gate, allowing the user into the app.
      await fetchUserProfile(user.id);
    } catch (err) {
      console.error('[ProfileNameSetup] Failed to save name:', err);
      setError('Could not save your name. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="profile-setup-container">
      <div className="profile-setup-card">
        <div className="profile-setup-header">
          <img src={powerLogo} alt="PowerProject Logo" className="logo-svg-large" />
          <h1 className="brand-title">PowerProject</h1>
        </div>

        <div className="profile-setup-content">
          <div className="setup-badge">
            <span className="setup-badge-dot" />
            <span className="setup-badge-text">Account Setup</span>
          </div>

          <h2>What should we call you?</h2>
          <p>Enter your full name to complete your account. This will be visible to your team.</p>

          {error && <p className="setup-error">{error}</p>}

          <form onSubmit={handleSubmit} className="setup-form">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alex Rivera"
              className="setup-name-input"
              autoFocus
              autoComplete="name"
              required
            />
            <button
              type="submit"
              className="setup-submit-btn"
              disabled={loading || !name.trim()}
            >
              {loading ? 'Saving...' : 'Continue to PowerProject ?'}
            </button>
          </form>
        </div>

        <button onClick={handleLogout} className="setup-logout-btn">
          Sign Out
        </button>
      </div>
    </div>
  );
};

export default ProfileNameSetup;
