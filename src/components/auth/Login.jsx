// @prod-critical
import React, { useState, useRef } from 'react';
import { supabase } from '../../services/core/supabaseClient';
import powerLogo from '../../assets/logo.svg';
import './Login.css';

const Login = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState(1); // 1: Form, 2: OTP
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Anti-Bot Measures
  const [honeypot, setHoneypot] = useState('');
  const mountTime = useRef(Date.now());

  const handleAuthAction = async (e) => {
    e.preventDefault();
    if (!email) return;

    // 1. Honeypot Check (bots fill this out)
    if (honeypot) {
      console.warn("Bot detected via honeypot.");
      return;
    }
    
    // 2. Time-Based Check (bots submit too fast - under 1500ms)
    if (Date.now() - mountTime.current < 1500) {
      console.warn("Bot detected via fast submission.");
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    if (isRegistering) {
      // FIX: Single API call. Supabase handles existing vs new users natively (upsert).
      // - If user is NEW: Supabase creates the account and sends an OTP.
      // - If user ALREADY EXISTS: Supabase skips creation, ignores the `name` payload,
      //   and sends a standard sign-in OTP. No error is thrown.
      // This eliminates the double API call that was causing rate limit hits and
      // inconsistent email template delivery (Confirm Signup vs Magic Link).
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          data: { name: name || '' }, // Passed for new users; silently ignored for existing ones
        }
      });

      if (error) {
        setMessage({ type: 'error', text: error.message });
      } else {
        // FIX: Neutral success message — covers both new registrations and existing users.
        setMessage({ type: 'success', text: 'OTP sent! Please check your email.' });
        setStep(2);
      }
    } else {
      // Sign-in flow: do not silently create new accounts
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false }
      });

      if (error) {
        if (error.message.includes('Signups not allowed')) {
          // FIX: Auto-switch to Register tab instead of showing a dead-end error.
          // The name field will now appear for the user to complete their registration.
          setIsRegistering(true);
          setMessage({ type: 'error', text: 'Account not found. Enter your Full Name below to create an account.' });
        } else {
          setMessage({ type: 'error', text: error.message });
        }
      } else {
        setMessage({ type: 'success', text: 'OTP sent! Please check your email.' });
        setStep(2);
      }
    }
    setLoading(false);
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otp) return;

    setLoading(true);
    setMessage({ type: '', text: '' });

    const { error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: 'email',
    });

    if (error) {
      setMessage({ type: 'error', text: error.message });
      setLoading(false);
    } else {
      setMessage({ type: 'success', text: 'Login successful!' });
      // App.jsx will handle navigation
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-logo">
          <img src={powerLogo} alt="PowerProject Logo" className="logo-svg-large" />
          <h1 className="brand-title">PowerProject</h1>
        </div>

        {message.text && (
          <div className={`login-message ${message.type}`}>
            {message.text}
          </div>
        )}

        {step === 1 ? (
          <form className="login-form" onSubmit={handleAuthAction}>
            <h2>{isRegistering ? 'Create Account' : 'Sign In'}</h2>
            <p className="login-subtitle">
              {isRegistering
                ? 'Welcome to PowerProject'
                : 'Enter your email to receive a secure OTP.'}
            </p>

            <div className="login-toggle">
              <button
                type="button"
                className={!isRegistering ? 'active' : ''}
                onClick={() => { setIsRegistering(false); setMessage({ type: '', text: '' }); }}
              >
                Sign In
              </button>
              <button
                type="button"
                className={isRegistering ? 'active' : ''}
                onClick={() => { setIsRegistering(true); setMessage({ type: '', text: '' }); }}
              >
                Register
              </button>
            </div>

            <div className="form-group-stack">
              {isRegistering && (
                <div className="form-group">
                  {/* FIX: 'required' removed — existing users are handled by Supabase's native upsert
                      and should not be blocked by a name gate. Name is used for new accounts only. */}
                  <label>Full Name {name === '' && <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>(new accounts)</span>}</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alex Rivera"
                    autoFocus
                  />
                </div>
              )}
              <div className="form-group">
                <label>Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="alex@example.com"
                  required
                />
              </div>

              {/* Bot Trap: Rendered behind the UI so bots see it, humans don't */}
              <input
                type="text"
                name="phone_number"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
                className="phone-vh"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
              />
            </div>

            <button type="submit" className="login-button" disabled={loading}>
              {loading ? 'Sending OTP...' : isRegistering ? 'Register' : 'Send OTP'}
            </button>
          </form>
        ) : (
          <form className="login-form" onSubmit={handleVerifyOtp}>
            <h2>Verify OTP</h2>
            <p className="login-subtitle">Enter the code sent to {email}.</p>
            <div className="form-group">
              <label>Security Code</label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="12345678"
                required
                maxLength={8}
              />
            </div>
            <button type="submit" className="login-button" disabled={loading}>
              {loading ? 'Verifying...' : 'Sign In'}
            </button>
            <button
              type="button"
              className="login-back-button"
              onClick={() => { setStep(1); setOtp(''); setMessage({ type: '', text: '' }); }}
              disabled={loading}
            >
              Back
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default Login;
