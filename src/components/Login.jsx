import React, { useState } from 'react';
import { supabase } from '../services/core/supabaseClient';
import powerLogo from '../assets/logo.svg';
import './Login.css';

const Login = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState(1); // 1: Form, 2: OTP
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const handleAuthAction = async (e) => {
    e.preventDefault();
    if (!email) return;
    if (isRegistering && !name) {
      setMessage({ type: 'error', text: 'Please enter your name to register.' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    // We use signInWithOtp for both.
    // If isRegistering, we pass the name in the data object for the Supabase Trigger.
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        data: isRegistering ? { name } : {}
      }
    });

    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      setMessage({ type: 'success', text: 'OTP sent! Please check your email.' });
      setStep(2);
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
                  <label>Full Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alex Rivera"
                    required
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
