import React, { useState } from 'react';
import { useAuth } from '../../app/contexts/AuthContext';
import { taskService } from '../../services/tasks/taskService';
import { employeeService } from '../../services/employees/employeeService';
import { IconCheck, IconX } from '../../components/ui/Icons';

/**
 * EmployeeTaskTile
 * Custom metadata injected into the master TaskCard for the Employee Manager.
 */
const EmployeeTaskTile = ({ task }) => {
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);

  let payload = null;
  if (task.description) {
    try {
      payload = JSON.parse(task.description);
    } catch (e) {
      console.error("Failed to parse task payload:", e);
    }
  }

  if (payload?.type === 'BANK_UPDATE') {

    const handleAccept = async (e) => {
      e.stopPropagation();
      setIsProcessing(true);
      try {
        await employeeService.bulkUpdateEmployees([payload.employeeId], {
          account_number: payload.newDetails.accountNumber,
          ifsc_code: payload.newDetails.ifscCode,
          account_name: payload.newDetails.accountName,
          pan_number: payload.newDetails.panNumber
        });
        await taskService.updateTaskStage(task.id, 'COMPLETED');
      } catch (err) {
        console.error("Accept failed", err);
        alert("Failed to accept bank details update.");
      } finally {
        setIsProcessing(false);
      }
    };

    const handleReject = async (e) => {
      e.stopPropagation();
      setIsProcessing(true);
      try {
        await taskService.updateTaskStage(task.id, 'REJECTED');
      } catch (err) {
        console.error("Reject failed", err);
        alert("Failed to reject bank details update.");
      } finally {
        setIsProcessing(false);
      }
    };

    return (
      <div className="hub-tile-meta u-flex-col-gap-8 u-w-full">
        <div className="u-text-sm u-text-secondary">
          Requested by: {payload.requestedByName}
        </div>
        <div className="bank-details-diff-container">
          <div className="u-flex-1">
            <strong>Old Details</strong>
            <div className="u-break-all">A/C: {payload.oldDetails.accountNumber || 'N/A'}</div>
            <div>IFSC: {payload.oldDetails.ifscCode || 'N/A'}</div>
            <div>Name: {payload.oldDetails.accountName || 'N/A'}</div>
            <div>PAN: {payload.oldDetails.panNumber || 'N/A'}</div>
          </div>
          <div className="u-flex-1 u-border-l-p8">
            <strong>New Details</strong>
            <div className="u-break-all" style={{ color: payload.newDetails.accountNumber !== payload.oldDetails.accountNumber ? 'var(--brand-green)' : 'inherit' }}>A/C: {payload.newDetails.accountNumber || 'N/A'}</div>
            <div style={{ color: payload.newDetails.ifscCode !== payload.oldDetails.ifscCode ? 'var(--brand-green)' : 'inherit' }}>IFSC: {payload.newDetails.ifscCode || 'N/A'}</div>
            <div style={{ color: payload.newDetails.accountName !== payload.oldDetails.accountName ? 'var(--brand-green)' : 'inherit' }}>Name: {payload.newDetails.accountName || 'N/A'}</div>
            <div style={{ color: payload.newDetails.panNumber !== payload.oldDetails.panNumber ? 'var(--brand-green)' : 'inherit' }}>PAN: {payload.newDetails.panNumber || 'N/A'}</div>
          </div>
        </div>
        {user?.roleId === 'master_admin' && (
          <div className="u-flex-gap-8 u-mt-4">
            <button 
              onClick={handleAccept} 
              disabled={isProcessing}
              className="halo-button btn-sm btn-approve u-flex-1"
            >
              <IconCheck size={14} /> Accept
            </button>
            <button 
              onClick={handleReject} 
              disabled={isProcessing}
              className="halo-button btn-sm btn-reject u-flex-1"
            >
              <IconX size={14} /> Reject
            </button>
          </div>
        )}
      </div>
    );
  }

  if (!task.description && !task.city) return null;

  return (
    <div className="hub-tile-meta">
      {task.city && (
        <span
          className="tile-hub-code halo-type"
          title={`Department: ${task.city}`}
        >
          {task.city}
        </span>
      )}
      {task.function && (
        <span
          className="tile-function-badge halo-type"
          title={`Role: ${task.function}`}
        >
          {task.function}
        </span>
      )}
    </div>
  );
};

export default EmployeeTaskTile;
