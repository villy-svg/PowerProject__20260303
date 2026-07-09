import React, { useState } from 'react';

/**
 * Modal to submit a new leave request.
 * Contains logic to calculate days and handle the 2-day advance notice rule.
 */
export const LeaveApplicationModal = ({ isOpen, onClose, onSubmit, maxBalance = 0 }) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');

  // Calculate working days (simple version, assuming every day is 1 day for now)
  // In a real system, we'd use a date-fns library to skip weekends, but for this sample,
  // we do simple math.
  const calculateDays = () => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = end - start;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end days
    return diffDays > 0 ? diffDays : 0;
  };

  const daysRequested = calculateDays();
  const isOverBalance = daysRequested > maxBalance;

  // Early return AFTER all state declarations and derived values — safe per React Rules of Hooks
  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (daysRequested <= 0) return alert('Invalid date range');
    
    // Check 2-day advance notice rule
    const today = new Date();
    today.setHours(0,0,0,0);
    const start = new Date(startDate);
    
    const diffToStart = Math.ceil((start - today) / (1000 * 60 * 60 * 24));
    const status = diffToStart < 2 ? 'FLAGGED_FOR_REVIEW' : 'PENDING';

    onSubmit({
      start_date: startDate,
      end_date: endDate,
      days_requested: daysRequested,
      reason,
      status
    });
  };

  // Inline styling for the "Block-in-a-Box" and Modal specifications
  const overlayStyle = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999
  };

  const modalBodyStyle = {
    background: 'var(--bg-color)',
    borderRadius: 'var(--radius-squircle, 24px)',
    border: '1px solid var(--border-color)',
    padding: '24px',
    width: '90%',
    maxWidth: '500px',
    color: 'var(--text-color)',
    boxShadow: 'var(--shadow-premium, 0 12px 40px rgba(0,0,0,0.2))'
  };

  const formGroupStyle = {
    background: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid var(--border-color)',
    borderRadius: '12px',
    padding: '14px',
    marginBottom: '16px'
  };

  const labelStyle = {
    display: 'block',
    textTransform: 'uppercase',
    opacity: 0.5,
    fontWeight: 800,
    fontSize: '0.75rem',
    marginBottom: '8px'
  };

  const inputContainerStyle = {
    background: 'var(--halo-bg)',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    minHeight: '44px',
    display: 'flex',
    alignItems: 'center',
    padding: '0 12px'
  };

  const inputStyle = {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-color)',
    width: '100%',
    fontWeight: 600,
    fontSize: '0.95rem',
    outline: 'none'
  };

  return (
    <div style={overlayStyle}>
      <div style={modalBodyStyle}>
        <h2 style={{ marginTop: 0, marginBottom: '24px' }}>Apply for Leave</h2>
        
        <form onSubmit={handleSubmit}>
          
          <div style={formGroupStyle}>
            <label style={labelStyle}>Start Date</label>
            <div style={inputContainerStyle}>
              <input 
                type="date" 
                style={inputStyle}
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div style={formGroupStyle}>
            <label style={labelStyle}>End Date</label>
            <div style={inputContainerStyle}>
              <input 
                type="date" 
                style={inputStyle}
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div style={formGroupStyle}>
            <label style={labelStyle}>Reason (Optional)</label>
            <div style={{...inputContainerStyle, minHeight: '80px', padding: '12px'}}>
              <textarea 
                style={{...inputStyle, height: '100%', resize: 'none'}}
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Going on vacation..."
              />
            </div>
          </div>

          {/* Validation Feedback */}
          <div style={{ marginBottom: '24px', fontSize: '0.9rem', color: isOverBalance ? 'var(--status-danger, #f43f5e)' : 'inherit' }}>
            <strong>Days Requested:</strong> {daysRequested} 
            {isOverBalance && <span> (Exceeds available balance of {maxBalance})</span>}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button 
              type="button" 
              onClick={onClose}
              style={{
                background: 'transparent', 
                border: 'none', 
                color: 'var(--text-color)',
                cursor: 'pointer',
                fontWeight: 600,
                padding: '8px 16px'
              }}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="halo-button"
              disabled={isOverBalance || daysRequested <= 0}
              style={{
                opacity: (isOverBalance || daysRequested <= 0) ? 0.5 : 1,
                cursor: (isOverBalance || daysRequested <= 0) ? 'not-allowed' : 'pointer'
              }}
            >
              Submit Request
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
