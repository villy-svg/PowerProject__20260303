import React, { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { leaveService } from '../services/leaveService';

/**
 * Modal to submit a new leave request.
 * Contains logic to calculate days and handle the 2-day advance notice rule.
 */
export const LeaveApplicationModal = ({ isOpen, onClose, onSubmit, maxBalance = {}, employeeId }) => {
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [reason, setReason] = useState('');
  const [leaveType, setLeaveType] = useState('SL');
  const [daysRequested, setDaysRequested] = useState(0);
  const [isCalculating, setIsCalculating] = useState(false);

  // Fetch default leave type based on policy
  useEffect(() => {
    if (isOpen && employeeId) {
      leaveService.getDefaultLeaveType(employeeId).then(defaultType => {
        setLeaveType(defaultType);
      });
    }
  }, [isOpen, employeeId]);

  useEffect(() => {
    const fetchDays = async () => {
      if (!startDate || !endDate || !employeeId) {
        setDaysRequested(0);
        return;
      }
      setIsCalculating(true);
      try {
        const pad = (n) => n.toString().padStart(2, '0');
        const startStr = `${startDate.getFullYear()}-${pad(startDate.getMonth() + 1)}-${pad(startDate.getDate())}`;
        const endStr = `${endDate.getFullYear()}-${pad(endDate.getMonth() + 1)}-${pad(endDate.getDate())}`;
        
        const actual = await leaveService.calculateActualLeaveDays(employeeId, startStr, endStr);
        setDaysRequested(actual);
      } catch (err) {
        console.error("Failed to calculate days:", err);
      } finally {
        setIsCalculating(false);
      }
    };
    fetchDays();
  }, [startDate, endDate, employeeId]);

  const currentTypeBalance = maxBalance[leaveType] || 0;
  const isOverBalance = daysRequested > currentTypeBalance;

  // Early return AFTER all state declarations and derived values — safe per React Rules of Hooks
  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (daysRequested <= 0) return alert('Invalid date range');
    
    // Check 2-day advance notice rule
    const today = new Date();
    today.setHours(0,0,0,0);
    
    const diffToStart = Math.ceil((startDate - today) / (1000 * 60 * 60 * 24));
    const status = diffToStart < 2 ? 'FLAGGED_FOR_REVIEW' : 'PENDING';

    const formatDateStr = (d) => {
      const pad = (n) => n.toString().padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    };

    onSubmit({
      start_date: formatDateStr(startDate),
      end_date: formatDateStr(endDate),
      days_requested: daysRequested,
      reason,
      status,
      leaveType
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
      <style>{`
        .leave-modal-datepicker {
          background: transparent;
          border: none;
          color: var(--text-color);
          width: 100%;
          font-weight: 600;
          font-size: 0.95rem;
          outline: none;
          padding: 0 12px;
          height: 44px;
        }
      `}</style>
      <div style={modalBodyStyle}>
        <h2 style={{ marginTop: 0, marginBottom: '24px' }}>Apply for Leave</h2>
        
        <form onSubmit={handleSubmit}>
          
          <div style={formGroupStyle}>
            <label style={labelStyle}>Leave Type</label>
            <div style={{ ...inputContainerStyle, padding: 0 }}>
              <select 
                value={leaveType}
                onChange={e => setLeaveType(e.target.value)}
                style={{ ...inputStyle, padding: '0 12px', height: '100%', cursor: 'pointer' }}
                required
              >
                <option value="PL">Privilege Leave (PL)</option>
                <option value="CL">Casual Leave (CL)</option>
                <option value="SL">Sick Leave (SL)</option>
                <option value="COMP_OFF">Compensatory Off (COMP_OFF)</option>
              </select>
            </div>
          </div>

          <div style={formGroupStyle}>
            <label style={labelStyle}>Start Date</label>
            <div style={{ ...inputContainerStyle, padding: 0 }}>
              <DatePicker 
                selected={startDate}
                onChange={date => setStartDate(date)}
                selectsStart
                startDate={startDate}
                endDate={endDate}
                dateFormat="dd MMM yyyy"
                placeholderText="Select start date"
                className="leave-modal-datepicker"
                required
              />
            </div>
          </div>

          <div style={formGroupStyle}>
            <label style={labelStyle}>End Date</label>
            <div style={{ ...inputContainerStyle, padding: 0 }}>
              <DatePicker 
                selected={endDate}
                onChange={date => setEndDate(date)}
                selectsEnd
                startDate={startDate}
                endDate={endDate}
                minDate={startDate}
                dateFormat="dd MMM yyyy"
                placeholderText="Select end date"
                className="leave-modal-datepicker"
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
          <div style={{ marginBottom: '24px', fontSize: '0.9rem', color: isOverBalance ? 'var(--brand-orange, #f97316)' : 'inherit' }}>
            <strong>Days Requested:</strong> {isCalculating ? 'Calculating...' : daysRequested} 
            {isOverBalance && !isCalculating && <span> (Exceeds available balance of {Number(currentTypeBalance).toFixed(1)}. This will result in a negative balance.)</span>}
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
              disabled={daysRequested <= 0 || isCalculating}
              style={{
                opacity: (daysRequested <= 0 || isCalculating) ? 0.5 : 1,
                cursor: (daysRequested <= 0 || isCalculating) ? 'not-allowed' : 'pointer'
              }}
            >
              {isCalculating ? 'Calculating...' : 'Submit Request'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
