/**
 * src/constants/taskSchema.js
 */
export const createInitialTask = (text, verticalId) => ({
  id: crypto.randomUUID(),      // Unique identifier
  text: text.trim(),            // Content
  verticalId: verticalId,       // Links task to specific Manager
  stageId: 'BACKLOG',           // Default starting stage
  createdAt: new Date().toISOString(), // Standardized timestamp
  updatedAt: new Date().toISOString()  // Useful for tracking changes
});