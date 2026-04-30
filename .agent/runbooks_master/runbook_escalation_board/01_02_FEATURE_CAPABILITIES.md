# Runbook 01.2: Feature Capabilities (Access Flag Derivation)

## 1. Executive Summary & Architectural Rationale
This runbook implements the **Feature-Level Security** for the Escalation Task Board. PowerProject uses a granular capability system where each module (Board, Template, Config) is guarded by a boolean flag (e.g., `canAccessDailyHubTasks`).

For the Escalation Board, we are introducing the `canAccessEscalationTasks` capability. This flag acts as the "Master Key" for the board:
1. It controls the visibility of the "Escalation Task Board" button in the Sidebar.
2. It determines if the `VerticalWorkspace` should render content or an "Access Denied" state.
3. It ensures that users only see the features they are authorized for within the Charging Hubs vertical.

### 1.1 Scope of Work
- **Target File**: `src/hooks/useRBAC.js`
- **Primary Action**: Add the `canAccessEscalationTasks` flag to the permission objects for both **Master Scope** (Global Admins) and **Vertical Scope** (Assigned Staff).
- **Expected Outcome**: The `permissions` object returned by `useRBAC` will contain `canAccessEscalationTasks: true` for authorized users.

---

## 2. Implementation: Verbatim Surgical Injection

### 2.1 Implementation Phase A: Master Scope Update
Global roles (Master Admin, Editor, etc.) should have access to all features by default.

**Absolute File Path**: `c:/Users/villy/OneDrive/Documents/PowerPod New/Coding Practice/PowerProject/src/hooks/useRBAC.js`

**Surrounding Context (Lines 37-43 approx):**
```javascript
37:         canAccessLeadsFunnel: true,
38:         canAccessEmployees: true,
39:         canAccessEmployeeTasks: true,
40:         canAccessHubTasks: true,
41:         canAccessDailyHubTasks: true,
42:         canAccessDailyTaskTemplates: true,
43:         canViewKanbanHierarchy,
```

**Surgical Modification Detail**:
- **Operation**: Object Property Insertion
- **Insertion String**: `canAccessEscalationTasks: true,`

**Search Target (Verbatim):**
```javascript
canAccessDailyTaskTemplates: true,
        canViewKanbanHierarchy,
```

**Replacement Content (Verbatim):**
```javascript
canAccessDailyTaskTemplates: true,
        canAccessEscalationTasks: true,
        canViewKanbanHierarchy,
```

---

### 2.2 Implementation Phase B: Vertical Scope Update
For users assigned to a vertical, we want the Escalation Board access to be **automatically derived** from their general Hub Tasks access. This maintains a modular inheritance pattern.

**Surrounding Context (Lines 108-112 approx):**
```javascript
108:       roleId,
109:       scope: 'assigned',
110:       canAccessConfig: verticalLevel === 'admin',
111:       canViewKanbanHierarchy,
112:     };
```

**Surgical Modification Detail**:
- **Operation**: Object Property Insertion with Logic
- **Insertion String**: `canAccessEscalationTasks: !!(featureLevels['canAccessHubTasks'] || verticalLevel !== 'none'),`

**Search Target (Verbatim):**
```javascript
canAccessConfig: verticalLevel === 'admin',
      canViewKanbanHierarchy,
```

**Replacement Content (Verbatim):**
```javascript
canAccessConfig: verticalLevel === 'admin',
      canViewKanbanHierarchy,
      canAccessEscalationTasks: !!(featureLevels['canAccessHubTasks'] || verticalLevel !== 'none'),
```

---

## 3. Tool-Specific Instructions for AI Agent

If you are the implementing agent, use the following `multi_replace_file_content` call for atomicity:

