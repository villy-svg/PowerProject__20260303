/**
 * QuickMarkAttendance.jsx
 *
 * Sleek, Bank-Update-style quick-mark modal trigger for BACKLOG attendance
 * closure tasks (TaskCard, ListViewRow, TaskTreeView).
 *
 * Shows ONLY: Person, Date, all 7 visible Status options (Absent defaulted),
 * and Submit for Approval. Zero <input> elements so the phone keyboard never
 * pops up. Consumes useTaskBoard().fetchTasks directly to avoid prop-drilling.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTaskBoard } from '../../app/contexts/TaskBoardContext';
import {
  formatAttendanceShiftDate,
  parseAttendanceOptionValue,
  submitAttendanceTaskChoice,
  toAttendanceOptionValue,
} from '../../services/employees/unmarkedAttendanceTaskService';
import AttendanceStatusPicker from './AttendanceStatusPicker';
import '../../styles/ManagementForms.css';
import './QuickMarkAttendance.css';

const QuickMarkAttendance = ({ task, className = '', onActionComplete = null }) => {
  const { fetchTasks } = useTaskBoard();
  const meta = task?.metadata || {};
  const defaultStatus = toAttendanceOptionValue(meta.suggested_status, meta.suggested_shift_type);

  const [isOpen, setIsOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState(defaultStatus);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const inFlightRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handleClose = useCallback((e) => {
    if (e) e.stopPropagation();
    if (inFlightRef.current) return;
    setIsOpen(false);
    setError('');
  }, []);

  // Close on Escape key while open
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        handleClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, handleClose]);

  const handleOpen = (e) => {
    e.stopPropagation();
    // Reset to default ('absent' or existing suggested_status) on every fresh open
    setSelectedStatus(defaultStatus);
    setError('');
    setIsOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!task?.id || !selectedStatus || inFlightRef.current) return;

    inFlightRef.current = true;
    setIsSubmitting(true);
    setError('');

    try {
      const { status, shiftType } = parseAttendanceOptionValue(selectedStatus);
      await submitAttendanceTaskChoice(task.id, status, null, shiftType);
      if (isMountedRef.current) {
        setIsOpen(false);
      }
      if (onActionComplete) {
        await onActionComplete();
      } else if (fetchTasks) {
        await fetchTasks(false);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err?.message || 'Failed to submit attendance status.');
      }
    } finally {
      inFlightRef.current = false;
      if (isMountedRef.current) {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <>
      <button
        type="button"
        className={`halo-button btn-review-submissions${className ? ` ${className}` : ''}`}
        onClick={handleOpen}
        onDoubleClick={(e) => e.stopPropagation()}
        title="Mark Attendance Status"
      >
        Mark Attendance
      </button>

      {isOpen &&
        createPortal(
          /* Stop React synthetic event bubbling (click + double-click) through portal to parent TaskCard / ListViewRow */
          <div
            className="modal-overlay"
            onClick={handleClose}
            onDoubleClick={(e) => e.stopPropagation()}
            role="presentation"
          >
            <div
              className="modal-content quick-mark-modal"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="quick-mark-modal-title"
            >
              <div className="modal-header">
                <h2 id="quick-mark-modal-title">Mark Attendance</h2>
                <button
                  type="button"
                  className="close-modal"
                  onClick={handleClose}
                  aria-label="Close"
                  disabled={isSubmitting}
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="modal-content-area quick-mark-body">
                  {/* Person & Date — single sleek summary row */}
                  <div className="quick-mark-meta">
                    <span className="quick-mark-meta__person">
                      {meta.employee_name || 'Unknown Employee'}
                    </span>
                    <span className="quick-mark-meta__date">
                      {formatAttendanceShiftDate(meta.shift_date)}
                    </span>
                  </div>

                  {error && (
                    <div className="status-message error" role="alert">
                      {error}
                    </div>
                  )}

                  {/* All 7 statuses (Present Day/Night + non-present) immediately visible — Absent pre-selected */}
                  <AttendanceStatusPicker
                    value={selectedStatus}
                    onChange={setSelectedStatus}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="modal-footer sticky">
                  <button
                    type="submit"
                    className="halo-button quick-mark-submit"
                    disabled={!selectedStatus || isSubmitting}
                  >
                    {isSubmitting ? 'Submitting…' : 'Submit for Approval'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

export default QuickMarkAttendance;
