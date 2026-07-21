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

  return (
    <div className="leave-modal-overlay">
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
      <div className="leave-modal-body">
        <h2 className="u-mt-0 u-mb-24">Apply for Leave</h2>
        
        <form onSubmit={handleSubmit}>
          
          <div className="leave-modal-form-group">
            <label className="leave-modal-label">Leave Type</label>
            <div className="leave-modal-input-container u-p-0">
              <select 
                value={leaveType}
                onChange={e => setLeaveType(e.target.value)}
                className="leave-modal-input u-px-12 u-h-100p u-cursor-pointer"
                required
              >
                <option value="PL">Privilege Leave (PL)</option>
                <option value="CL">Casual Leave (CL)</option>
                <option value="SL">Sick Leave (SL)</option>
                <option value="COMP_OFF">Compensatory Off (COMP_OFF)</option>
              </select>
            </div>
          </div>

          <div className="leave-modal-form-group">
            <label className="leave-modal-label">Start Date</label>
            <div className="leave-modal-input-container u-p-0">
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

          <div className="leave-modal-form-group">
            <label className="leave-modal-label">End Date</label>
            <div className="leave-modal-input-container u-p-0">
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

          <div className="leave-modal-form-group">
            <label className="leave-modal-label">Reason (Optional)</label>
            <div className="leave-modal-input-container u-min-h-80 u-p-12">
              <textarea 
                className="leave-modal-input u-h-100p u-resize-none"
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Going on vacation..."
              />
            </div>
          </div>

          {/* Validation Feedback */}
          <div className="u-mb-24 u-text-sm" style={{ color: isOverBalance ? 'var(--brand-orange, #f97316)' : 'inherit' }}>
            <strong>Days Requested:</strong> {isCalculating ? 'Calculating...' : daysRequested} 
            {isOverBalance && !isCalculating && <span> (Exceeds available balance of {Number(currentTypeBalance).toFixed(1)}. This will result in a negative balance.)</span>}
          </div>

          <div className="u-flex-end-gap-12">
            <button 
              type="button" 
              onClick={onClose}
              className="btn-text"
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
