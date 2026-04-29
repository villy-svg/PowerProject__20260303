import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/core/supabaseClient';
import AssigneeSelector from '../../components/AssigneeSelector';
import TaskHierarchySelector from '../../components/TaskHierarchySelector';
import SubmissionHistory from '../../components/SubmissionHistory';
import { taskUtils } from '../../utils/taskUtils';
import HubSelector from './HubSelector';
import { useAssignees } from '../../hooks/useAssignees';
import { IconUpload } from '../../components/Icons';
import { useTaskForm } from '../../hooks/useTaskForm';
import { orchestrationService } from '../../services/tasks/orchestrationService';
import CustomSelect from '../../components/CustomSelect';
import './HubTaskForm.css';

/** Fixed missing import */
/**
 * HubTaskForm
 * Vertical-specific form for Charging Hub tasks.
 * Refactored: Now uses useTaskForm hook and orchestrationService for clean separation.
 */
const HubTaskForm = ({ onSubmit, onCancel, loading, initialData = {}, availableTasks = [], permissions = {}, currentUser = {}, onSubmissionStatusUpdate, onUploadProof }) => {
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

  // --- UI Logic ---
  const uniqueCities = [...new Set(hubs.map(h => h.city))].filter(Boolean).sort();
  const filteredHubs = formData.city ? hubs.filter(h => h.city === formData.city) : [];

  const handleCityChange = (e) => {
    updateFields({
      city: e.target.value,
      hub_ids: [] // Reset selection on city change
    });
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
    if (step === 1 && (formData.hub_ids.length > 1 || formData.assigned_to.length > 1)) {
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

    const leader = orchestrationService.getSeniorMostAssignee(formData.assigned_to, allEmployees);

    // Sort all assignees for the parent task, keeping leader at index 0
    const sortedAssigneeIds = [...formData.assigned_to].sort((a, b) => {
      if (a === leader?.id) return -1;
      if (b === leader?.id) return 1;
      return 0;
    });

    const finalTaskText = taskUtils.formatTaskText(formData.text, {
      assetCode: isMultiHub ? 'MULTI' : primaryHub?.hub_code,
      functionName: formData.function,
      forcePrefix: formData.hub_ids.length > 0
    });

    onSubmit({
      ...formData,
      text: finalTaskText,
      assigned_to: sortedAssigneeIds,
      hub_id: isMultiHub ? (multiHub?.id || null) : (formData.hub_ids[0] || null),
      orchestration_mapping: orchestrationMapping
    });
  };

  const handleCancelWithConfirm = () => {
    if (isDirty) {
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
                  <label htmlFor="task-summary">Task Summary</label>
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

                <div className="form-row-grid">
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

                  <div className="form-group">
                    <label htmlFor="hub-selector">CHARGING HUB(S)</label>
                    <div className="form-input-container">
                      <HubSelector
                        id="hub-selector"
                        hubs={filteredHubs}
                        value={formData.hub_ids}
                        onChange={(val) => updateField('hub_ids', val)}
                        disabled={!formData.city || !taskUtils.canUserEditField(initialData, 'hub_id', permissions, currentUser)}
                      />
                    </div>
                  </div>
                </div>

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
            {(formData.hub_ids.length > 1 || formData.assigned_to.length > 1) && step === 1 ? (
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
                onClick={onCancel}
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
