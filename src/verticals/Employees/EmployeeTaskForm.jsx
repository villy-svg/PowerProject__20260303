import React, { useEffect } from 'react';
import AssigneeSelector from '../../components/AssigneeSelector';
import TaskHierarchySelector from '../../components/TaskHierarchySelector';
import { taskUtils } from '../../utils/taskUtils';
import { useAssignees } from '../../hooks/useAssignees';
import { useTaskForm } from '../../hooks/useTaskForm';
import { orchestrationService } from '../../services/tasks/orchestrationService';

/**
 * EmployeeTaskForm
 * Vertical-specific form for Employee Manager tasks.
 * Refactored: Uses useTaskForm for unified state management.
 */
const EmployeeTaskForm = ({ onSubmit, onCancel, loading, initialData = {}, currentUser = {}, permissions = {}, availableTasks = [] }) => {
  const {
    formData,
    updateField,
    isDirty
  } = useTaskForm(initialData);

  const { assignees: allEmployees } = useAssignees(true);

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

    onSubmit({ ...formData, assigned_to: sortedAssigneeIds, text: finalTaskText });
  };

  return (
    <form className="vertical-task-form" onSubmit={handleSubmit}>
      <div className="form-group">
        <label>Task Summary</label>
        <input
          type="text"
          value={formData.text}
          onChange={(e) => updateField('text', e.target.value)}
          placeholder="e.g. Onboard new hire, Conduct performance review"
          required
          disabled={!taskUtils.canUserEditField(initialData, 'text', permissions, currentUser)}
        />
      </div>

      <div className="form-row-grid">
        <div className="form-group">
          <label>Priority</label>
          <select
            className="master-dropdown"
            value={formData.priority}
            onChange={(e) => updateField('priority', e.target.value)}
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
            onChange={(val) => updateField('assigned_to', val)}
            currentUser={currentUser}
            disabled={!taskUtils.canUserEditField(initialData, 'assigned_to', permissions, currentUser)}
          />
        </div>

        <TaskHierarchySelector 
          value={formData.parentTask}
          onChange={(val) => updateField('parentTask', val)}
          availableTasks={availableTasks}
          disabled={!taskUtils.canUserEditField(initialData, 'parentTask', permissions, currentUser)}
        />
      </div>

      <div className="form-group">
        <label>Detailed Description</label>
        <textarea
          value={formData.description}
          onChange={(e) => updateField('description', e.target.value)}
          placeholder="Enter task details..."
          rows={4}
          disabled={!taskUtils.canUserEditField(initialData, 'description', permissions, currentUser)}
        />
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

export default EmployeeTaskForm;
