import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/core/supabaseClient';
import AssigneeSelector from '../../components/AssigneeSelector';
import TaskHierarchySelector from '../../components/TaskHierarchySelector';
import SubmissionHistory from '../../components/SubmissionHistory';
import { taskUtils } from '../../utils/taskUtils';
import HubSelector from './HubSelector';
import { useAssignees } from '../../hooks/useAssignees';
import { IconUpload } from '../../components/Icons';
import './HubTaskForm.css';

/**
 * HubTaskForm
 * Vertical-specific form for Charging Hub tasks.
 * Includes text, priority, and link to a specific hub.
 */
const HubTaskForm = ({ onSubmit, onCancel, loading, initialData = {}, availableTasks = [], permissions = {}, currentUser = {}, onSubmissionStatusUpdate, onUploadProof }) => {
  const safeData = initialData || {};
  const [formData, setFormData] = useState({
    text: safeData.text || '',
    priority: safeData.priority || 'Medium',
    // NEW: Initialize from either existing array or legacy single ID
    hub_ids: Array.isArray(safeData.hub_ids) 
      ? safeData.hub_ids 
      : (safeData.hub_id ? [safeData.hub_id] : []),
    city: safeData.city || '',
    function: safeData.function || '',
    description: safeData.description || '',
    assigned_to: Array.isArray(safeData.assigned_to) ? safeData.assigned_to : (safeData.assigned_to ? [safeData.assigned_to] : []),
    parentTask: safeData.parentTask || ''
  });

  const [activeTab, setActiveTab] = useState('details');
  const [step, setStep] = useState(1);
  const [orchestrationMapping, setOrchestrationMapping] = useState([]);

  // Check if form has changes
  const isDirty = safeData.id ? Object.keys(formData).some(key => {
    const initialVal = safeData[key] || '';
    const currentVal = formData[key] || '';
    return initialVal !== currentVal;
  }) : true; // Always dirty for new tasks
  const [submissionCount, setSubmissionCount] = useState(0);
  const [hubs, setHubs] = useState([]);
  const [functions, setFunctions] = useState([]);
  const { assignees: allEmployees } = useAssignees(true);

  const fetchHubs = async () => {
    const { data, error } = await supabase.from('hubs').select('id, name, city, hub_code').order('name');
    if (error) {
      console.error('[HubTaskForm] Error fetching hubs:', error.message);
      return;
    }
    if (data) setHubs(data);
  };

  const provisionMultiHub = async (city) => {
    if (!city || city === 'System') return;
    const { data } = await supabase
      .from('hubs')
      .insert([{ name: 'MULTI', hub_code: 'MULTI', city: city, status: 'Active' }])
      .select();
    if (data) fetchHubs();
  };

  // NEW: Auto-provision MULTI hub for the selected city
  useEffect(() => {
    if (formData.city && hubs.length > 0) {
      const hasMulti = hubs.some(h => h.city === formData.city && h.name === 'MULTI');
      if (!hasMulti) provisionMultiHub(formData.city);
    }
  }, [formData.city, hubs.length]);

  const fetchFunctions = async () => {
    const { data, error } = await supabase.from('hub_functions').select('name, function_code').order('name');
    if (error) {
      console.error('[HubTaskForm] Error fetching functions:', error.message);
      return;
    }
    if (data) setFunctions(data);
  };

  useEffect(() => {
    let isMounted = true;
    
    console.info(`[HubTaskForm] Initializing on ${import.meta.env.VITE_SUPABASE_URL}`);
    
    const loadData = async () => {
      if (!isMounted) return;
      await Promise.all([fetchHubs(), fetchFunctions()]);
    };

    loadData();
    
    return () => { isMounted = false; };
  }, []);

  // Get unique cities from the hubs list
  const uniqueCities = [...new Set(hubs.map(h => h.city))].filter(Boolean).sort();

  // Filter hubs based on selected city
  const filteredHubs = formData.city 
    ? hubs.filter(h => h.city === formData.city)
    : [];

  const handleCityChange = (e) => {
    const newCity = e.target.value;
    setFormData({
      ...formData,
      city: newCity,
      hub_ids: [] // CRITICAL: Reset multi-hub selection on city change
    });
  };

  /**
   * PowerOrchestrator: Intelligent Auto-mapping
   */
  const handleNextStep = () => {
    const hubIds = formData.hub_ids;
    const assigneeIds = formData.assigned_to;
    
    const numTasks = Math.max(hubIds.length, assigneeIds.length);
    const mappings = [];
    const assignedIds = new Set();
    const hubsFilled = new Set();

    // 1. Sort assignees by seniority for rule consistency
    const sortedEmployees = [...assigneeIds]
      .map(id => allEmployees.find(e => e.id === id))
      .filter(Boolean)
      .sort((a, b) => {
        const badgeA = String(a?.badge_id || '999999');
        const badgeB = String(b?.badge_id || '999999');
        if (badgeA !== badgeB) return badgeA.localeCompare(badgeB);
        return (a?.seniority_level || 999) - (b?.seniority_level || 999);
      });

    const seniorMostId = sortedEmployees[0]?.id || assigneeIds[0];

    // PASS 1: Home Hub Matching (Priority to Senior)
    sortedEmployees.forEach(emp => {
      if (emp.hub_id && hubIds.includes(emp.hub_id) && !hubsFilled.has(emp.hub_id)) {
        mappings.push({ hub_id: emp.hub_id, assigned_to: [emp.id] });
        assignedIds.add(emp.id);
        hubsFilled.add(emp.hub_id);
      }
    });

    // PASS 2: Fill remaining selected Hubs
    hubIds.forEach(hId => {
      if (!hubsFilled.has(hId)) {
        const orphan = sortedEmployees.find(emp => !assignedIds.has(emp.id));
        if (orphan) {
          mappings.push({ hub_id: hId, assigned_to: [orphan.id] });
          assignedIds.add(orphan.id);
        } else {
          mappings.push({ hub_id: hId, assigned_to: [seniorMostId] });
        }
        hubsFilled.add(hId);
      }
    });

    // PASS 3: Remaining Assignees (Orphans without a hub match)
    sortedEmployees.forEach(emp => {
      if (!assignedIds.has(emp.id)) {
        const targetHub = hubIds[mappings.length % hubIds.length];
        mappings.push({ hub_id: targetHub, assigned_to: [emp.id] });
        assignedIds.add(emp.id);
      }
    });

    setOrchestrationMapping(mappings.slice(0, numTasks));
    setStep(2);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // 1. Resolve primary hub for text formatting
    const primaryHub = hubs.find(h => h.id === formData.hub_ids[0]);

    // 2. Resolve "MULTI" hub for Umbrella task categorization
    const multiHub = hubs.find(h => h.city === formData.city && h.name === 'MULTI');

    // 3. Resolve Senior-most Assignee for Parent Assignment
    // We sort the selected IDs based on seniority metadata fetched from useAssignees
    const sortedAssigneeIds = [...formData.assigned_to].sort((aId, bId) => {
      const empA = allEmployees.find(e => e.id === aId);
      const empB = allEmployees.find(e => e.id === bId);
      
      // Sort by Badge ID (seniority-style) then seniority level
      const badgeA = String(empA?.badge_id || '999999');
      const badgeB = String(empB?.badge_id || '999999');
      if (badgeA !== badgeB) return badgeA.localeCompare(badgeB);
      
      return (empA?.seniority_level || 999) - (empB?.seniority_level || 999);
    });

    // 4. Format task text using the established utility
    const isMultiHub = formData.hub_ids.length > 1;
    const finalTaskText = taskUtils.formatTaskText(formData.text, {
      // Use "MULTI" prefix for the Umbrella Parent, otherwise use specific hub code
      assetCode: isMultiHub ? 'MULTI' : primaryHub?.hub_code,
      functionName: formData.function,
      forcePrefix: formData.hub_ids.length > 0
    });

    // 5. Construct Payload
    const submissionPayload = {
      ...formData,
      text: finalTaskText,
      // Pass sorted assignees so parent (index 0) is always the senior-most
      assigned_to: sortedAssigneeIds,
      hub_ids: formData.hub_ids, 
      hub_id: isMultiHub ? (multiHub?.id || null) : (formData.hub_ids[0] || null),
      orchestration_mapping: orchestrationMapping // NEW: Pass the granular orchestration matrix
    };

    console.log('[HubTaskForm] Submitting Payload:', submissionPayload);
    onSubmit(submissionPayload);
  };

  return (
    <form className="vertical-task-form" onSubmit={handleSubmit}>
      {/* Wrap everything except the footer in a scrollable area */}
      <div className="modal-content-area">
        {/* Tab Navigation — Only shown in edit mode */}
        {safeData.id && (
          <div className="task-form-tabs">
            <button 
              type="button" 
              className={`task-form-tab ${activeTab === 'details' ? 'active' : ''}`}
              onClick={() => setActiveTab('details')}
            >
              📝 Details
            </button>
            <button 
              type="button" 
              className={`task-form-tab ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              📋 History {submissionCount > 0 && <span className="tab-count">{submissionCount}</span>}
            </button>

            {/* NEW: Proof button moved next to tabs for space efficiency */}
            {onUploadProof && initialData.id && (
              <button
                type="button"
                className="halo-button proof-btn-inline"
                onClick={onUploadProof}
                title="Upload Proof of Work"
              >
                <IconUpload size={12} />
                <span>Proof</span>
              </button>
            )}
          </div>
        )}

        {activeTab === 'details' ? (
          <div className="tab-pane fade-in">
            {step === 1 ? (
              <>
                <div className="form-group">
                  <label>Task Summary</label>
                  <input 
                    type="text" 
                    value={formData.text}
                    onChange={(e) => setFormData({...formData, text: e.target.value})}
                    placeholder="e.g. Inspect Station 4"
                    required
                    disabled={!taskUtils.canUserEditField(initialData, 'text', permissions, currentUser)}
                  />
                </div>

                <div className="form-row-grid">
                  <div className="form-group">
                    <label>City</label>
                    <select 
                      className="master-dropdown"
                      value={formData.city}
                      onChange={handleCityChange}
                      required
                      disabled={!taskUtils.canUserEditField(initialData, 'city', permissions, currentUser)}
                    >
                      <option value="">Select City...</option>
                      {uniqueCities.map(city => (
                        <option key={city} value={city}>{city}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label-with-badge">
                      Charging Hub(s)
                      {formData.hub_ids.length > 1 && (
                        <span className="mode-badge mode-3-badge">🔀 Multi-Hub</span>
                      )}
                    </label>

                    <HubSelector 
                      hubs={filteredHubs}
                      value={formData.hub_ids}
                      onChange={(val) => setFormData(p => ({ ...p, hub_ids: val }))}
                      disabled={!formData.city || !taskUtils.canUserEditField(initialData, 'hub_id', permissions, currentUser)}
                    />
                  </div>
                </div>

                <div className="form-row-grid">
                  <div className="form-group">
                    <label>Priority</label>
                    <select 
                      className="master-dropdown"
                      value={formData.priority}
                      onChange={(e) => setFormData({...formData, priority: e.target.value})}
                      disabled={!taskUtils.canUserEditField(initialData, 'priority', permissions, currentUser)}
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Urgent">Urgent</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Assignee(s) / Batch Team</label>
                    <AssigneeSelector
                      value={formData.assigned_to}
                      onChange={(val) => setFormData({...formData, assigned_to: val})}
                      currentUser={currentUser}
                      disabled={!taskUtils.canUserEditField(initialData, 'assigned_to', permissions, currentUser)}
                    />
                  </div>
                </div>

                <div className="form-row-grid">
                  <div className="form-group">
                    <label>Function Component</label>
                    <select 
                      className="master-dropdown"
                      value={formData.function}
                      onChange={(e) => setFormData({...formData, function: e.target.value})}
                      disabled={!taskUtils.canUserEditField(initialData, 'function', permissions, currentUser)}
                    >
                      <option value="">N/A (General)</option>
                      {functions.map(fn => (
                        <option key={fn.name} value={fn.name}>
                          {fn.function_code ? `[${fn.function_code}] ${fn.name}` : fn.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <TaskHierarchySelector 
                    value={formData.parentTask}
                    onChange={(val) => setFormData({...formData, parentTask: val})}
                    availableTasks={availableTasks}
                    disabled={!taskUtils.canUserEditField(initialData, 'parentTask', permissions, currentUser)}
                  />
                </div>

                <div className="form-group">
                  <label>Detailed Description</label>
                  <textarea 
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    placeholder="Enter task details..."
                    rows={4}
                    disabled={!taskUtils.canUserEditField(initialData, 'description', permissions, currentUser)}
                  />
                </div>
              </>
            ) : (
              /* PAGE 2: ORCHESTRATION */
              <div className="orchestration-page fade-in">
                <div className="orchestration-header">
                  <h3>Task Orchestration</h3>
                  <p>Assign specific team members to each hub execution.</p>
                </div>

                <div className="orchestration-list">
                  {orchestrationMapping.map((item, idx) => (
                    <div key={idx} className="orchestration-row">
                      <div className="orch-hub-info">
                        <span className="orch-index">#{idx + 1}</span>
                        <span className="orch-hub-code">
                          {hubs.find(h => h.id === item.hub_id)?.hub_code || 'HUB'}
                        </span>
                      </div>
                      <div className="orch-assignee-select">
                        <AssigneeSelector
                          value={item.assigned_to}
                          onChange={(val) => {
                            const next = [...orchestrationMapping];
                            next[idx] = { ...next[idx], assigned_to: val };
                            setOrchestrationMapping(next);
                          }}
                          currentUser={currentUser}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <button 
                  type="button" 
                  className="orch-back-link"
                  onClick={() => setStep(1)}
                >
                  ← Back to Details
                </button>
              </div>
            )}
          </div>
        ) : (
          /* History Tab */
          <div className="history-tab-content fade-in">
            <SubmissionHistory
              taskId={safeData.id}
              permissions={permissions}
              currentUser={currentUser}
              onStatusUpdate={onSubmissionStatusUpdate}
              onCountLoad={setSubmissionCount}
            />
          </div>
        )}

        {/* FAN-OUT PREDICTION LOGIC */}
        {(formData.hub_ids.length > 1 || formData.assigned_to.length > 1) && (
          <div className="fanout-prediction-box anim-slide-up">
            <div className="prediction-header">
              <span className="prediction-icon">⚡</span>
              <h4>Automation Insight</h4>
            </div>
            <div className="prediction-content">
              {formData.hub_ids.length > 1 ? (
                <div className="prediction-detail">
                  <p><strong>Batch Orchestration (Mode 3) Detected:</strong></p>
                  <p>This will create <strong>{Math.max(formData.hub_ids.length, formData.assigned_to.length) + 1}</strong> tasks (1 Umbrella + {Math.max(formData.hub_ids.length, formData.assigned_to.length)} Hub-specific).</p>
                  <ul>
                    <li>Umbrella Hub: {formData.city} / MULTI</li>
                    <li>Primary Lead: {allEmployees.find(e => e.id === (formData.assigned_to[0]))?.full_name || 'Senior-most'}</li>
                  </ul>
                </div>
              ) : formData.assigned_to.length > 1 ? (
                <div className="prediction-detail">
                  <p><strong>Assignee Fan-Out (Mode 2) Detected:</strong></p>
                  <p>This will create <strong>{formData.assigned_to.length}</strong> tasks (one for each person).</p>
                </div>
              ) : null}
              <p className="prediction-disclaimer">Tasks will be generated as a "Batch" linked to a parent task.</p>
            </div>
          </div>
        )}
      </div>

      <div className="form-footer sticky">
        {(formData.hub_ids.length > 1 || formData.assigned_to.length > 1) && step === 1 ? (
          <button 
            type="button" 
            className="halo-button save-btn" 
            onClick={handleNextStep}
          >
            Next: Orchestrate Team
          </button>
        ) : isDirty ? (
          <button type="submit" className="halo-button save-btn" disabled={loading}>
            {loading ? 'Saving...' : (safeData.id ? 'Update Task' : 'Create Batch')}
          </button>
        ) : (
          <button type="button" className="halo-button close-btn" onClick={onCancel} style={{ opacity: 0.6 }}>
            Close
          </button>
        )}
      </div>

    </form>
  );
};

export default HubTaskForm;
