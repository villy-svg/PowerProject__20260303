import React, { useEffect, useState, useRef } from 'react';
import AssigneeSelector from '../../components/AssigneeSelector';
import TaskHierarchySelector from '../../components/TaskHierarchySelector';
import { taskUtils } from '../../utils/taskUtils';
import { useAssignees } from '../../hooks/useAssignees';
import { useTaskForm } from '../../hooks/useTaskForm';
import { orchestrationService } from '../../services/tasks/orchestrationService';
import CustomSelect from '../../components/CustomSelect'; // FIX Bug10: Was missing — causes runtime crash when Employee task form opens
import { REMARK_GRADE_OPTIONS } from './remarksMapping';
import '../../styles/ManagementForms.css';
import SubmissionHistory from '../../components/SubmissionHistory';
import { IconUpload } from '../../components/Icons';
import '../ChargingHubs/HubTaskForm.css';

/**
 * EmployeeRemarkForm
 * Vertical-specific form for Employee Manager remarks.
 * Refactored: Uses useTaskForm for unified state management.
 */
const EmployeeRemarkForm = ({
  onSubmit,
  onCancel,
  loading,
  initialData = {},
  currentUser = {},
  permissions = {},
  availableTasks = [],
  onSubmissionStatusUpdate,
  onUploadProof
}) => {
  const {
    formData,
    updateField,
    isDirty
  } = useTaskForm(initialData);

  const { assignees: allEmployees } = useAssignees(true);

  // Photo upload capability for Remarks
  const [files, setFiles] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const [activeTab, setActiveTab] = useState('details');
  const [submissionCount, setSubmissionCount] = useState(0);

  const isEditMode = !!initialData?.id;
  const isMasterAdmin = currentUser?.roleId === 'master_admin' || permissions?.roleId === 'master_admin';
  const assigneeDisabled = !taskUtils.canUserEditField(initialData, 'assigned_to', permissions, currentUser) || (isEditMode && !isMasterAdmin);

  const handleFiles = (newFiles) => {
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
    const MAX_FILE_SIZE = 25 * 1024 * 1024;
    const BATCH_LIMIT = 10;
    const fileArray = Array.from(newFiles);

    const invalidFiles = fileArray.filter(f => !ALLOWED_TYPES.includes(f.type));
    if (invalidFiles.length > 0) {
      alert(`Invalid file type(s) detected: ${invalidFiles.map(f => f.name).join(', ')}. \n\nOnly JPG, PNG, and WEBP are allowed.`);
      return;
    }

    if (files.length + fileArray.length > BATCH_LIMIT) {
      alert(`Batch limit exceeded. You can only upload a maximum of ${BATCH_LIMIT} images.`);
      return;
    }

    const oversizedFiles = fileArray.filter(f => f.size > MAX_FILE_SIZE);
    if (oversizedFiles.length > 0) {
      alert("One or more images exceed the 25MB limit. Please select smaller files.");
      return;
    }

    setFiles((prev) => [...prev, ...fileArray]);
  };

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Resolve Senior-most Assignee for Parent Assignment
    const leader = orchestrationService.getSeniorMostAssignee(formData.assigned_to, allEmployees);
    
    const sortedAssigneeIds = [...formData.assigned_to].sort((a, b) => {
      if (a === leader?.id) return -1;
      if (b === leader?.id) return 1;
      return 0;
    });

    // For employees, we'll check for "hiring" keywords in the text as a simple principle
    const isHiring = formData.text.toLowerCase().includes('hire') || formData.text.toLowerCase().includes('onboard');
    
    const finalTaskText = taskUtils.formatTaskText(formData.text, {
      functionName: isHiring ? 'hiring' : ''
    });

    onSubmit({ ...formData, assigned_to: sortedAssigneeIds, text: finalTaskText, files });
  };

  return (
    <form className="vertical-task-form" onSubmit={handleSubmit}>
      <div className="modal-content-area">
        {initialData?.id && (
          <div className="task-form-tabs">
            <button type="button" className={`task-form-tab ${activeTab === 'details' ? 'active' : ''}`} onClick={() => setActiveTab('details')}>📝 Details</button>
            <button type="button" className={`task-form-tab ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>📋 History {submissionCount > 0 && <span className="tab-count">{submissionCount}</span>}</button>
            {onUploadProof && (
              <button type="button" className="halo-button proof-btn-inline" onClick={onUploadProof} title="Upload Proof of Work">
                <IconUpload size={12} /> <span>Proof</span>
              </button>
            )}
          </div>
        )}

        {activeTab === 'details' ? (
          <div className="tab-pane fade-in">
            <div className="form-group">
              <label>Remark Summary</label>
              <div className="form-input-container">
                <input
                  type="text"
                  value={formData.text}
                  onChange={(e) => updateField('text', e.target.value)}
                  placeholder="e.g. Onboard new hire, Conduct performance review"
                  required
                  disabled={!taskUtils.canUserEditField(initialData, 'text', permissions, currentUser)}
                />
              </div>
            </div>

            <div className="form-row-grid">
              <div className="form-group">
                <label>Remark Grade</label>
                <div className="form-input-container">
                  <CustomSelect
                    value={formData.priority}
                    onChange={(val) => updateField('priority', val)}
                    options={REMARK_GRADE_OPTIONS}
                    disabled={!taskUtils.canUserEditField(initialData, 'priority', permissions, currentUser)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Assigned To</label>
                <div className="form-input-container">
                  <AssigneeSelector
                    value={formData.assigned_to}
                    onChange={(val) => updateField('assigned_to', val)}
                    currentUser={currentUser}
                    disabled={assigneeDisabled}
                    isSingle={true}
                  />
                </div>
              </div>
            </div>

            <div className="form-group">
              <label>Detailed Description</label>
              <div className="form-input-container">
                <textarea
                  value={formData.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  placeholder="Enter task details..."
                  rows={4}
                  disabled={!taskUtils.canUserEditField(initialData, 'description', permissions, currentUser)}
                />
              </div>
            </div>

            <div className="form-group upload-section">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                <label className="section-label">Attach Photo(s)</label>
                {files.length > 0 && (
                  <span className="batch-counter" style={{ fontSize: '0.85rem', opacity: 0.6 }}>
                    {files.length} / 10 images
                  </span>
                )}
              </div>
              <div 
                className={`form-upload-zone ${dragActive ? 'drag-active' : ''}`}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragActive(true); }}
                onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragActive(false); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragActive(false);
                  if (e.dataTransfer.files?.length > 0) {
                    handleFiles(e.dataTransfer.files);
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                <input 
                  ref={fileInputRef}
                  type="file" 
                  multiple 
                  accept="image/jpeg,image/png,image/webp" 
                  onChange={(e) => {
                    if (e.target.files?.length > 0) {
                      handleFiles(e.target.files);
                    }
                  }} 
                  style={{ display: 'none' }}
                />
                <div className="upload-icon">📸</div>
                <div className="upload-text">
                  <strong>Click to browse</strong> or drag & drop photos here
                </div>
              </div>
              {files.length > 0 && (
                <div className="form-file-preview-strip">
                  {files.map((file, idx) => (
                    <div key={idx} className="file-chip">
                      <img src={URL.createObjectURL(file)} alt="Preview" />
                      <span className="file-chip-name">{file.name}</span>
                      <button type="button" className="file-chip-remove" onClick={(e) => { e.stopPropagation(); removeFile(idx); }}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="history-tab-content fade-in">
            <SubmissionHistory 
              taskId={initialData?.id} 
              permissions={permissions} 
              currentUser={currentUser} 
              onStatusUpdate={onSubmissionStatusUpdate} 
              onCountLoad={setSubmissionCount} 
            />
          </div>
        )}
      </div>

      <div className="form-footer">
        <button
          type={isDirty ? "submit" : "button"}
          className={`halo-button ${isDirty ? 'save-btn' : 'close-btn'}`}
          onClick={isDirty ? undefined : onCancel}
          disabled={loading}
        >
          {loading ? 'Saving...' : (initialData?.id ? (isDirty ? 'Update Task' : 'Close') : 'Create Task')}
        </button>
      </div>
    </form>
  );
};

export default EmployeeRemarkForm;
