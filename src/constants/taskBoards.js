/**
 * src/constants/taskBoards.js
 * 
 * Maps activeVertical view keys to their canonical task_board labels.
 * Used for both inference (when creating tasks) and filtering (when viewing boards).
 */

export const TASK_BOARD_MAP = {
  // Key order matters for substring matching: 'daily_hub' must precede 'hub'
  'daily_hub': 'Hubs Daily',
  'escalation': 'Escalations',
  'hub':       'Hubs',
  'client':    'Clients',
  'employee':  'Employees',
};

/**
 * Normalizes an activeVertical string to a canonical Task Board label.
 */
export const getBoardLabelForVertical = (activeVertical = '') => {
  if (!activeVertical) return null;
  const lower = activeVertical.toLowerCase();
  
  // Key order matters: more specific sub-views first
  if (lower.includes('daily_hub')) return TASK_BOARD_MAP['daily_hub'];
  if (lower.includes('escalation')) return TASK_BOARD_MAP['escalation'];
  
  // Then generic vertical boards
  if (lower.includes('hub')) return TASK_BOARD_MAP['hub'];
  if (lower.includes('client')) return TASK_BOARD_MAP['client'];
  if (lower.includes('employee')) return TASK_BOARD_MAP['employee'];
  
  return null; 
};
