import React, { useState, useEffect } from 'react';
import { supabase } from '../../../services/core/supabaseClient';
import './LeaveDashboard.css';

export const UpdateWalletBalanceModal = ({ isOpen, onClose, onSubmit }) => {
  const [employees, setEmployees] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchEmployees();
      // Reset form
      setSelectedEmployeeId('');
      setAmount('');
      setDescription('');
    }
  }, [isOpen]);

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('id, full_name, emp_code')
        .eq('status', 'Active')
        .order('full_name', { ascending: true });
        
      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error('Error fetching employees for modal:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedEmployeeId || !amount || isNaN(amount) || amount == 0) {
      alert('Please fill out all fields correctly.');
      return;
    }

    setIsLoading(true);
    try {
      await onSubmit(selectedEmployeeId, Number(amount), description || 'Manual Adjustment');
      onClose();
    } catch (error) {
      console.error('Adjustment failed:', error);
      alert('Adjustment failed: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="leave-modal-overlay">
      <div className="leave-modal-content">
        <div className="leave-modal-header">
          <h2>Update Wallet Balance</h2>
          <button className="leave-modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="leave-modal-form">
          <div className="leave-form-group">
            <label>Select Employee</label>
            <select
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              required
            >
              <option value="" disabled>Select an employee...</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.full_name} ({emp.emp_code})
                </option>
              ))}
            </select>
          </div>

          <div className="leave-form-group">
            <label>Amount (Days)</label>
            <input
              type="number"
              step="0.5"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 5 (credit) or -2 (debit)"
              required
            />
            <small style={{ color: 'var(--text-tertiary)', marginTop: '4px', display: 'block' }}>
              Use positive numbers to add days, negative to deduct.
            </small>
          </div>

          <div className="leave-form-group">
            <label>Reason / Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Annual rollover, manual correction..."
              rows={3}
              required
            />
          </div>

          <div className="leave-modal-actions">
            <button type="button" className="halo-button secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="halo-button" disabled={isLoading}>
              {isLoading ? 'Updating...' : 'Update Balance'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
