import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/core/supabaseClient';
import { useAuth } from '../../app/contexts/AuthContext';
import { taskService } from '../../services/tasks/taskService';
import { employeeService } from '../../services/employees/employeeService';
import { IconCheck, IconX } from '../../components/ui/Icons';
import './HubTaskTile.css';

// Module-level cache to avoid redundant fetches across hundreds of tiles
let functionsCache = null;

/**
 * HubTaskTile
 * Custom metadata injected into the master TaskCard's 2nd Row.
 */
const HubTaskTile = ({ task }) => {
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [functions, setFunctions] = useState(functionsCache);

  useEffect(() => {
    if (functionsCache) return;
    
    const loadFunctions = async () => {
      const { data } = await supabase.from('hub_functions').select('name, function_code');
      if (data) {
        functionsCache = data;
        setFunctions(data);
      }
    };
    loadFunctions();
  }, []);

  let payload = null;
  if (task.description) {
    try {
      payload = JSON.parse(task.description);
    } catch (e) {
      // Not JSON, ignore
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

  const isMulti = !task.isSubTask && (task.hubCodes || []).length > 1;
  
  // Resolve function code from name
  const functionCode = functions?.find(f => f.name === task.function)?.function_code || task.function;

  return (
    <div className={`hub-tile-meta ${task.isSubTask ? 'subtask-indent' : ''}`}>
      
      {/* 1. Hub Badges */}
      <div className="task-hub-badges">
        {isMulti ? (
          <span className="hub-badge multi-badge" title={task.hubCodes.join(', ')}>
            MULTI
          </span>
        ) : (
          (task.hubCodes || []).map((code, i) => (
            <span key={i} className="hub-badge" title={task.hubNames?.[i] || code}>
              {code}
            </span>
          ))
        )}
        {/* Fallback for legacy data */}
        {(task.hubCodes || []).length === 0 && task.hub_id && (
          <span className="hub-badge">📍 Hub</span>
        )}
      </div>

      {/* 2. Function Badge (If present) */}
      {task.function && (
        <span className="tile-function-badge halo-type" title={`Function: ${task.function}`}>
          {functionCode}
        </span>
      )}
    </div>
  );
};

export default HubTaskTile;
