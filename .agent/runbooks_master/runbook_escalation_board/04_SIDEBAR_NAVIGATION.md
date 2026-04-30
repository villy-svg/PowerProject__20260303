# Runbook 04: Sidebar Navigation (User Interface)

## 1. Architectural Context
The `HubSubSidebar.jsx` is a vertical-specific component that provides navigation for the Charging Hubs vertical. It currently houses the "Hubs Task Board", "Daily Task Board", and "Daily Task Templates". 

Adding the "Escalation Task Board" here integrates it seamlessly into the existing Hubs workflow. The sidebar uses the `activeVertical` prop to determine which button is "active" and the `permissions` prop to control visibility.

---

## 2. Pre-Implementation Checklist
- [ ] Verify `canAccessEscalationTasks` is correctly derived in `useRBAC.js` (Phase 1).
- [ ] Confirm the CSS class `halo-button` is available in the global styles.
- [ ] Understand the color variables (`--brand-green`, etc.) used for active states.

---

## 3. Implementation Steps

### 3.1 Adding the Escalation Board Button
We will place the Escalation Board button after the Daily Task Board but before the Templates.

**File**: `src/verticals/ChargingHubs/HubSubSidebar.jsx`

1. Locate the `daily_hub_tasks` button block (around line 169).
2. Insert the new button component.

```javascript
/**
 * REVISION: 1.0
 * TARGET: src/verticals/ChargingHubs/HubSubSidebar.jsx
 * ACTION: Add Escalation Task Board navigation button.
 */

// Around line 179, after the Daily Task Board block:

{permissions?.canAccessEscalationTasks && (
  <div style={{ padding: '0 12px 12px 12px', marginBottom: '8px' }}>
    <button
      id="btn-escalation-board"
      className="halo-button"
      style={{ 
        width: '100%', 
        opacity: activeVertical === 'escalation_tasks' ? 1 : 0.7,
        border: activeVertical === 'escalation_tasks' ? '1px solid var(--brand-green)' : '1px solid var(--border-color)',
        fontWeight: activeVertical === 'escalation_tasks' ? 600 : 400
      }}
      onClick={() => setActiveVertical('escalation_tasks')}
    >
      Escalation Task Board
    </button>
  </div>
)}
```

### 3.2 Visual Polish & Alignment
Ensure the spacing matches the surrounding buttons. The current convention uses `padding: 0 12px 12px 12px` and `marginBottom: 8px`.

---

## 4. Defensive Coding Standards

> [!NOTE]
> **Visibility Guard**: Always use optional chaining (`permissions?.`) to prevent crashes if the permissions object is not yet loaded. If `canAccessEscalationTasks` is undefined, the button should simply not render.

- **Unique IDs**: Use `id="btn-escalation-board"` to facilitate automated testing.
- **Opacity Logic**: Use `1` for active and `0.7` for inactive to provide clear visual feedback without introducing complex CSS classes.
- **Interactive States**: The `halo-button` class handles hover effects, but we must ensure the `onClick` event is properly wired to the `setActiveVertical` state updater.

---

## 5. Verification Workflow

### 5.1 UI Verification (Visual)
1. Open the Charging Hubs vertical.
2. Confirm the new button is visible and correctly labeled.
3. Check that the active state (opacity and border) updates when clicked.

### 5.2 Responsive Verification (Mobile)
1. Toggle the browser to mobile view (e.g., iPhone 12/13).
2. Open the sidebar tray.
3. Ensure the button is easily tappable (minimum 44px height) and text does not wrap awkwardly.

---

## 6. Troubleshooting & Gotchas

| Issue | Potential Cause | Fix |
| :--- | :--- | :--- |
| **Button Missing** | `permissions.canAccessEscalationTasks` is false. | Check RBAC logic in Runbook 01. |
| **Button Not Highlighting** | `activeVertical` comparison mismatch. | Verify the string is exactly `'escalation_tasks'`. |
| **Layout Shift** | Padding or margin differs from other buttons. | Use the standard `0 12px 12px 12px` padding. |

---

## 7. Rollback Plan
1. Delete the Escalation Board button block in `src/verticals/ChargingHubs/HubSubSidebar.jsx`.
2. The UI will return to its previous state immediately.

---

## 8. Progress Tracking
- [ ] Step 3.1: Button component added.
- [ ] Step 3.2: Padding and styling aligned.
- [ ] Step 5: Visual and responsive verification complete.

**Next Runbook**: `05_BOARD_UI_AND_VERIFICATION.md`
