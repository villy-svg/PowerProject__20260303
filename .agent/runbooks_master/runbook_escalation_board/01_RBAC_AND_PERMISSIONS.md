# Runbook 01: RBAC & Permission Mapping (Security Foundation)

## 1. Architectural Context
This runbook establishes the security and normalization layer for the **Escalation Task Board**. In PowerProject, "Boards" are often sub-views of a "Vertical". The Escalation Board is a specialized sub-view of the `CHARGING_HUBS` vertical. 

To ensure that the app correctly identifies which vertical the user is interacting with (for permissions, RLS, and data fetching), we must normalize the transient `escalation_tasks` key back to the root `CHARGING_HUBS` vertical.

---

## 2. Pre-Implementation Checklist
- [ ] Verify `verticals.CHARGING_HUBS?.id` is available in the current context.
- [ ] Ensure you have read the `RBAC Security System` skill documentation.
- [ ] Confirm the target file `src/hooks/useRBAC.js` is accessible.

---

## 3. Implementation Steps

### 3.1 Vertical Key Normalization
The `useRBAC` hook is responsible for determining the "Root Vertical" from the "Active Vertical". If the user is on the Escalation Board, they are still technically within the "Charging Hubs" security boundary.

**File**: `src/hooks/useRBAC.js`

1. Locate the `rootVerticalId` calculation block.
2. Inject the `escalation_tasks` identifier into the `CHARGING_HUBS` conditional logic.

```javascript
/**
 * REVISION: 1.0
 * TARGET: src/hooks/useRBAC.js
 * ACTION: Add 'escalation_tasks' to normalization logic.
 */

// Look for this block around line 67:
const rootVerticalId = 
  (current === verticals.CHARGING_HUBS?.id || 
   current === 'hub_tasks' || 
   current === 'daily_hub_tasks' || 
   current === 'daily_task_templates' || 
   current === 'escalation_tasks') // <--- ADD THIS LINE
    ? verticals.CHARGING_HUBS?.id 
    : (current === verticals.CLIENTS?.id || current === 'client_tasks' || current === 'leads_funnel') 
    ? verticals.CLIENTS?.id 
    : (current === verticals.EMPLOYEES?.id || current === 'employee_tasks') 
    ? verticals.EMPLOYEES?.id 
    : current.toUpperCase();
```

### 3.2 Capability Derivation
Next, we need to derive the `canAccessEscalationTasks` flag. This flag will be used in the frontend (specifically the sidebar) to determine if the user can even see the Escalation Board option.

**File**: `src/hooks/useRBAC.js`

1. In the `finalPerms` object construction (around line 113), ensure the logic correctly propagates permissions.
2. Since this board is a sub-feature of Hub Tasks, we will initially alias its access to `canAccessHubTasks`.

```javascript
// Inside the feature-granular CRUD flags block (around line 115):
// The loop already handles most feature flags, but we need to ensure 
// 'canAccessEscalationTasks' is explicitly set or correctly derived.

// ADDITIVE LOGIC:
finalPerms.canAccessEscalationTasks = finalPerms.canAccessHubTasks; // Inheritance pattern
```

---

## 4. Defensive Coding Standards

> [!WARNING]
> **Null Safety**: Always check if `verticals.CHARGING_HUBS` exists before accessing its `.id`. If it's undefined during early boot, the hook could throw a runtime error.

- **Check 1**: Ensure `current` is normalized to a string.
- **Check 2**: Verify that `verticals` is passed into the hook correctly from `App.jsx`.
- **Check 3**: Avoid hardcoding hex colors or roles; use the defined constants.

---

## 5. Verification Workflow

### 5.1 Static Verification (Code Review)
- [ ] Does `rootVerticalId` correctly return the Hubs UUID when `current === 'escalation_tasks'`?
- [ ] Is `canAccessEscalationTasks` boolean?
- [ ] Does the change impact Client or Employee verticals? (It should not).

### 5.2 Dynamic Verification (Console Tests)
You can test the logic by manually invoking the hook logic in the browser console (if accessible) or by adding a temporary logger:

```javascript
// Temporary Debug Log in App.jsx
useEffect(() => {
  if (activeVertical === 'escalation_tasks') {
    console.log('[RBAC DEBUG] Active:', activeVertical);
    console.log('[RBAC DEBUG] Root Vertical:', currentUserPermissions.rootVerticalId);
    console.log('[RBAC DEBUG] Can Access Escalations:', currentUserPermissions.canAccessEscalationTasks);
  }
}, [activeVertical, currentUserPermissions]);
```

---

## 6. Troubleshooting & Gotchas

| Issue | Potential Cause | Fix |
| :--- | :--- | :--- |
| **Blank Screen** | `current.split('_')` failed on null | Ensure `current` fallback to `'home'` is working. |
| **Access Denied** | `rootVerticalId` mismatch | Check if `CHARGING_HUBS` id in `verticals` map matches the DB UUID. |
| **Permissions Stale** | `useRBAC` deps missing | Ensure `activeVertical` and `verticals` are in the dependency array. |

---

## 7. Rollback Plan
If security regressions occur:
1. Revert changes to `src/hooks/useRBAC.js`.
2. Clear `localStorage` keys for `activeVertical` to reset to the Home dashboard.
3. Reload the application.

---

## 8. Progress Tracking
- [ ] Step 3.1: Normalization logic updated.
- [ ] Step 3.2: Capability derivation updated.
- [ ] Step 5: Verification complete.

**Next Runbook**: `02_SERVICE_AND_BOARD_MAPPING.md`
