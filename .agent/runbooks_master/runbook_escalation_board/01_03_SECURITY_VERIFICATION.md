# Runbook 01.3: Security Verification (RBAC Audit Protocol)

## 1. Executive Summary & Architectural Rationale
Security is the absolute priority of the PowerProject ecosystem. Before proceeding to the service layer and UI implementation, we must perform a **Final Security Audit** of the modifications made in Phase 1.1 and 1.2. 

This runbook focuses on verifying the integrity of the **Vertical Sandbox**. We must ensure that:
1. The `escalation_tasks` sub-view correctly inherits the security boundary of the parent Hubs vertical.
2. The CRUD (Create, Read, Update, Delete) capabilities are accurately derived and restricted based on role seniority.
3. No data leakage occurs between disconnected verticals (e.g., a Client Manager user seeing Hub Escalations).

### 1.1 Scope of Work
- **Target File**: `src/hooks/useRBAC.js` (Final Audit)
- **Primary Action**: Implementation of Explicit CRUD Aliases and functional validation of the permission matrix.
- **Expected Outcome**: A 100% verified security layer that correctly gates access and operations on the Escalation Board.

---

## 2. Implementation: Verbatim Surgical Injection

### 2.1 Implementation Phase A: Explicit CRUD Capability Aliasing
While the generic loop in `useRBAC.js` handles most feature permissions, we want to ensure the Escalation Board inherits the exact CRUD capabilities of the parent Hub Tasks for maximum reliability and future-proofing.

**Absolute File Path**: `c:/Users/villy/OneDrive/Documents/PowerPod New/Coding Practice/PowerProject/src/hooks/useRBAC.js`

**Surrounding Context (Lines 130-133 approx):**
```javascript
130:       finalPerms[`canDelete${featureName}`] = featureCaps.canDelete;
131:     });
132: 
133:      return finalPerms;
```

**Surgical Modification Detail**:
- **Operation**: Object Property Augmentation (After Loop)
- **Insertion String**: Detailed CRUD Aliases

**Search Target (Verbatim):**
```javascript
    });

     return finalPerms;
```

**Replacement Content (Verbatim):**
```javascript
    });

    // --- ESCALATION BOARD CRUD ALIASING ---
    // Inherit standard Hub Task capabilities to ensure identical operation rights.
    // This solves the 'Ghost Permissions' issue where a user can view but not edit.
    finalPerms.canCreateEscalationTasks = !!(finalPerms.canCreateHubTasks || finalPerms.canCreate);
    finalPerms.canReadEscalationTasks   = !!(finalPerms.canReadHubTasks   || finalPerms.canRead);
    finalPerms.canUpdateEscalationTasks = !!(finalPerms.canUpdateHubTasks || finalPerms.canUpdate);
    finalPerms.canDeleteEscalationTasks = !!(finalPerms.canDeleteHubTasks || finalPerms.canDelete);

     return finalPerms;
```

---

## 3. Tool-Specific Instructions for AI Agent

If you are the implementing agent, use the following `replace_file_content` call to finalize the security layer:

```json
{
  "TargetFile": "src/hooks/useRBAC.js",
  "StartLine": 131,
  "EndLine": 133,
  "TargetContent": "    });\n\n     return finalPerms;",
  "ReplacementContent": "    });\n\n    // --- ESCALATION BOARD CRUD ALIASING ---\n    finalPerms.canCreateEscalationTasks = !!(finalPerms.canCreateHubTasks || finalPerms.canCreate);\n    finalPerms.canReadEscalationTasks   = !!(finalPerms.canReadHubTasks   || finalPerms.canRead);\n    finalPerms.canUpdateEscalationTasks = !!(finalPerms.canUpdateHubTasks || finalPerms.canUpdate);\n    finalPerms.canDeleteEscalationTasks = !!(finalPerms.canDeleteHubTasks || finalPerms.canDelete);\n\n     return finalPerms;",
  "Description": "Finalizing explicit CRUD capability aliasing for the Escalation Task Board in the RBAC hook.",
  "AllowMultiple": false
}
```

---

## 4. Mandatory Defensive Coding Rules

### 4.1 Strict Capability Coupling
- **Rule 01**: Always couple Escalation capabilities to Hub Tasks capabilities.
- **Reason**: The Escalation Board is a subset of Hub Tasks. If a user loses "Delete" rights on Hubs, they MUST lose them on Escalations instantly. Using the `||` with global `canDelete` ensures Master Admins still have full override rights.

### 4.2 Explicit Boolean Logic
- **Rule 02**: Use `!!` on all alias assignments.
- **Reason**: Database fields and intermediate logic objects can return `undefined`, `null`, or `0`. Explicit coercion ensures that React props received by the UI are always strictly `true` or `false`.

---

## 5. Post-Implementation Verification Protocol

This is the most critical verification phase. Perform each step as described.

### 5.1 Verification Phase A: Permission Matrix Validation
Log in as the following roles and verify the permissions in the console:
`console.table(currentUserPermissions)`

| Role | Expectation: canAccessEscalationTasks | Expectation: canUpdateEscalationTasks |
| :--- | :--- | :--- |
| **Master Admin** | `true` | `true` |
| **Vertical Admin (Hubs)** | `true` | `true` |
| **Vertical Viewer (Hubs)** | `true` | `false` |
| **Staff (Clients Only)** | `false` | `false` |

### 5.2 Verification Phase B: Vertical Boundary Integrity
1.  **Action**: Set `localStorage.setItem('power_project_active_vertical', 'escalation_tasks')`.
2.  **Action**: Refresh the page.
3.  **Action**: Run `console.log(currentUserPermissions.rootVerticalId)`.
4.  **Expected**: The value MUST match the `CHARGING_HUBS` vertical ID. If it is `HOME` or `CLIENTS`, the security layer is breached.

### 5.3 Verification Phase C: Logical Consistency Check
1.  **Action**: Check if `canReadEscalationTasks` is `true`.
2.  **Action**: Confirm `canAccessEscalationTasks` is also `true`.
3.  **Rule**: It is an invalid state to have CRUD access without feature access.

---

## 6. Troubleshooting & Failure Recovery

| Symptom | Probable Cause | Corrective Action |
| :--- | :--- | :--- |
| **Permissions Undefined** | Alias block placed before `finalPerms` object is fully initialized. | Move the alias block to just before the `return finalPerms;` statement. |
| **Admin cannot Delete** | `finalPerms.canDeleteHubTasks` was false for the admin. | Ensure the `|| finalPerms.canDelete` part of the logic is included. |
| **Console Errors** | Multiple definitions of `finalPerms`. | Verify that you didn't accidentally redeclare the variable. |

---

## 7. Success Sign-off Matrix

- [ ] **Code Integrity**: `src/hooks/useRBAC.js` passes syntax check.
- [ ] **CRUD Integrity**: All 4 CRUD flags are strictly boolean and correctly derived.
- [ ] **Matrix Audit**: All 4 test roles pass the permission matrix verification.
- [ ] **Boundary Audit**: `escalation_tasks` is locked to the Hubs vertical sandbox.

---
**Runbook Status**: `READY FOR EXECUTION`
**Target Sub-Phase**: `1.3`
**Complexity**: `MEDIUM` (Audit Phase)
**Line Count**: `~225`
