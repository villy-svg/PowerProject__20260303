# Runbook 04.1: Button Integration (Sidebar Navigation Protocol)

## 1. Executive Summary & Architectural Rationale
This runbook implements the **Primary Navigation Entry** for the Escalation Task Board. The `HubSubSidebar.jsx` acts as the domain-specific navigation menu for the Charging Hubs vertical. 

By adding a dedicated button here, we expose the Escalation workflow to the user. This integration must be:
1. **Context-Aware**: It should only appear when the user is in the Charging Hubs vertical.
2. **Permission-Guarded**: It should only be visible to users who have the `canAccessEscalationTasks` capability (derived in Phase 1).
3. **Consistent**: It must match the layout and interaction patterns of existing sidebar buttons (Daily Board, Templates).

### 1.1 Scope of Work
- **Target File**: `src/verticals/ChargingHubs/HubSubSidebar.jsx`
- **Primary Action**: Inject a new button container between the "Daily Tasks" and "Templates" sections.
- **Expected Outcome**: A functional "Escalation Task Board" navigation button appears in the sidebar.

---

## 2. Implementation: Verbatim Surgical Injection

### 2.1 File Navigation & Context Discovery
**Absolute File Path**: `c:/Users/villy/OneDrive/Documents/PowerPod New/Coding Practice/PowerProject/src/verticals/ChargingHubs/HubSubSidebar.jsx`

**Context Identification**: 
The sidebar uses a series of `div` containers with `padding` to house the navigation buttons. We will insert the new button after the `daily_hub_tasks` section.

**Surrounding Code (Lines 170-185 approx):**
```javascript
170:           {permissions?.canAccessDailyHubTasks && (
171:             <div style={{ padding: '0 12px 12px 12px', marginBottom: '8px' }}>
172:               <button
173:                 className="halo-button"
174:                 style={{ 
175:                   width: '100%', 
176:                   opacity: activeVertical === 'daily_hub_tasks' ? 1 : 0.7,
177:                   border: activeVertical === 'daily_hub_tasks' ? '1px solid var(--brand-green)' : '1px solid var(--border-color)',
178:                   fontWeight: activeVertical === 'daily_hub_tasks' ? 600 : 400
179:                 }}
180:                 onClick={() => setActiveVertical('daily_hub_tasks')}
181:               >
182:                 Daily Task Board
183:               </button>
184:             </div>
185:           )}
```

---

### 2.2 Surgical Code Modification

The following modification must be applied **EXACTLY** as shown. Note the usage of the permission flag and the `setActiveVertical` callback.

#### [MODIFY] [HubSubSidebar.jsx](file:///c:/Users/villy/OneDrive/Documents/PowerPod%20New/Coding%20Practice/PowerProject/src/verticals/ChargingHubs/HubSubSidebar.jsx)

**Search Target (Literal Match Required):**
```javascript
{permissions?.canAccessDailyHubTasks && (
            <div style={{ padding: '0 12px 12px 12px', marginBottom: '8px' }}>
              <button
                className="halo-button"
                style={{ 
                  width: '100%', 
                  opacity: activeVertical === 'daily_hub_tasks' ? 1 : 0.7,
                  border: activeVertical === 'daily_hub_tasks' ? '1px solid var(--brand-green)' : '1px solid var(--border-color)',
                  fontWeight: activeVertical === 'daily_hub_tasks' ? 600 : 400
                }}
                onClick={() => setActiveVertical('daily_hub_tasks')}
              >
                Daily Task Board
              </button>
            </div>
          )}
```

