---
name: Sphere of Influence & Hierarchy Security
description: Advanced security layer that restricts task visibility and management based on employee seniority and reporting structure.
---

# Sphere of Influence & Hierarchy Security

PowerProject implements an "over-and-above" security layer on top of standard RBAC. While RBAC defines *what* a user can do (CRUD), the **Sphere of Influence** defines *which* records they can do it to.

## 1. Core Concepts

### Seniority Threshold
The system uses a `MANAGER_SENIORITY_THRESHOLD` (set to `6` in `src/constants/roles.js`) to distinguish user types.
- **Restricted Users (≤ 6)**: Typically assignees or field staff.
- **Managers (> 6)**: Hub managers, vertical admins, and master admins.

### The Sphere of Influence
For users with seniority ≤ 6, their visibility is restricted to:
1.  **Self**: Tasks assigned to their `employee_id` or `user_id`.
2.  **Creation**: Tasks created by their `employee_id` or `user_id`.
3.  **Reporting Tree**: Tasks created by any employee in their downward reporting line (calculated via `hierarchyUtils.getDescendants`).

## 2. Implementation Architecture

### Hierarchy Service (`hierarchyService.js`)
The `filterTasksByHierarchy` function is the canonical source for this logic.

```javascript
// Example logic from hierarchyService.js
if (seniority <= MANAGER_SENIORITY_THRESHOLD) {
  return tasks.filter(task => {
    const isAssignedToMe = (task.assigned_to === user.employeeId);
    const isCreatedByMe = (task.createdBy === user.id);
    const isCreatedByTreeMember = (user.reporteeUserIds || []).includes(task.createdBy);
    
    return isAssignedToMe || isCreatedByMe || isCreatedByTreeMember;
  });
}
```

### Context Propagation (`isContextOnly`)
To maintain the task hierarchy (Tree/Kanban views), users must see the parent tasks of their "sphered" tasks, even if the parent itself is outside their sphere.
- **`isContextOnly: true`**: These tasks are visible to provide a path but are **READ-ONLY** regardless of RBAC permissions.

## 3. UI Gating Rules

### `canManageHierarchy`
Always use the `canManageHierarchy` check (implemented in `TaskController.jsx`) for actions that mutate the structure (adding subtasks, moving tasks between parents).

```javascript
const canManageHierarchy = (task) => {
  if (task.isContextOnly) return false; // Hard block for context
  if (user.seniority > MANAGER_SENIORITY_THRESHOLD) return true; // Managers can manage anything
  return (task.createdBy === user.id); // Restricted users only manage their own creations
};
```

## 4. Troubleshooting
- **User can't see their tasks**: Ensure their `user_profile` is linked to an `employee_id`. The system has a "self-healing" link in `profileService.js` that attempts to link by email.
- **Manager can't see everything**: Verify their `seniority_level` in the `employee_roles` table is `> 6`.
