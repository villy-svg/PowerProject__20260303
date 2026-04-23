import React from 'react';
import { STAGE_LIST } from '../constants/stages';
import { VERTICAL_LIST } from '../constants/verticals';
import { hierarchyService } from '../services/rules/hierarchyService';
import './ExecutiveSummary.css';

/**
 * ExecutiveSummary Component
 * Displays task aggregates based on user permissions.
 * Multi-Vertical Update: Aggregates data from all assigned verticals in the array.
 */
const ExecutiveSummary = ({ tasks = [], user, permissions = {}, verticals = {}, verticalList = [], loading = false }) => {
  
  /**
    * REFACTORED SCOPE LOGIC
    * 1. First, apply Hierarchy Rules (Seniority, Reportees, etc.)
    * 2. Then, restrict to Assigned Verticals (unless Global Scope)
    */
  const hierarchyFiltered = hierarchyService.filterTasksByHierarchy(user, tasks, null, verticals, permissions);

  const hasGlobalScope = permissions.scope === 'global';
  
  // Final visibility: respects both organizational hierarchy AND vertical access bounds
  const visibleTasks = hasGlobalScope 
    ? hierarchyFiltered 
    : hierarchyFiltered.filter(t => user?.assignedVerticals?.includes(t.verticalId));

  /**
   * ACCESSIBLE BREAKDOWN
   * Previously only master admins (global scope) saw the breakdown.
   * Now, anyone can see the breakdown of their own authorized tasks.
   */
  const showVerticalBreakdown = true;

  return (
    <div className="home-summary-view">
      <div className="summary-header">
        <h2>Executive Summary</h2>
      </div>
      
      <div className="summary-grid">
        {STAGE_LIST.map((stage) => {
          // Calculate count based on the multi-vertical scoped visibleTasks
          const stageCount = visibleTasks.filter(t => t.stageId === stage.id).length;

          // Only calculate breakdown list if the user has visible tasks in this stage
          const activeVerticalsInStage = showVerticalBreakdown 
            ? (verticalList.length > 0 ? verticalList : VERTICAL_LIST).filter(v => 
                visibleTasks.some(t => t.verticalId === v.id && t.stageId === stage.id)
              )
            : [];

          return (
            <div 
              key={stage.id} 
              className="summary-column-group" 
              style={{ '--stage-color': stage.color }}
            >
              <div className="summary-card">
                  <span className="summary-count">
                    {loading ? <span className="counting-placeholder">...</span> : stageCount}
                  </span>
                  <span className="summary-label">
                    {loading ? 'Calculating...' : stage.label}
                  </span>
              </div>

              {/* Breakdown list is gated by the scope permission */}
              {showVerticalBreakdown && stage.showInVerticalSummary && activeVerticalsInStage.length > 0 && (
                <div className="vertical-breakdown-list">
                  {activeVerticalsInStage.map((vertical) => {
                    const vCount = visibleTasks.filter(
                      (t) => t.verticalId === vertical.id && t.stageId === stage.id
                    ).length;

                    return (
                      <div key={vertical.id} className="vertical-mini-row">
                        <span className="v-mini-label">{vertical.label}</span>
                        <span className="v-mini-count">{vCount}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ExecutiveSummary;