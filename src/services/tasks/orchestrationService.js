/**
 * Orchestration Service
 * Core logic for intelligent task fan-out and team mapping.
 * Encapsulates the "Multi-Hub" and "Batch" creation principles.
 */

// FIX Bug7/Bug4: Centralised seniority comparator — replaces duplicated sort blocks.
// Numeric badge IDs are compared numerically to avoid '99' > '100' string-sort bug.
const bySeniority = (a, b) => {
  const numA = Number(a?.badge_id);
  const numB = Number(b?.badge_id);
  if (!isNaN(numA) && !isNaN(numB) && numA !== numB) return numA - numB;
  const strA = String(a?.badge_id || '999999');
  const strB = String(b?.badge_id || '999999');
  if (strA !== strB) return strA.localeCompare(strB);
  return (a?.seniority_level || 999) - (b?.seniority_level || 999);
};

export const orchestrationService = {
  /**
   * Identifies the senior-most assignee from a list.
   * Seniority is determined by:
   * 1. Badge ID (lexicographical comparison)
   * 2. Seniority Level (numerical comparison)
   */
  getSeniorMostAssignee(assigneeIds, allEmployees) {
    if (!assigneeIds || assigneeIds.length === 0) return null;
    
    const sorted = [...assigneeIds]
      .map(id => allEmployees.find(e => e.id === id))
      .filter(Boolean)
      .sort(bySeniority); // FIX Bug7: Use shared numeric-safe comparator

    return sorted[0] || null;
  },

  /**
   * Generates a granular mapping of Hubs to Assignees.
   * Implements the 3-pass intelligent allocation algorithm.
   */
  calculateOrchestration(hubIds = [], assigneeIds = [], allEmployees = []) {
    if (Math.max(hubIds.length, assigneeIds.length) === 0) return [];

    const mappings = [];
    const assignedIds = new Set();
    const hubsFilled = new Set();

    // 1. Resolve full employee objects for seniority logic
    const candidates = [...assigneeIds]
      .map(id => allEmployees.find(e => e.id === id))
      .filter(Boolean)
      .sort(bySeniority); // FIX Bug7: Use shared numeric-safe comparator

    // PASS 1: Guarantee every selected Hub gets exactly one mapping
    hubIds.forEach(hId => {
      // 1a. Find senior-most from this home hub
      let assignee = candidates.find(emp => emp.hub_id === hId && !assignedIds.has(emp.id));
      
      // 1b. If none, pick the highest available orphan
      if (!assignee) {
        assignee = candidates.find(emp => !assignedIds.has(emp.id));
      }

      // 1c. If everyone is fully booked, double up the absolute senior-most
      if (!assignee) {
        assignee = candidates[0];
      }

      if (assignee) {
        mappings.push({ hub_id: hId, assigned_to: [assignee.id] });
        assignedIds.add(assignee.id);
      }
      hubsFilled.add(hId);
    });

    // PASS 2: Assign remaining employees evenly
    // FIX Bug4: Use a dedicated orphanIndex counter instead of mappings.length,
    // which is already N after Pass 1 and never resets — causing all orphans to
    // pile on hub index 0 rather than distributing evenly.
    let orphanIndex = 0;
    candidates.forEach(emp => {
      if (!assignedIds.has(emp.id)) {
        let targetHub = null;
        
        if (hubIds.length > 0) {
          // Round-robin across all selected hubs to balance workload
          targetHub = hubIds[orphanIndex % hubIds.length];
          orphanIndex++;
        } else {
          // Absolute fallback for pure assignee fan-out
          targetHub = emp.hub_id; 
        }

        mappings.push({ hub_id: targetHub, assigned_to: [emp.id] });
        assignedIds.add(emp.id);
      }
    });

    return mappings;
  },

  /**
   * Predicts the outcome of a submission.
   * Returns a summary object for UI display.
   */
  predictFanOut(hubIds = [], assigneeIds = []) {
    const isMultiHub = hubIds.length > 1;
    const isMultiAssignee = !isMultiHub && assigneeIds.length > 1;
    
    if (isMultiHub) {
      return {
        mode: 3,
        // FIX Bug1: Always 1 parent + 1 child per hub. Assignees are mapped TO hubs,
        // not multiplied, so the child count equals hubIds.length, not max(hubs,assignees).
        totalTasks: hubIds.length + 1,
        type: 'Batch Orchestration',
        description: 'Umbrella task + individual hub executions.'
      };
    }
    
    if (isMultiAssignee) {
      return {
        mode: 2,
        totalTasks: assigneeIds.length,
        type: 'Assignee Fan-Out',
        description: 'One unique task for each assigned team member.'
      };
    }

    return {
      mode: 1,
      totalTasks: 1,
      type: 'Single Task',
      description: 'Standard single-entity assignment.'
    };
  }
};
