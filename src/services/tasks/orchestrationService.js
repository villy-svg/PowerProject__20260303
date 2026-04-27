/**
 * Orchestration Service
 * Core logic for intelligent task fan-out and team mapping.
 * Encapsulates the "Multi-Hub" and "Batch" creation principles.
 */
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
      .sort((a, b) => {
        const badgeA = String(a?.badge_id || '999999');
        const badgeB = String(b?.badge_id || '999999');
        if (badgeA !== badgeB) return badgeA.localeCompare(badgeB);
        return (a?.seniority_level || 999) - (b?.seniority_level || 999);
      });

    return sorted[0] || null;
  },

  /**
   * Generates a granular mapping of Hubs to Assignees.
   * Implements the 3-pass intelligent allocation algorithm.
   */
  calculateOrchestration(hubIds = [], assigneeIds = [], allEmployees = []) {
    const numTasks = Math.max(hubIds.length, assigneeIds.length);
    if (numTasks === 0) return [];

    const mappings = [];
    const assignedIds = new Set();
    const hubsFilled = new Set();

    // 1. Resolve full employee objects for seniority logic
    const candidates = [...assigneeIds]
      .map(id => allEmployees.find(e => e.id === id))
      .filter(Boolean)
      .sort((a, b) => {
        const badgeA = String(a?.badge_id || '999999');
        const badgeB = String(b?.badge_id || '999999');
        if (badgeA !== badgeB) return badgeA.localeCompare(badgeB);
        return (a?.seniority_level || 999) - (b?.seniority_level || 999);
      });

    const seniorMostId = candidates[0]?.id || assigneeIds[0];

    // PASS 1: Home Hub Matching (Priority to Seniority-aligned affinity)
    candidates.forEach(emp => {
      if (emp.hub_id && hubIds.includes(emp.hub_id) && !hubsFilled.has(emp.hub_id)) {
        mappings.push({ hub_id: emp.hub_id, assigned_to: [emp.id] });
        assignedIds.add(emp.id);
        hubsFilled.add(emp.hub_id);
      }
    });

    // PASS 2: Fill remaining selected Hubs
    hubIds.forEach(hId => {
      if (!hubsFilled.has(hId)) {
        const orphan = candidates.find(emp => !assignedIds.has(emp.id));
        if (orphan) {
          mappings.push({ hub_id: hId, assigned_to: [orphan.id] });
          assignedIds.add(orphan.id);
        } else {
          // If we run out of people, double up the senior-most
          mappings.push({ hub_id: hId, assigned_to: [seniorMostId] });
        }
        hubsFilled.add(hId);
      }
    });

    // PASS 3: Remaining Assignees (Orphans without a hub match)
    candidates.forEach(emp => {
      if (!assignedIds.has(emp.id)) {
        // Round-robin assignment to hubs
        const targetHub = hubIds[mappings.length % hubIds.length];
        mappings.push({ hub_id: targetHub, assigned_to: [emp.id] });
        assignedIds.add(emp.id);
      }
    });

    return mappings.slice(0, numTasks);
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
        totalTasks: Math.max(hubIds.length, assigneeIds.length) + 1,
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
