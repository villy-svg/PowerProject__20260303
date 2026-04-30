# Runbook 04.3: Interaction Testing (Mobile & Responsive UX Audit)

## 1. Executive Summary & Architectural Rationale
This runbook implements the **User Interaction (UX) Audit** for the Escalation Task Board navigation. In a hybrid application like PowerProject, which runs on both high-resolution desktops and compact mobile devices, the "Tappability" and "Visibility" of navigation elements are critical.

The `HubSubSidebar.jsx` component is highly dynamic:
- **On Desktop**: It is a persistent side panel.
- **On Mobile**: It is a sliding tray or a full-screen overlay.

This runbook ensures that the newly integrated Escalation button works flawlessly across both contexts. We must verify that:
1. The button remains within the scrollable viewport on small screens.
2. The hit target is large enough for finger taps on mobile devices.
3. The "Active State" visual cues are clear even on low-contrast mobile screens.

### 1.1 Scope of Work
- **Target Context**: Browser Device Emulator (Mobile Mode).
- **Primary Action**: Multi-resolution audit of the Escalation Board navigation button.
- **Expected Outcome**: Absolute confirmation of a responsive, bug-free navigation experience.

---

## 2. Implementation: Verbatim UX Verification Workflow

### 2.1 Verification Phase A: Desktop Viewport Integrity
1.  **Action**: Open the application on a standard desktop resolution (e.g., 1920x1080).
2.  **Action**: Open the Hubs Vertical.
3.  **Check**: Observe the sidebar.
4.  **Requirement**: The "Escalation Task Board" button must be perfectly aligned with the "Daily Task Board" button. No horizontal "wobble" should be visible when switching between them.

---

### 2.2 Verification Phase B: Mobile Viewport Integrity (Surgical Detail)

1.  **Action**: Open **Chrome DevTools** (F12) -> Click the **Toggle Device Toolbar** icon.
2.  **Action**: Set the device preset to **iPhone 12 Pro** (390x844).
3.  **Action**: Open the Sidebar Tray.
4.  **Verification Step B.1 (Clarity)**: 
    - [ ] Is the text "Escalation Task Board" clearly legible?
    - [ ] Does it wrap to two lines? (Wrapping is acceptable if it maintains vertical spacing).
5.  **Verification Step B.2 (Tappability)**: 
    - [ ] Tap the button with the "touch" cursor (the gray circle).
    - [ ] Confirm the board content updates.
    - [ ] Confirm the tray **closes automatically** (this is the expected behavior for mobile navigation).
6.  **Verification Step B.3 (Compact Test)**:
    - [ ] Switch the device to **iPhone SE** (375x667).
    - [ ] Verify that the 4th button (Escalations) doesn't push the 5th button (Templates) off-screen if the tray height is limited.

---

## 3. Mandatory Defensive Interaction Rules

### 3.1 Hit Target Standard
- **Rule 01**: The button container MUST maintain at least 44px of vertical height (including margins).
- **Reason**: Apple's Human Interface Guidelines and Google's Material Design both specify a minimum tap target of 44x44px for reliable interaction.

### 3.2 Label Preservation
- **Rule 02**: Never shorten the label to "Escalations" for mobile.
- **Reason**: We must maintain "Label Parity" between Desktop and Mobile. A user switching devices should see the exact same terminology to avoid cognitive load.

---

## 4. Troubleshooting & Failure Recovery Matrix

| Symptom | Probable Cause | Corrective Action |
| :--- | :--- | :--- |
| **Tray stays open on Mobile** | The sidebar's `onClick` wrapper is missing the `onItemClick` callback. | Check if the button needs to call an additional `onClose` prop. |
| **Button overflows the tray** | The tray container has a fixed height instead of `max-height`. | Update the tray CSS in `App.css` or the sidebar component. |
| **Active state invisible on Mobile** | Low contrast ratio between `--brand-green` and mobile screen brightness. | Ensure the active state also increases `fontWeight` to 600. |

---

## 5. Tool-Specific Instructions for AI Agent

If you are the implementing agent, you MUST run this **Mobile Event Audit** in the console during testing:

```javascript
// Run this to verify the event flow
const btn = document.getElementById('btn-nav-escalation');
if (btn) {
  btn.addEventListener('click', () => console.log('✅ Interaction Detected: Escalation Board Navigation triggered.'));
  console.log('--- Interaction Audit Ready ---');
} else {
  console.error('❌ Interaction Audit Failed: Button with ID "btn-nav-escalation" not found.');
}
```

---

## 6. Performance & Regression Check

### 6.1 Scroll Performance
- [ ] While the mobile tray is open, scroll the sidebar up and down.
- [ ] Confirm there is no "jank" or lag during the scroll.

### 6.2 Regression Check
- [ ] Verify that clicking "Daily Task Board" still works flawlessly on mobile.

---

## 7. Success Sign-off Matrix

- [ ] **Desktop Integrity**: Alignment and active states are 100% verified.
- [ ] **Mobile Integrity**: Tappability and hit targets meet the 44px standard.
- [ ] **State Integrity**: Mobile tray behavior (Auto-close) is confirmed.
- [ ] **Design Parity**: Labels and styles match across all viewport sizes.

---
**Runbook Status**: `READY FOR EXECUTION`
**Target Sub-Phase**: `4.3`
**Complexity**: `MEDIUM` (Cross-Device Audit)
**Line Count**: `~215`
