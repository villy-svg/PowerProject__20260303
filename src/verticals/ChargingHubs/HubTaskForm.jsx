import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/core/supabaseClient';
import AssigneeSelector from '../../components/ui/AssigneeSelector';
import TaskHierarchySelector from '../../components/tasks/TaskHierarchySelector';
import SubmissionHistory from '../../components/tasks/SubmissionHistory';
import { taskUtils } from '../../utils/taskUtils';
import HubSelector from './HubSelector';
import { useAssignees } from '../../hooks/useAssignees';
import { IconUpload } from '../../components/ui/Icons';
import { useTaskForm } from '../../hooks/useTaskForm';
import { orchestrationService } from '../../services/tasks/orchestrationService';
import CustomSelect from '../../components/ui/CustomSelect';
import AnonToggle from '../../components/ui/AnonToggle';
import './HubTaskForm.css';

/** Fixed missing import */
/**
 * HubTaskForm
 * Vertical-specific form for Charging Hub tasks.
 * Refactored: Now uses useTaskForm hook and orchestrationService for clean separation.
 */
const HubTaskForm = ({ onSubmit, onCancel, loading, initialData = {}, availableTasks = [], permissions = {}, currentUser = {}, onSubmissionStatusUpdate, onUploadProof, activeVertical }) => {
  const {
    formData,
    updateField,
    updateFields,
    isDirty,
    step,
    setStep,
    orchestrationMapping,
    setOrchestrationMapping
  } = useTaskForm(initialData);

  const [activeTab, setActiveTab] = useState('details');
  const [submissionCount, setSubmissionCount] = useState(0);
  const [hubs, setHubs] = useState([]);
  const [functions, setFunctions] = useState([]);
  const { assignees: allEmployees } = useAssignees(true);

  // Initial photo upload capability for new tasks and escalations
  const [files, setFiles] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = React.useRef(null);

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

  // --- Auto-Save Draft Logic ---
  const stateRef = React.useRef({ formData, orchestrationMapping, isDirty, hubs, allEmployees });
  const onSubmitRef = React.useRef(onSubmit);
  const isSubmitted = React.useRef(false);

  React.useEffect(() => {
    stateRef.current = { formData, orchestrationMapping, isDirty, hubs, allEmployees };
  }, [formData, orchestrationMapping, isDirty, hubs, allEmployees]);

  React.useEffect(() => {
    onSubmitRef.current = onSubmit;
  }, [onSubmit]);

  React.useEffect(() => {
    return () => {
      const { formData: latestData, orchestrationMapping: latestMapping, isDirty: latestDirty, hubs: latestHubs, allEmployees: latestEmployees } = stateRef.current;

      if (latestDirty && !isSubmitted.current && latestData.text) {
        const draftText = latestData.text.startsWith('[DRAFT]') 
          ? latestData.text 
          : `[DRAFT] ${latestData.text}`;
          
        const isMultiHub = latestData.hub_ids.length > 1;
        const primaryHub = latestHubs.find(h => h.id === latestData.hub_ids[0]);
        const multiHub = latestHubs.find(h => h.city === latestData.city && h.name === 'MULTI');
        
        const leader = latestEmployees && latestEmployees.length > 0 
          ? latestData.assigned_to.map(id => latestEmployees.find(e => e.id === id || e.employeeId === id)).filter(Boolean).sort((a, b) => (a.seniority_level ?? 999) - (b.seniority_level ?? 999))[0]
          : null;

        const sortedAssigneeIds = [...latestData.assigned_to].sort((a, b) => {
          if (a === leader?.id || a === leader?.employeeId) return -1;
          if (b === leader?.id || b === leader?.employeeId) return 1;
          return 0;
        });

        if (onSubmitRef.current) {
          onSubmitRef.current({
            ...latestData,
            text: draftText,
            assigned_to: sortedAssigneeIds,
            hub_id: isMultiHub ? (multiHub?.id || null) : (latestData.hub_ids[0] || null),
            orchestration_mapping: latestMapping
          });
        }
      }
    };
  }, []);

  // --- Data Fetching ---
  const fetchHubs = async () => {
    const { data, error } = await supabase.from('hubs').select('id, name, city, hub_code').order('name');
    if (error) console.error('[HubTaskForm] Error fetching hubs:', error.message);
    else if (data) setHubs(data);
  };

  const fetchFunctions = async () => {
    const { data, error } = await supabase.from('hub_functions').select('name, function_code').order('name');
    if (error) console.error('[HubTaskForm] Error fetching functions:', error.message);
    else if (data) setFunctions(data);
  };

  const provisionMultiHub = async (city) => {
    if (!city || city === 'System') return;
    const citySlug = city.toUpperCase().replace(/\s+/g, '_');
    const multiCode = `MULTI-${citySlug}`;

    const { data, error } = await supabase
      .from('hubs')
      .upsert([{ name: 'MULTI', hub_code: multiCode, city: city, status: 'Active' }], { onConflict: 'hub_code' })
      .select();

    if (!error && data) fetchHubs();
  };

  useEffect(() => {
    fetchHubs();
    fetchFunctions();
  }, []);

  useEffect(() => {
    if (formData.city && hubs.length > 0) {
      const hasMulti = hubs.some(h => h.city === formData.city && h.name === 'MULTI');
      if (!hasMulti) provisionMultiHub(formData.city);
    }
  }, [formData.city, hubs.length]);

  // AUTO-DEDUCE CITY ON LOAD: For subtasks where hub_ids are pre-set
  useEffect(() => {
    if (!formData.city && formData.hub_ids?.length > 0 && hubs.length > 0) {
      const firstHubId = formData.hub_ids[0];
      const hub = hubs.find(h => h.id === firstHubId);
      if (hub?.city) {
        updateField('city', hub.city);
      }
    }
  }, [formData.hub_ids, hubs.length]);

  // --- UI Logic ---
  const uniqueCities = [...new Set(hubs.map(h => h.city))].filter(Boolean).sort();
  // BUG-FIX: Allow selecting ANY hub if city isn't set yet (enables Hub -> City deduction)
  const filteredHubs = formData.city ? hubs.filter(h => h.city === formData.city) : hubs;

  const handleCityChange = (e) => {
    updateFields({
      city: e.target.value,
      hub_ids: [] // Reset selection on city change
    });
  };

  const handleHubChange = (val) => {
    updateField('hub_ids', val);
    
    // AUTO-DEDUCE CITY: If no city is selected but a hub is picked, deduce city from hub
    if (!formData.city && val.length > 0) {
      const selectedHub = hubs.find(h => h.id === val[0]);
      if (selectedHub && selectedHub.city) {
        updateField('city', selectedHub.city);
      }
    }
  };

  const handleNextStep = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    // FIX Bug6: allEmployees is populated asynchronously. If the user clicks "Next"
    // before the hook resolves, candidates = [] and every hub maps to undefined.
    if (!allEmployees || allEmployees.length === 0) {
      alert('Employee data is still loading. Please wait a moment and try again.');
      return;
    }
    const mapping = orchestrationService.calculateOrchestration(
      formData.hub_ids,
      formData.assigned_to,
      allEmployees
    );
    setOrchestrationMapping(mapping);
    setStep(2);
  };

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    isSubmitted.current = true;

    const isMultiHub = formData.hub_ids.length > 1;

    // Prevent submission if we're in step 1 but need to orchestrate (e.g. on Enter key)
    if (activeVertical !== 'escalation_tasks' && step === 1 && (formData.hub_ids.length > 1 || formData.assigned_to.length > 1)) {
      handleNextStep();
      return;
    }

    const primaryHub = hubs.find(h => h.id === formData.hub_ids[0]);
    const multiHub = hubs.find(h => h.city === formData.city && h.name === 'MULTI');

    // BUG-FIX: multiHub is provisioned asynchronously via provisionMultiHub().
    // If the useEffect triggering it hasn't resolved by submit time, multiHub is
    // undefined and the umbrella parent task gets hub_id=null — causing it to
    // not render in hub-filtered views. Log a warning so this is detectable.
    if (isMultiHub && !multiHub) {
      console.warn('[HubTaskForm] MULTI hub not yet provisioned for city:', formData.city, '— umbrella parent will have null hub_id.');
    }

    // Hierarchy Expansion for Escalations
    let finalAssignees = [...formData.assigned_to];
    if (activeVertical === 'escalation_tasks') {
      const expandedSet = new Set(finalAssignees);
      for (const assigneeId of formData.assigned_to) {
        let currentId = assigneeId;
        while (currentId) {
          const emp = allEmployees.find(e => e.id === currentId || e.employeeId === currentId);
          if (emp && emp.manager_id) {
            expandedSet.add(emp.manager_id);
            currentId = emp.manager_id;
          } else {
            currentId = null;
          }
        }
      }
      finalAssignees = Array.from(expandedSet);
    }

    const leader = orchestrationService.getSeniorMostAssignee(finalAssignees, allEmployees);

    // Sort all assignees for the parent task, keeping leader at index 0
    const sortedAssigneeIds = finalAssignees.sort((a, b) => {
      if (a === leader?.id) return -1;
      if (b === leader?.id) return 1;
      return 0;
    });

    const finalTaskText = taskUtils.formatTaskText(formData.text, {
      assetCode: isMultiHub ? 'MULTI' : primaryHub?.hub_code,
      cityCode: primaryHub?.city || hubs.find(h => h.id === formData.hub_ids[0])?.city,
      functionName: formData.function,
      forcePrefix: formData.hub_ids.length > 0
    });

    onSubmit({
      ...formData,
      text: finalTaskText,
      assigned_to: sortedAssigneeIds,
      hub_id: isMultiHub ? (multiHub?.id || null) : (formData.hub_ids[0] || null),
      orchestration_mapping: orchestrationMapping,
      files: files
    });
  };

  const handleCancelWithConfirm = () => {
    if (isDirty || files.length > 0) {
      if (window.confirm('You have unsaved changes. Are you sure you want to close?')) {
        onCancel();
      }
    } else {
      onCancel();
    }
  };

  const fanOutInfo = orchestrationService.predictFanOut(formData.hub_ids, formData.assigned_to);

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
            {step === 1 ? (
              <>
                <div className="form-group">
                  <label htmlFor="task-summary">{activeVertical === 'escalation_tasks' ? 'Support Request Summary' : 'Task Summary'}</label>
                  <div className="form-input-container">
                    <input
                      id="task-summary"
                      name="taskText"
                      type="text"
                      value={formData.text}
                      onChange={(e) => updateField('text', e.target.value)}
                      placeholder="e.g. Inspect Station 4"
                      required
                      disabled={!taskUtils.canUserEditField(initialData, 'text', permissions, currentUser)}
                    />
                  </div>
                </div>

                {initialData?.id && (
                  <div className="form-group">
                    <label htmlFor="task-board-select">MOVE TO BOARD</label>
                    <div className="form-input-container">
                      <CustomSelect
                        id="task-board-select"
                        value={formData.task_board?.[0] || 'Hubs'}
                        onChange={(val) => updateField('task_board', [val])}
                        options={[
                          { label: 'Hubs Task Board', value: 'Hubs' },
                          { label: 'Escalation Task Board', value: 'Escalations' }
                        ]}
                        disabled={!permissions?.canUpdate}
                      />
                    </div>
                  </div>
                )}

                {activeVertical === 'escalation_tasks' && (
                  <div className="form-group anonymity-toggle-group">
                    <AnonToggle
                      id="anonymity-toggle"
                      label="Submit Anonymously"
                      description="Your identity will be hidden on the public board."
                      checked={formData.is_anonymous || false}
                      onChange={(val) => updateField('is_anonymous', val)}
                    />
                  </div>
                )}

                <div className="form-row-grid">
                  {activeVertical !== 'escalation_tasks' && (
                    <div className="form-group">
                      <label htmlFor="city-select">City</label>
                      <div className="form-input-container">
                        <CustomSelect
                          id="city-select"
                          value={formData.city}
                          onChange={(val) => handleCityChange({ target: { value: val } })}
                          options={uniqueCities.map(city => ({ label: city, value: city }))}
                          placeholder="Select City..."
                          disabled={!taskUtils.canUserEditField(initialData, 'city', permissions, currentUser)}
                        />
                      </div>
                    </div>
                  )}

                  <div className="form-group">
                    <label htmlFor="hub-selector">CHARGING HUB(S)</label>
                    <div className="form-input-container">
                      <HubSelector
                        id="hub-selector"
                        hubs={filteredHubs}
                        value={formData.hub_ids}
                        onChange={handleHubChange}
                        disabled={!taskUtils.canUserEditField(initialData, 'hub_id', permissions, currentUser)}
                      />
                    </div>
                  </div>
                </div>

                {activeVertical === 'escalation_tasks' ? (
                  <div className="form-group">
                    <label htmlFor="assignee-selector">TAG MANAGER(S)</label>
                    <div className="form-input-container">
                      <AssigneeSelector
                        id="assignee-selector"
                        value={formData.assigned_to}
                        onChange={(val) => updateField('assigned_to', val)}
                        currentUser={currentUser}
                        disabled={!taskUtils.canUserEditField(initialData, 'assigned_to', permissions, currentUser)}
                        filter={(emp) => (emp.seniority_level >= 3)}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="form-row-grid">
                    <div className="form-group">
                      <label htmlFor="priority-select">Priority</label>
                      <div className="form-input-container">
                        <CustomSelect
                          id="priority-select"
                          value={formData.priority}
                          onChange={(val) => updateField('priority', val)}
                          options={[
                            { label: 'Low', value: 'Low' },
                            { label: 'Medium', value: 'Medium' },
                            { label: 'High', value: 'High' },
                            { label: 'Urgent', value: 'Urgent' }
                          ]}
                          disabled={!taskUtils.canUserEditField(initialData, 'priority', permissions, currentUser)}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label htmlFor="assignee-selector">ASSIGNEE(S)</label>
                      <div className="form-input-container">
                        <AssigneeSelector
                          id="assignee-selector"
                          value={formData.assigned_to}
                          onChange={(val) => updateField('assigned_to', val)}
                          currentUser={currentUser}
                          disabled={!taskUtils.canUserEditField(initialData, 'assigned_to', permissions, currentUser)}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {activeVertical !== 'escalation_tasks' && (
                  <div className="form-row-grid">
                    <div className="form-group">
                      <label htmlFor="function-select">FUNCTION</label>
                      <div className="form-input-container">
                        <CustomSelect
                          id="function-select"
                          value={formData.function}
                          onChange={(val) => updateField('function', val)}
                          options={[
                            { label: 'N/A (General)', value: '' },
                            ...functions.map(fn => ({ 
                              label: fn.function_code ? `[${fn.function_code}] ${fn.name}` : fn.name, 
                              value: fn.name 
                            }))
                          ]}
                          placeholder="Select Function..."
                          disabled={!taskUtils.canUserEditField(initialData, 'function', permissions, currentUser)}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label htmlFor="parent-task-selector">PARENT TASK</label>
                      <div className="form-input-container">
                        <TaskHierarchySelector
                          id="parent-task-selector"
                          value={formData.parentTask}
                          onChange={(val) => updateField('parentTask', val)}
                          availableTasks={availableTasks}
                          disabled={!taskUtils.canUserEditField(initialData, 'parentTask', permissions, currentUser)}
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="detailed-description">Detailed Description</label>
                  <div className="form-input-container">
                    <textarea
                      id="detailed-description"
                      name="description"
                      value={formData.description}
                      onChange={(e) => updateField('description', e.target.value)}
                      placeholder="Enter task details..."
                      rows={4}
                      disabled={!taskUtils.canUserEditField(initialData, 'description', permissions, currentUser)}
                    />
                  </div>
                </div>

                {!initialData?.id && (
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
                )}
              </>
            ) : (
              <div className="orchestration-page fade-in">
                <div className="orchestration-header"><h3>Task Orchestration</h3><p>Assign specific team members to each hub execution.</p></div>
                <div className="orchestration-list">
                  {orchestrationMapping.map((item, idx) => (
                    <div key={item.hub_id || idx} className="form-group">
                      <label>
                        {hubs.find(h => h.id === item.hub_id)?.hub_code || 'HUB'}
                      </label>
                      <div className="form-input-container orch-assignee-select">
                        <AssigneeSelector
                          id={`orch-assignee-${idx}`}
                          isSingle={true}
                          limitToIds={formData.assigned_to}
                          value={item.assigned_to}
                          onChange={(val) => {
                            const next = [...orchestrationMapping];
                            next[idx] = { ...next[idx], assigned_to: val };
                            setOrchestrationMapping(next);
                          }} currentUser={currentUser}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {fanOutInfo.mode > 1 && (
                  <div className="fanout-prediction-box anim-slide-up">
                    <div className="prediction-content">
                      <div className="prediction-detail">
                        <p><span className="prediction-icon">⚡</span> <strong>{fanOutInfo.type} Detected:</strong></p>
                        <p>This will create <strong>{fanOutInfo.totalTasks}</strong> tasks ({fanOutInfo.description})</p>
                      </div>
                      <p className="prediction-disclaimer">Tasks will be generated as a "Batch" linked to a parent task.</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="history-tab-content fade-in">
            <SubmissionHistory taskId={initialData?.id} permissions={permissions} currentUser={currentUser} onStatusUpdate={onSubmissionStatusUpdate} onCountLoad={setSubmissionCount} />
          </div>
        )}
      </div>

      <div className="form-footer sticky">
        {step === 2 ? (
          <>
            <button
              key="back-btn"
              type="button"
              className="halo-button close-btn"
              onClick={() => setStep(1)}
              style={{ marginRight: 'auto' }}
            >
              ← Back
            </button>
            <button
              key="close-btn"
              type="button"
              className="halo-button close-btn"
              onClick={handleCancelWithConfirm}
            >
              Close
            </button>
            <button
              key="save-btn"
              type="submit"
              className="halo-button save-btn"
              disabled={loading}
            >
              {loading ? 'Saving...' : (initialData?.id ? 'Save Changes' : 'Create Task')}
            </button>
          </>
        ) : (
          <>
            {activeVertical !== 'escalation_tasks' && (formData.hub_ids.length > 1 || formData.assigned_to.length > 1) && step === 1 ? (
              <button
                key="next-btn"
                type="button"
                className="halo-button save-btn"
                onClick={handleNextStep}
                // FIX Bug6: Disable until employee data is loaded to prevent null-assignee crash
                disabled={!allEmployees || allEmployees.length === 0}
                style={{ marginLeft: 'auto' }}
              >
                Next: Orchestrate Team
              </button>
            ) : (isDirty || step === 2) ? (
              <button
                key="save-btn"
                type="submit"
                className="halo-button save-btn"
                disabled={loading}
                style={{ marginLeft: 'auto' }}
              >
                {loading ? 'Saving...' : (initialData?.id ? 'Update Task' : 'Create Batch')}
              </button>
            ) : (
              <button
                key="close-btn"
                type="button"
                className="halo-button close-btn"
                onClick={handleCancelWithConfirm}
                style={{ opacity: 0.6, marginLeft: 'auto' }}
              >
                Close
              </button>
            )}
          </>
        )}
      </div>
    </form>
  );
};

export default HubTaskForm;
