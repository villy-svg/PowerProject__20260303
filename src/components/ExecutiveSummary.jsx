import React from 'react';
import { STAGE_LIST } from '../constants/stages';
import { VERTICAL_LIST } from '../constants/verticals';

/**
 * ExecutiveSummary Component
 * Displays task aggregates based on user permissions.
 * Multi-Vertical Update: Aggregates data from all assigned verticals in the array.
 */
const ExecutiveSummary = ({ tasks = [], user, permissions = {} }) => {
  
  /**
   * REFACTORED SCOPE LOGIC
   * 'global' = sees all tasks across the company.
   * 'assigned' = sees tasks for all verticals in the assignedVerticals array.
   */
  const hasGlobalScope = permissions.scope === 'global';
  
  // Scoped tasks based on the permissions matrix and assigned array
  const visibleTasks = hasGlobalScope 
    ? tasks 
    : tasks.filter(t => user?.assignedVerticals?.includes(t.verticalId));

  // Vertical breakdown is restricted to those with global oversight
  const showVerticalBreakdown = hasGlobalScope;

  return (
    <div className="home-summary-view">
      <div className="summary-header">
        <h2>Executive Summary</h2>
      </div>
      
      <div className="summary-grid">
        {STAGE_LIST.map((stage) => {
          // Calculate count based on the multi-vertical scoped visibleTasks
          const stageCount = visibleTasks.filter(t => t.stageId === stage.id).length;

          // Only calculate breakdown list if the user has global scope
          const activeVerticalsInStage = showVerticalBreakdown 
            ? VERTICAL_LIST.filter(v => 
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
                  <span className="summary-count">{stageCount}</span>
                  <span className="summary-label">{stage.label}</span>
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