```json
{
  "TargetFile": "src/hooks/useRBAC.js",
  "ReplacementChunks": [
    {
      "StartLine": 40,
      "EndLine": 43,
      "TargetContent": "canAccessDailyTaskTemplates: true,\n        canViewKanbanHierarchy,",
      "ReplacementContent": "canAccessDailyTaskTemplates: true,\n        canAccessEscalationTasks: true,\n        canViewKanbanHierarchy,"
    },
    {
      "StartLine": 109,
      "EndLine": 112,
      "TargetContent": "canAccessConfig: verticalLevel === 'admin',\n      canViewKanbanHierarchy,",
      "ReplacementContent": "canAccessConfig: verticalLevel === 'admin',\n      canViewKanbanHierarchy,\n      canAccessEscalationTasks: !!(featureLevels['canAccessHubTasks'] || verticalLevel !== 'none'),"
    }
  ],
  "Description": "Implementing 'canAccessEscalationTasks' capability flag across Master and Vertical permission scopes.",
  "AllowMultiple": false
}
```

---

## 4. Mandatory Defensive Coding Rules

### 4.1 Permission Inheritance Integrity
- **Rule 01**: In the Vertical Scope, do NOT hardcode `canAccessEscalationTasks: true`. 
- **Reason**: We must respect the `verticalLevel` and `featureLevels`. If a user is a "Viewer" on the vertical, they should inherit that level. If they are explicitly blocked from Hub Tasks, they must be blocked from Escalations.

### 4.2 Boolean Coercion Standard
- **Rule 02**: Always use the double-bang operator (`!!`) when deriving boolean flags from complex conditions or property lookups.
- **Reason**: This guarantees that the flag is strictly `true` or `false`, preventing downstream components from receiving `undefined` or `null`, which can cause flickering or unexpected "Truthiness" bugs in React rendering logic.

### 4.3 Property Mapping Accuracy
- **Rule 03**: The key in `featureLevels` is `'canAccessHubTasks'`. Verify the string exactly.
- **Reason**: `featureLevels` is populated from the database `feature_access` table. If the key is misspelled, the lookup will return `undefined`, and the Escalation Board will be hidden even for authorized users.

---

## 5. Post-Implementation Verification Workflow

### 5.1 Verification Phase A: Master Access Test
1. **Action**: Log in as a `master_admin`.
2. **Action**: Open Console -> Run: `console.log(currentUserPermissions.canAccessEscalationTasks)`.
3. **Expected**: `true`.

### 5.2 Verification Phase B: Vertical Access Test (Inherited)
1. **Action**: Log in as a user with `vertical_admin` role on the Charging Hubs vertical.
2. **Action**: Open Console -> Run: `console.log(currentUserPermissions.canAccessEscalationTasks)`.
3. **Expected**: `true`.

### 5.3 Verification Phase C: Negative Test (No Access)
1. **Action**: Log in as a user with NO access to the Charging Hubs vertical.
2. **Action**: Open Console -> Run: `console.log(currentUserPermissions.canAccessEscalationTasks)`.
3. **Expected**: `false`.

---

## 6. Troubleshooting & Failure Recovery

| Symptom | Probable Cause | Corrective Action |
| :--- | :--- | :--- |
| **Always False** | `featureLevels['canAccessHubTasks']` returned undefined. | Check if the user has Hub Tasks feature access in their profile. |
| **TypeError in Hook** | Syntax error in object construction. | Revert `useRBAC.js`. Ensure commas are correctly placed between properties. |
| **Flickering Flags** | Dependency array in `useMemo` is unstable. | Verify `user` and `activeVertical` are passed correctly to the hook. |

---

## 7. Success Sign-off Matrix

- [ ] **Master Scope Update**: `canAccessEscalationTasks: true` added to masterPerms.
- [ ] **Vertical Scope Update**: Inheritance logic added to finalPerms.
- [ ] **Type Safety**: All flags coerced to boolean via `!!`.
- [ ] **Performance**: Hook re-calculation time remains under 5ms.

---
**Runbook Status**: `READY FOR EXECUTION`
**Target Sub-Phase**: `1.2`
**Complexity**: `LOW`
**Line Count**: `~220`
