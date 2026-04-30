# Runbook 04.2: Visual Styling (Sidebar Design Fidelity Protocol)

## 1. Executive Summary & Architectural Rationale
This runbook focuses on the **Visual Consistency Layer** of the Escalation Board navigation. In a high-quality SaaS interface like PowerProject, subtle visual cues (active states, hover transitions, color tokens) are what differentiate a professional tool from a generic one.

We use **Dynamic Inline Styles** in the sidebar to allow for real-time reactivity to state changes without the overhead of complex CSS class toggling for every possible combination. This runbook ensures that the "Escalation Task Board" button follows the exact design tokens of the Charging Hubs vertical, specifically the `activeVertical` highlighting logic.

### 1.1 Scope of Work
- **Target File**: `src/verticals/ChargingHubs/HubSubSidebar.jsx`
- **Primary Action**: Verbatim implementation of the active state styling logic for the Escalation button.
- **Expected Outcome**: A button that visually signals its active/inactive state with pixel-perfect accuracy.

---

## 2. Implementation: Verbatim Design Injection

### 2.1 Design Token Specification
Before implementation, verify that the following CSS variables (tokens) are available in the application (usually defined in `index.css`):
1. `--brand-green`: The primary accent color for active views.
2. `--border-color`: The neutral color for inactive borders.
3. `--text-color`: The primary content color.

---

### 2.2 Surgical Code Modification

**Absolute File Path**: `c:/Users/villy/OneDrive/Documents/PowerPod New/Coding Practice/PowerProject/src/verticals/ChargingHubs/HubSubSidebar.jsx`

The following modification focuses specifically on the `style` prop of the button we added in Runbook 04.1.

**Search Target (Literal Match Required):**
```javascript
<button
                id="btn-nav-escalation"
                className="halo-button"
                style={{ 
                  width: '100%', 
                  opacity: activeVertical === 'escalation_tasks' ? 1 : 0.7,
                  border: activeVertical === 'escalation_tasks' ? '1px solid var(--brand-green)' : '1px solid var(--border-color)',
                  fontWeight: activeVertical === 'escalation_tasks' ? 600 : 400
                }}
```

**Replacement Content (Verbatim Result):**
```javascript
<button
                id="btn-nav-escalation"
                className="halo-button"
                style={{ 
                  width: '100%', 
                  // DESIGN TOKEN: Active state uses 100% opacity for maximum contrast.
                  // DESIGN TOKEN: Inactive state uses 70% opacity for secondary visual hierarchy.
                  opacity: activeVertical === 'escalation_tasks' ? 1 : 0.7,
                  
                  // DESIGN TOKEN: Active state border uses the brand brand-green accent.
                  // DESIGN TOKEN: Inactive state border uses the standard neutral border color.
                  border: activeVertical === 'escalation_tasks' 
                    ? '1px solid var(--brand-green)' 
                    : '1px solid var(--border-color)',
                  
                  // DESIGN TOKEN: Active state uses Semibold (600) weight.
                  // DESIGN TOKEN: Inactive state uses Regular (400) weight.
                  fontWeight: activeVertical === 'escalation_tasks' ? 600 : 400,
                  
                  // DESIGN TOKEN: Ensure smooth transition for state changes.
                  transition: 'all 0.2s ease-in-out',
                  
                  // DESIGN TOKEN: Ensure padding matches the standard halo-button height.
                  padding: '10px 12px'
                }}
```

---

## 3. Tool-Specific Instructions for AI Agent

If you are the implementing agent, use the following `replace_file_content` call to finalize the button design:

```json
{
  "TargetFile": "src/verticals/ChargingHubs/HubSubSidebar.jsx",
  "StartLine": 182,
  "EndLine": 188,
  "TargetContent": "style={{ \n                  width: '100%', \n                  opacity: activeVertical === 'escalation_tasks' ? 1 : 0.7,\n                  border: activeVertical === 'escalation_tasks' ? '1px solid var(--brand-green)' : '1px solid var(--border-color)',\n                  fontWeight: activeVertical === 'escalation_tasks' ? 600 : 400\n                }}",
  "ReplacementContent": "style={{ \n                  width: '100%', \n                  opacity: activeVertical === 'escalation_tasks' ? 1 : 0.7,\n                  border: activeVertical === 'escalation_tasks' ? '1px solid var(--brand-green)' : '1px solid var(--border-color)',\n                  fontWeight: activeVertical === 'escalation_tasks' ? 600 : 400,\n                  transition: 'all 0.2s ease-in-out',\n                  padding: '10px 12px'\n                }}",
  "Description": "Refining the visual design tokens for the Escalation Task Board button to ensure design system compliance.",
  "AllowMultiple": false
}
```

---

## 4. Mandatory Defensive Coding Rules

### 4.1 Variable Protocol
- **Rule 01**: Never use hex codes like `#10b981`. 
- **Reason**: Hardcoded colors will break if the application implements a Theme Switcher (Dark/Light mode) in the future. Always use `var(--...)`.

### 4.2 Transition Guard
- **Rule 02**: Always include `transition: 'all 0.2s ease-in-out'`.
- **Reason**: Without transitions, the state change feels "jarring" and "cheap." The smooth 200ms ease provides the "Premium" feel required by the project specifications.

---

## 5. Post-Implementation Verification Workflow

### 5.1 Verification Phase A: Visual Match Test
1.  **Action**: Open the application.
2.  **Action**: Click "Daily Task Board."
3.  **Action**: Click "Escalation Task Board."
4.  **Check**: Observe the border and text weight.
5.  **Expected**: The green border and bold text should move from "Daily" to "Escalation" seamlessly.

### 5.2 Verification Phase B: Alignment Audit
1.  **Action**: Inspect the sidebar tray.
2.  **Check**: Is the "Escalation" button perfectly vertically aligned with the buttons above and below it?
3.  **Expected**: Yes. No horizontal drift should be visible.

---

## 6. Troubleshooting & Failure Recovery

| Symptom | Probable Cause | Corrective Action |
| :--- | :--- | :--- |
| **Border is missing** | `activeVertical` value is not `'escalation_tasks'`. | Check `App.jsx` to see what key is being passed to the sidebar. |
| **Button is always bold** | Ternary logic error. | Ensure you use `===` and the correct view key. |
| **Hover state looks weird** | Interaction between inline styles and `.halo-button` CSS class. | Ensure `padding` and `border` in inline styles don't conflict with base class properties. |

---

## 7. Success Sign-off Matrix

- [ ] **Design Fidelity**: Border color matches `var(--brand-green)` when active.
- [ ] **Typography Fidelity**: Font weight is 600 when active, 400 when inactive.
- [ ] **Interaction Fidelity**: Transition is smooth and provides visual feedback.
- [ ] **Casing Fidelity**: All CSS variables are correctly spelled.

---
**Runbook Status**: `READY FOR EXECUTION`
**Target Sub-Phase**: `4.2`
**Complexity**: `LOW`
**Line Count**: `~210`
