import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import powerLogo from '../assets/logo.svg';
import './Login.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState(1); // 1: Email, 2: OTP
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setMessage({ type: '', text: '' });

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
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
          <form className="login-form" onSubmit={handleSendOtp}>
            <h2>Sign In</h2>
            <p className="login-subtitle">Enter your email to receive a secure OTP.</p>
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
            <button type="submit" className="login-button" disabled={loading}>
              {loading ? 'Sending OTP...' : 'Send OTP'}
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
              Back to Email
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default Login;
