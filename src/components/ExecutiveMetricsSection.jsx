import React, { useState } from 'react';
import { STAGE_LIST } from '../constants/stages';
import { VERTICAL_LIST } from '../constants/verticals';
import './ExecutiveMetricsSection.css';

/**
 * ExecutiveMetricsSection Component
 * Renders the Stage summary grid metrics and vertical-by-vertical aggregations.
 */
const ExecutiveMetricsSection = ({
  visibleTasks = [],
  verticalList = [],
  loading = false,
  isMobile = false
}) => {
  const [expandedStageId, setExpandedStageId] = useState(null);
  const showVerticalBreakdown = true;

  const currentVerticalList = verticalList.length > 0 ? verticalList : VERTICAL_LIST;

  return (
    <div className="executive-summary-section animate-fade-in">
      <div className="summary-header">
        <h2>Executive Summary</h2>
      </div>
      
      <div className="summary-grid">
        {STAGE_LIST.map((stage) => {
          // Calculate count based on the multi-vertical scoped visibleTasks
          const stageCount = visibleTasks.filter(t => t.stageId === stage.id).length;

          // Only calculate breakdown list if the user has visible tasks in this stage
          const activeVerticalsInStage = showVerticalBreakdown 
            ? currentVerticalList.filter(v => 
                visibleTasks.some(t => t.verticalId === v.id && t.stageId === stage.id)
              )
            : [];

          const isExpanded = isMobile ? expandedStageId === stage.id : true;
          const showBreakdown = showVerticalBreakdown && stage.showInVerticalSummary && activeVerticalsInStage.length > 0 && isExpanded;

          const handleToggle = () => {
            if (!isMobile) return;
            setExpandedStageId(prev => prev === stage.id ? null : stage.id);
          };

          return (
            <div 
              key={stage.id} 
              className={`summary-column-group ${isMobile ? 'is-mobile' : ''} ${isExpanded ? 'is-expanded' : ''}`}
              style={{ '--stage-color': stage.color }}
              onClick={handleToggle}
            >
              <div className={`summary-card ${isMobile && activeVerticalsInStage.length > 0 ? 'is-tappable' : ''}`}>
                  <div className="summary-card-content">
                    <span className="summary-count">
                      {loading ? <span className="counting-placeholder">...</span> : stageCount}
                    </span>
                    <span className="summary-label">
                      {loading ? 'Calculating...' : stage.label}
                    </span>
                  </div>
                  {isMobile && activeVerticalsInStage.length > 0 && (
                    <div className={`expand-indicator ${isExpanded ? 'active' : ''}`}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="6 9 12 15 18 9"></polyline>
                      </svg>
                    </div>
                  )}
              </div>

              {/* Breakdown list is gated by the scope permission AND expanded state on mobile */}
              {showBreakdown && (
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

export default ExecutiveMetricsSection;