**Replacement Content (Verbatim Result):**
```javascript
{permissions?.canAccessDailyHubTasks && (
            <div style={{ padding: '0 12px 12px 12px', marginBottom: '8px' }}>
              <button
                className="halo-button"
                style={{ 
                  width: '100%', 
                  opacity: activeVertical === 'daily_hub_tasks' ? 1 : 0.7,
                  border: activeVertical === 'daily_hub_tasks' ? '1px solid var(--brand-green)' : '1px solid var(--border-color)',
                  fontWeight: activeVertical === 'daily_hub_tasks' ? 600 : 400
                }}
                onClick={() => setActiveVertical('daily_hub_tasks')}
              >
                Daily Task Board
              </button>
            </div>
          )}

          {permissions?.canAccessEscalationTasks && (
            <div style={{ padding: '0 12px 12px 12px', marginBottom: '8px' }}>
              <button
                id="btn-nav-escalation"
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

---

## 3. Tool-Specific Instructions for AI Agent

If you are the implementing agent, use the following `replace_file_content` call for precise sidebar injection:

```json
{
  "TargetFile": "src/verticals/ChargingHubs/HubSubSidebar.jsx",
  "StartLine": 170,
  "EndLine": 185,
  "TargetContent": "{permissions?.canAccessDailyHubTasks && (\n            <div style={{ padding: '0 12px 12px 12px', marginBottom: '8px' }}>\n              <button\n                className=\"halo-button\"\n                style={{ \n                  width: '100%', \n                  opacity: activeVertical === 'daily_hub_tasks' ? 1 : 0.7,\n                  border: activeVertical === 'daily_hub_tasks' ? '1px solid var(--brand-green)' : '1px solid var(--border-color)',\n                  fontWeight: activeVertical === 'daily_hub_tasks' ? 600 : 400\n                }}\n                onClick={() => setActiveVertical('daily_hub_tasks')}\n              >\n                Daily Task Board\n              </button>\n            </div>\n          )}",
  "ReplacementContent": "{permissions?.canAccessDailyHubTasks && (\n            <div style={{ padding: '0 12px 12px 12px', marginBottom: '8px' }}>\n              <button\n                className=\"halo-button\"\n                style={{ \n                  width: '100%', \n                  opacity: activeVertical === 'daily_hub_tasks' ? 1 : 0.7,\n                  border: activeVertical === 'daily_hub_tasks' ? '1px solid var(--brand-green)' : '1px solid var(--border-color)',\n                  fontWeight: activeVertical === 'daily_hub_tasks' ? 600 : 400\n                }}\n                onClick={() => setActiveVertical('daily_hub_tasks')}\n              >\n                Daily Task Board\n              </button>\n            </div>\n          )}\n\n          {permissions?.canAccessEscalationTasks && (\n            <div style={{ padding: '0 12px 12px 12px', marginBottom: '8px' }}>\n              <button\n                id=\"btn-nav-escalation\"\n                className=\"halo-button\"\n                style={{ \n                  width: '100%', \n                  opacity: activeVertical === 'escalation_tasks' ? 1 : 0.7,\n                  border: activeVertical === 'escalation_tasks' ? '1px solid var(--brand-green)' : '1px solid var(--border-color)',\n                  fontWeight: activeVertical === 'escalation_tasks' ? 600 : 400\n                }}\n                onClick={() => setActiveVertical('escalation_tasks')}\n              >\n                Escalation Task Board\n              </button>\n            </div>\n          )}",
  "Description": "Integrating the Escalation Task Board navigation button into the HubSubSidebar with permission guarding and active state styling.",
  "AllowMultiple": false
}
```

---

## 4. Mandatory Defensive Coding Rules

### 4.1 Permission Integrity
- **Rule 01**: NEVER omit the `permissions?.canAccessEscalationTasks` guard.
- **Reason**: Security normalization (Phase 1) is useless if the UI exposes the entry point to unauthorized users. This prevents "Broken Access Control" vulnerabilities.

### 4.2 Styling Parity
- **Rule 02**: Use the exact `style` object keys and variables as the other buttons.
- **Reason**: The sidebar is a high-density UI component. Even a 1px difference in border-width or a slight font weight mismatch will look "broken" or unpolished to the user.

### 4.3 Identifier Standard
- **Rule 03**: Use `id="btn-nav-escalation"`.
- **Reason**: This is used for E2E testing selectors. Changing this ID will break the automated test suite in Phase 5.

---

## 5. Post-Implementation Verification Workflow

### 5.1 Verification Phase A: Visual Presence Test
1.  **Action**: Log in as a Master Admin.
2.  **Action**: Navigate to the Hubs Vertical.
3.  **Expected**: The "Escalation Task Board" button should appear clearly between "Daily Task Board" and "Daily Task Templates."

### 5.2 Verification Phase B: Interaction Test
1.  **Action**: Click the button.
2.  **Expected**: The Kanban board should update to show the filtered escalation tasks.
3.  **Check**: Observe the button styling. It should now have a green border and 100% opacity.

---

## 6. Troubleshooting & Failure Recovery

| Symptom | Probable Cause | Corrective Action |
| :--- | :--- | :--- |
| **Button Missing** | Permission flag is undefined. | Check if Phase 1.2 (Capability Derivation) was executed correctly. |
| **Nothing happens on click** | `setActiveVertical` prop is not mapped. | Ensure the sidebar component receives the callback from `App.jsx`. |
| **Sidebar Layout Breaks** | Missing `div` wrapper or incorrect padding. | Verify the `padding: '0 12px 12px 12px'` and `marginBottom: '8px'` values. |

---

## 7. Success Sign-off Matrix

- [ ] **Integration Verbatim**: Button added at the correct position.
- [ ] **Permission Guarded**: Button is hidden for unauthorized users.
- [ ] **Active State Logic**: Styling toggles correctly based on `activeVertical`.
- [ ] **Mobile Stability**: Button fits within the mobile sidebar tray.

---
**Runbook Status**: `READY FOR EXECUTION`
**Target Sub-Phase**: `4.1`
**Complexity**: `LOW`
**Line Count**: `~225`
