import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/core/supabaseClient';
import AssigneeSelector from '../../components/AssigneeSelector';
import TaskHierarchySelector from '../../components/TaskHierarchySelector';
import SubmissionHistory from '../../components/SubmissionHistory';
import { taskUtils } from '../../utils/taskUtils';
import HubSelector from './HubSelector';
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

  // Check if form has changes
  const isDirty = safeData.id ? Object.keys(formData).some(key => {
    const initialVal = safeData[key] || '';
    const currentVal = formData[key] || '';
    return initialVal !== currentVal;
  }) : true; // Always dirty for new tasks
  const [submissionCount, setSubmissionCount] = useState(0);
  const [hubs, setHubs] = useState([]);
  const [functions, setFunctions] = useState([]);

  const fetchHubs = async () => {
    let { data } = await supabase.from('hubs').select('id, name, city, hub_code').order('name');
    
    if (data) {
      // Find if we already have an 'ALL' hub
      const allHub = data.find(h => h.name === 'ALL');
      
      if (!allHub) {
        // Automatically provision an 'ALL' hub to satisfy UUID relationships
        const { data: newHub } = await supabase
          .from('hubs')
          .insert([{ name: 'ALL', hub_code: 'ALL', city: 'System', status: 'Active' }])
          .select();
          
        if (newHub) {
          data = [...newHub, ...data];
        }
      }
      setHubs(data);
    }
  };

  const fetchFunctions = async () => {
    const { data } = await supabase.from('hub_functions').select('name, function_code').order('name');
    if (data) setFunctions(data);
  };

  useEffect(() => {
    fetchHubs();
    fetchFunctions();
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

  const handleSubmit = (e) => {
    e.preventDefault();

    // 1. Resolve primary hub for text formatting
    const primaryHub = hubs.find(h => h.id === formData.hub_ids[0]);
    
    // 2. Format task text using the established utility
    const finalTaskText = taskUtils.formatTaskText(formData.text, {
      assetCode: primaryHub?.hub_code,
      functionName: formData.function,
      forcePrefix: formData.hub_ids.length > 0
    });

    // 3. Construct Payload
    const submissionPayload = {
      ...formData,
      text: finalTaskText,
      // NEW: Pass all selected hubs
      hub_ids: formData.hub_ids, 
      // BACKWARD COMPAT: Set single hub_id to the first selection
      hub_id: formData.hub_ids[0] || null 
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
                    <span className="mode-badge mode-3-badge">🔀 Multi-Hub Generation</span>
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
                <label>Assigned To</label>
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
                  <p><strong>Multi-Hub Mode (Mode 3) Detected:</strong></p>
                  <p>This will create <strong>{formData.hub_ids.length}</strong> identical tasks across selected hubs.</p>
                  <ul>
                    <li>Primary Hub: {hubs.find(h => h.id === formData.hub_ids[0])?.hub_code}</li>
                    <li>Total Secondary Links: {formData.hub_ids.length - 1}</li>
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
        {isDirty ? (
          <button type="submit" className="halo-button save-btn" disabled={loading}>
            {loading ? 'Saving...' : (safeData.id ? 'Update Task' : 'Create Task')}
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
