/**
 * src/constants/taskSchema.js
 */
import { generateUUID } from '../utils/uuid';

export const createInitialTask = (text, verticalId) => ({
  id: generateUUID(),      // Unique identifier
  // BUG-FIX: Guard against null/undefined text — can occur when modal is opened
  // via handleAddSubtask which passes { parentTask: id } with no text field.
  text: (text || '').trim(),    // Content
  verticalId: verticalId,       // Links task to specific Manager
  stageId: 'BACKLOG',           // Default starting stage
  createdAt: new Date().toISOString(), // Standardized timestamp
  updatedAt: new Date().toISOString()  // Useful for tracking changes
});