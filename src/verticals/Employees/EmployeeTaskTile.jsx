import React, { useState } from 'react';
import { useRBAC } from '../../hooks/useRBAC';
import { taskService } from '../../services/tasks/taskService';
import { employeeService } from '../../services/employees/employeeService';
import { IconCheck, IconX } from '../../components/ui/Icons';

/**
 * EmployeeTaskTile
 * Custom metadata injected into the master TaskCard for the Employee Manager.
 */
const EmployeeTaskTile = ({ task }) => {
  const { user } = useRBAC();
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
      <div className="hub-tile-meta" style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Requested by: {payload.requestedByName}
        </div>
        <div style={{ display: 'flex', gap: '16px', fontSize: '0.8rem', background: 'var(--bg-light)', padding: '8px', borderRadius: '4px' }}>
          <div style={{ flex: 1 }}>
            <strong>Old Details</strong>
            <div style={{ wordBreak: 'break-all' }}>A/C: {payload.oldDetails.accountNumber || 'N/A'}</div>
            <div>IFSC: {payload.oldDetails.ifscCode || 'N/A'}</div>
            <div>Name: {payload.oldDetails.accountName || 'N/A'}</div>
            <div>PAN: {payload.oldDetails.panNumber || 'N/A'}</div>
          </div>
          <div style={{ flex: 1, borderLeft: '1px solid var(--border-color)', paddingLeft: '8px' }}>
            <strong>New Details</strong>
            <div style={{ wordBreak: 'break-all', color: payload.newDetails.accountNumber !== payload.oldDetails.accountNumber ? 'var(--brand-green)' : 'inherit' }}>A/C: {payload.newDetails.accountNumber || 'N/A'}</div>
            <div style={{ color: payload.newDetails.ifscCode !== payload.oldDetails.ifscCode ? 'var(--brand-green)' : 'inherit' }}>IFSC: {payload.newDetails.ifscCode || 'N/A'}</div>
            <div style={{ color: payload.newDetails.accountName !== payload.oldDetails.accountName ? 'var(--brand-green)' : 'inherit' }}>Name: {payload.newDetails.accountName || 'N/A'}</div>
            <div style={{ color: payload.newDetails.panNumber !== payload.oldDetails.panNumber ? 'var(--brand-green)' : 'inherit' }}>PAN: {payload.newDetails.panNumber || 'N/A'}</div>
          </div>
        </div>
        {user?.roleId === 'master_admin' && (
          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
            <button 
              onClick={handleAccept} 
              disabled={isProcessing}
              style={{ flex: 1, padding: '4px 8px', background: 'var(--brand-green)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
            >
              <IconCheck size={14} /> Accept
            </button>
            <button 
              onClick={handleReject} 
              disabled={isProcessing}
              style={{ flex: 1, padding: '4px 8px', background: 'var(--brand-red)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
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
