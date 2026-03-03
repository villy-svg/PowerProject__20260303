/**
 * TASK_STAGES
 * Central configuration for the universal workflow.
 * To ADD/EDIT/REMOVE: Simply modify this object.
 * * Logic Update: Added 'showInVerticalSummary' flag to specific stages 
 * to drive the Matrix View on the Executive Summary page.
 */
export const TASK_STAGES = {
  BACKLOG: { 
    id: 'BACKLOG', 
    label: 'Pending', 
    color: '#71717a', // Zinc/Grey
    description: 'Upcoming tasks',
    showInVerticalSummary: true // Included in Vertical Breakdown
  },
  IN_PROGRESS: { 
    id: 'IN_PROGRESS', 
    label: 'In Progress', 
    color: '#3b82f6', // Blue
    description: 'Active work',
    showInVerticalSummary: true // Included in Vertical Breakdown
  },
  REVIEW: { 
    id: 'REVIEW', 
    label: 'Review', 
    color: '#f59e0b', // Amber/Yellow
    description: 'Awaiting verification',
    showInVerticalSummary: true // Included in Vertical Breakdown
  },
  COMPLETED: { 
    id: 'COMPLETED', 
    label: 'Completed', 
    color: '#10b981', // Emerald/Green
    description: 'Done',
    showInVerticalSummary: false
  },
  DEPRIORITIZED: {
    id: 'DEPRIORITIZED',
    label: 'Deprioritized',
    color: '#94a3b8', 
    description: 'Tasks on hold or low priority',
    showInVerticalSummary: false
  }
};

// Provides an array for .map() in UI components
export const STAGE_LIST = Object.values(TASK_STAGES);