import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../services/core/supabaseClient';
import { taskService } from '../../services/tasks/taskService';
import '../../styles/ManagementForms.css';

const BankChangeRequestModal = ({ user, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    accountName: user?.bankDetails?.accountName || '',
    accountNumber: user?.bankDetails?.accountNumber || '',
    ifscCode: user?.bankDetails?.ifscCode || '',
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
        },
        newDetails: formData,
        requestedBy: user.name,
      };

      // Create a BANK_UPDATE task on the Escalations board
      await taskService.addTask({
        text: `Bank Update Request: ${user.name}`,
        verticalId: 'HUBS',
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

  return createPortal(
    <div className="modal-overlay u-z-999999">
      <div className="modal-content u-max-w-450">
        <div className="modal-header">
          <h2>Request Bank Details</h2>
          <button className="close-modal" onClick={onClose}>×</button>
        </div>
        
        <form onSubmit={handleSubmit} className="vertical-task-form">
          <div className="modal-content-area u-flex-col-gap-16">
            <p className="status-message u-bg-halo u-border-none u-text-primary u-opacity-80 u-m-0">
              Changes to your bank details require approval from a Master Admin. 
              Once submitted, your request will be reviewed.
            </p>

            {error && <div className="status-message error">{error}</div>}

            <div className="form-group">
              <label>Account Name</label>
              <div className="form-input-container">
                <input
                  type="text"
                  name="accountName"
                  value={formData.accountName}
                  onChange={handleChange}
                  placeholder="Name on bank account"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>Account Number</label>
              <div className="form-input-container">
                <input
                  type="tel"
                  name="accountNumber"
                  value={formData.accountNumber}
                  onChange={handleChange}
                  placeholder="Bank account number"
                  inputMode="numeric"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>IFSC Code</label>
              <div className="form-input-container">
                <input
                  type="text"
                  name="ifscCode"
                  value={formData.ifscCode}
                  onChange={handleChange}
                  placeholder="IFSC Code"
                  className="u-text-upper"
                  required
                />
              </div>
            </div>
          </div>

          <div className="modal-footer sticky">
            <button type="button" className="halo-button secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="halo-button" disabled={isSubmitting}>
              {isSubmitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default BankChangeRequestModal;
