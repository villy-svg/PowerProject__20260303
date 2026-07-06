import React, { useState } from 'react';
import { supabase } from '../../services/core/supabaseClient';
import { taskService } from '../../services/tasks/taskService';
import './BankChangeRequestModal.css';

const BankChangeRequestModal = ({ user, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    accountName: user?.bankDetails?.accountName || '',
    accountNumber: user?.bankDetails?.accountNumber || '',
    ifscCode: user?.bankDetails?.ifscCode || '',
    panNumber: user?.bankDetails?.panNumber || '',
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user?.employeeId) {
      setError("No employee ID associated with this user.");
      return;
    }
    
    setIsSubmitting(true);
    setError('');
    
    try {
      // Find all master_admin employees to assign the task to
      const { data: admins, error: adminsError } = await supabase
        .from('user_profiles')
        .select('employee_id')
        .eq('role_id', 'master_admin')
        .not('employee_id', 'is', null);
        
      if (adminsError) throw adminsError;
      
      const assigneeIds = admins?.map(a => a.employee_id) || [];
      
      const payload = {
        type: 'BANK_UPDATE',
        employeeId: user.employeeId,
        oldDetails: {
          accountName: user.bankDetails?.accountName || '',
          accountNumber: user.bankDetails?.accountNumber || '',
          ifscCode: user.bankDetails?.ifscCode || '',
          panNumber: user.bankDetails?.panNumber || '',
        },
        newDetails: formData,
        requestedBy: user.name,
      };

      // Create a BANK_UPDATE task on the Escalations board
      await taskService.addTask({
        text: `Bank Update Request: ${user.name}`,
        verticalId: 'EMPLOYEES',
        stageId: 'REVIEW',
        priority: 'High',
        task_board: ['Escalations'],
        function: 'EMP',
        description: JSON.stringify(payload),
        assigned_to: assigneeIds.length > 0 ? assigneeIds : null,
      });

      onSuccess();
    } catch (err) {
      console.error("Error submitting bank change request:", err);
      setError("Failed to submit request. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bank-change-modal-overlay">
      <div className="bank-change-modal">
        <div className="bank-change-modal-header">
          <h3>Request Bank Details Change</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <form onSubmit={handleSubmit} className="bank-change-form">
          <p className="bank-change-hint">
            Changes to your bank details require approval from a Master Admin. 
            Once submitted, your request will be reviewed.
          </p>

          {error && <div className="bank-change-error">{error}</div>}

          <div className="form-group">
            <label>Account Name</label>
            <input
              type="text"
              name="accountName"
              value={formData.accountName}
              onChange={handleChange}
              placeholder="Name on bank account"
              required
            />
          </div>

          <div className="form-group">
            <label>Account Number</label>
            <input
              type="text"
              name="accountNumber"
              value={formData.accountNumber}
              onChange={handleChange}
              placeholder="Bank account number"
              required
            />
          </div>

          <div className="form-group">
            <label>IFSC Code</label>
            <input
              type="text"
              name="ifscCode"
              value={formData.ifscCode}
              onChange={handleChange}
              placeholder="IFSC Code"
              required
            />
          </div>

          <div className="form-group">
            <label>PAN Number</label>
            <input
              type="text"
              name="panNumber"
              value={formData.panNumber}
              onChange={handleChange}
              placeholder="PAN Number"
              required
            />
          </div>

          <div className="bank-change-actions">
            <button type="button" className="halo-button secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="halo-button" disabled={isSubmitting}>
              {isSubmitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BankChangeRequestModal;
