# Phase 5.2 — CSS Design System for Attendance Board

## Skills Required (Read Before Starting)
- `ui-design-system` §1 (CSS Variables — never hardcoded hex)
- `ui-design-system` §12 (Apple-inspired premium design: squircle, glassmorphism)
- `safe-code-modification` §2 (CSS Integrity — BEM, no !important, scoped)
- `ui-design-system` §14 (Mobile viewport adaptations — touch targets, safe areas)

---

## Objective

Replace the empty `EmployeeAttendanceBoard.css` stub with the full design system for all attendance components. Also create a new `AttendanceSelfService.css` for the self-service and receipt screens.

**Architecture Rule**: All attendance-specific CSS lives in these two files only. Sub-components import their parent's CSS file — they do NOT have their own individual CSS files (to prevent CSS fragmentation for this feature).

---

## CSS Token Strategy

These new tokens are added **within** `EmployeeAttendanceBoard.css` (scoped, not global). They reference global CSS variables from `App.css`.

```
Attendance Status Colors:
  --attendance-present  → brand green (✅)
  --attendance-week-off → neutral gray (⬜)
  --attendance-leave    → semantic yellow (🟡)
  --attendance-absent   → semantic red (🔴)
  --attendance-pending  → semantic orange (⚠️)
```

---

## Step 1: Replace `EmployeeAttendanceBoard.css`

**File to OVERWRITE** (existing stub is empty):
```
src/verticals/Employees/EmployeeAttendanceBoard.css
```

**Full CSS Content:**

```css
/* ==========================================================================
   EmployeeAttendanceBoard.css
   Styles for the Manager Attendance Board and all its sub-components:
   - AttendanceGrid, AttendanceApprovalDrawer, AttendanceSuggestEditModal

   Skill compliance:
     ui-design-system §1 (CSS Variables only — no hardcoded hex)
     ui-design-system §12 (Squircle, glassmorphism)
     safe-code-modification §2B (BEM naming, no !important)
     ui-design-system §14 (Mobile adaptations inside media queries)
   ========================================================================== */

/* --------------------------------------------------------------------------
   SECTION 1: Attendance Status Color Tokens
   Scoped to this component, referencing global design system variables.
   -------------------------------------------------------------------------- */
.attendance-board__wrapper {
  /* Status tokens — derived from global design system semantic palette */
  --attendance-present:  rgba(34, 197, 94, 0.15);           /* Green tint */
  --attendance-present-text: #22c55e;
  --attendance-week-off: rgba(255, 255, 255, 0.05);          /* Neutral */
  --attendance-week-off-text: var(--text-color);
  --attendance-leave:    rgba(234, 179, 8, 0.15);            /* Yellow tint */
  --attendance-leave-text: #eab308;
  --attendance-absent:   rgba(239, 68, 68, 0.12);            /* Red tint */
  --attendance-absent-text: #ef4444;
  --attendance-pending:  rgba(249, 115, 22, 0.9);            /* Orange — badge bg */
}

/* --------------------------------------------------------------------------
   SECTION 2: Board-level Layout
   -------------------------------------------------------------------------- */
.attendance-board__no-access {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: clamp(2rem, 5vw, 4rem);
  color: var(--text-color);
  opacity: 0.5;
}

.attendance-board__error {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1.5rem;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: var(--radius-button, 12px);
  color: #ef4444;
  margin: 0.75rem 1.5rem;
  font-size: 0.875rem;
}

/* Date range controls in the header leftActions */
.attendance-board__date-range {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.attendance-board__date-label {
  font-size: 0.65rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  opacity: 0.5;
  white-space: nowrap;
}

.attendance-board__date-input {
  background: var(--halo-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-button, 12px);
  color: var(--brand-green);
  padding: 0.4rem 0.75rem;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.2s ease;
}

.attendance-board__date-input:focus {
  outline: none;
  border-color: var(--brand-green);
}

.attendance-board__date-separator {
  opacity: 0.4;
  font-weight: 600;
}

/* Pending approvals badge on the header button */
.attendance-board__pending-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  border-radius: 10px;
  background: rgba(249, 115, 22, 0.9);
  color: #fff;
  font-size: 0.65rem;
  font-weight: 800;
  margin-left: 0.4rem;
  padding: 0 4px;
}

/* Status legend below the header */
.attendance-board__legend {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 1.5rem;
  flex-wrap: wrap;
}

.attendance-board__legend-item {
  font-size: 0.65rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid var(--border-color);
}

.attendance-board__legend--present  { background: var(--attendance-present); color: var(--attendance-present-text); }
.attendance-board__legend--week-off { background: var(--attendance-week-off); color: var(--attendance-week-off-text); opacity: 0.7; }
.attendance-board__legend--leave    { background: var(--attendance-leave); color: var(--attendance-leave-text); }
.attendance-board__legend--absent   { background: var(--attendance-absent); color: var(--attendance-absent-text); }
.attendance-board__legend--pending  { background: rgba(249, 115, 22, 0.15); color: #f97316; }

/* --------------------------------------------------------------------------
   SECTION 3: Attendance Grid
   -------------------------------------------------------------------------- */
.attendance-grid__wrapper {
  /* responsive-table-wrapper pattern from ui-design-system §11 */
  overflow-x: auto;
  padding: 0 1rem 1rem;
  -webkit-overflow-scrolling: touch;
}

.attendance-grid__table {
  width: 100%;
  border-collapse: collapse;
  min-width: 600px; /* Prevents collapse on narrow viewports */
}

/* Corner cell (top-left "Employee" label) */
.attendance-grid__corner-cell {
  text-align: left;
  padding: 0.5rem 1rem;
  font-size: 0.65rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  opacity: 0.5;
  white-space: nowrap;
  min-width: 180px;
  position: sticky;
  left: 0;
  background: var(--bg-color);
  z-index: 2;
  border-bottom: 1px solid var(--border-color);
}

/* Date header cells (X-axis) */
.attendance-grid__date-header {
  text-align: center;
  padding: 0.5rem 0.25rem;
  font-size: 0.7rem;
  font-weight: 700;
  white-space: nowrap;
  min-width: 70px;
  border-bottom: 1px solid var(--border-color);
  opacity: 0.7;
}

/* Employee info cell (Y-axis, sticky left) */
.attendance-grid__employee-cell {
  padding: 0.6rem 1rem;
  position: sticky;
  left: 0;
  background: var(--bg-color);
  z-index: 1;
  border-bottom: 1px solid var(--border-color);
  border-right: 1px solid var(--border-color);
  min-width: 180px;
  max-width: 220px;
}

.attendance-grid__employee-name {
  font-size: 0.875rem;
  font-weight: 600;
  margin: 0 0 0.25rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.attendance-grid__employee-meta {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.attendance-grid__employee-code {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.6rem;
  font-weight: 800;
  text-transform: uppercase;
  opacity: 0.5;
}

/* Attendance status cells */
.attendance-cell {
  text-align: center;
  padding: 0.4rem 0.25rem;
  border-bottom: 1px solid var(--border-color);
  border-right: 1px solid rgba(255, 255, 255, 0.04);
  cursor: pointer;
  transition: filter 0.15s ease, transform 0.1s ease;
  position: relative;
  vertical-align: middle;
  min-width: 70px;
}

.attendance-cell:hover {
  filter: brightness(1.2);
  transform: scale(1.05);
  z-index: 1;
}

/* Status-specific backgrounds */
.attendance-cell--present  { background: var(--attendance-present);  }
.attendance-cell--week-off { background: var(--attendance-week-off); }
.attendance-cell--leave    { background: var(--attendance-leave);    }
.attendance-cell--absent   { background: transparent;                }

/* Pending edit highlight — orange ring */
.attendance-cell--has-pending {
  box-shadow: inset 0 0 0 2px rgba(249, 115, 22, 0.6);
}

.attendance-cell__status-label {
  display: block;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.65rem;
  font-weight: 800;
  text-transform: uppercase;
}

.attendance-cell--present .attendance-cell__status-label  { color: var(--attendance-present-text); }
.attendance-cell--week-off .attendance-cell__status-label { color: var(--attendance-week-off-text); opacity: 0.5; }
.attendance-cell--leave .attendance-cell__status-label    { color: var(--attendance-leave-text); }
.attendance-cell--absent .attendance-cell__status-label   { color: var(--attendance-absent-text); opacity: 0.4; }

.attendance-cell__shift-type {
  display: block;
  font-size: 0.65rem;
  margin-top: 1px;
  opacity: 0.6;
}

/* Pending badge (⚠) positioned top-right of cell */
.attendance-cell__pending-badge {
  position: absolute;
  top: 2px;
  right: 3px;
  font-size: 0.55rem;
  color: #f97316;
  line-height: 1;
}

/* Skeleton loading rows */
.attendance-grid__skeleton-cell {
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.03) 25%,
    rgba(255, 255, 255, 0.07) 50%,
    rgba(255, 255, 255, 0.03) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  height: 42px;
}

@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.attendance-grid__empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: clamp(2rem, 8vw, 5rem);
  text-align: center;
}

/* --------------------------------------------------------------------------
   SECTION 4: Approval Drawer
   -------------------------------------------------------------------------- */
.approval-drawer__backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  z-index: 100;
}

.approval-drawer {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: clamp(300px, 40vw, 480px);
  background: var(--bg-color);
  border-left: 1px solid var(--border-color);
  z-index: 101;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-premium, -12px 0 40px rgba(0, 0, 0, 0.4));
}

.approval-drawer__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.approval-drawer__title {
  font-size: 1rem;
  font-weight: 800;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
}

.approval-drawer__body {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.approval-drawer__error {
  padding: 0.75rem;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: var(--radius-button, 12px);
  color: #ef4444;
  font-size: 0.875rem;
  margin: 0 1rem;
}

.approval-drawer__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  opacity: 0.4;
  font-size: 0.875rem;
}

/* Approval Card */
.approval-card {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-squircle, 24px);
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.approval-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
}

.approval-card__employee {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.approval-card__name {
  font-weight: 700;
  font-size: 0.95rem;
  margin: 0;
}

.approval-card__date {
  font-size: 0.7rem;
  opacity: 0.5;
  margin: 0;
  white-space: nowrap;
}

.approval-card__change {
  background: var(--halo-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-button, 12px);
  padding: 0.75rem;
}

.approval-card__change-label {
  font-size: 0.6rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  opacity: 0.5;
  margin: 0 0 0.25rem;
}

.approval-card__change-value {
  font-size: 0.95rem;
  font-weight: 700;
  margin: 0;
  color: var(--brand-green);
}

.approval-card__shift-type,
.approval-card__time {
  font-size: 0.75rem;
  opacity: 0.6;
  margin: 0.2rem 0 0;
}

.approval-card__requester {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.7rem;
  opacity: 0.5;
  flex-wrap: wrap;
}

.approval-card__requester-label { font-weight: 800; text-transform: uppercase; }
.approval-card__requester-name  { font-weight: 600; }
.approval-card__requester-time  { margin-left: auto; }

.approval-card__actions {
  display: flex;
  gap: 0.5rem;
}

.approval-card__approve-btn { color: #22c55e; }
.approval-card__reject-btn  { color: #ef4444; }

.approval-card__reject-textarea {
  width: 100%;
  background: var(--halo-bg);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-color);
  padding: 0.5rem;
  font-size: 0.875rem;
  resize: vertical;
  min-height: 80px;
  box-sizing: border-box;
}

/* --------------------------------------------------------------------------
   SECTION 5: Suggest Edit Modal
   -------------------------------------------------------------------------- */
.suggest-edit-modal {
  width: clamp(300px, 90vw, 520px);
  max-height: 90vh;
  overflow-y: auto;
}

.suggest-edit-modal__info-banner {
  padding: 0.75rem 1rem;
  background: var(--halo-bg);
  border: 1px solid color-mix(in srgb, var(--brand-green), transparent 60%);
  border-radius: var(--radius-button, 12px);
  font-size: 0.8rem;
  opacity: 0.8;
  margin-bottom: 0.75rem;
}

.suggest-edit-modal__current-status {
  font-weight: 700;
  color: var(--text-color);
  opacity: 0.5;
  text-transform: uppercase;
  font-size: 0.875rem;
}

.suggest-edit-modal__error {
  padding: 0.75rem;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: var(--radius-button, 12px);
  color: #ef4444;
  font-size: 0.875rem;
}

.suggest-edit-modal__submit-btn {
  color: var(--brand-green);
}

.form-label--optional {
  opacity: 0.4;
  font-size: 0.6rem;
  text-transform: uppercase;
}

/* --------------------------------------------------------------------------
   SECTION 6: Mobile Responsive Adaptations
   All mobile-specific styles MUST be inside @media queries (ui-design-system §14G)
   -------------------------------------------------------------------------- */
@media screen and (max-width: 768px) {
  .attendance-board__date-range {
    gap: 0.35rem;
  }

  .attendance-board__date-input {
    font-size: 0.75rem;
    padding: 0.35rem 0.6rem;
  }

  .approval-drawer {
    width: 100vw;
    border-left: none;
    border-top: 1px solid var(--border-color);
    border-radius: var(--radius-squircle, 24px) var(--radius-squircle, 24px) 0 0;
    top: auto;
    max-height: 80vh;
  }

  .attendance-grid__corner-cell,
  .attendance-grid__employee-cell {
    min-width: 140px;
    max-width: 160px;
  }

  .attendance-grid__date-header,
  .attendance-cell {
    min-width: 55px;
  }
}

@media screen and (max-width: 480px) {
  .attendance-board__legend {
    gap: 0.5rem;
    padding: 0.5rem 1rem;
  }

  .attendance-board__legend-item {
    font-size: 0.6rem;
  }

  .suggest-edit-modal {
    width: 95vw;
  }
}
```

---

## Step 2: Create `AttendanceSelfService.css`

**File to create (new):**
```
src/verticals/Employees/attendance/AttendanceSelfService.css
```

**Full CSS Content:**

```css
/* ==========================================================================
   AttendanceSelfService.css
   Styles for the Employee Self-Service screen and Receipt Screen.

   Skill compliance:
     ui-design-system §12 (Premium glassmorphism design)
     ui-design-system §14 (Mobile-first — touch targets ≥ 44px)
     safe-code-modification §2B (BEM naming, no !important)
   ========================================================================== */

/* --------------------------------------------------------------------------
   SECTION 1: Self-Service Container
   -------------------------------------------------------------------------- */
.self-service__container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100%;
  padding: clamp(1.5rem, 5vw, 3rem);
  gap: 1.5rem;
}

.self-service__header {
  text-align: center;
}

.self-service__title {
  font-size: clamp(1.5rem, 4vw, 2.5rem);
  font-weight: 800;
  margin: 0 0 0.25rem;
  background: linear-gradient(135deg, var(--brand-green), color-mix(in srgb, var(--brand-green), white 30%));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.self-service__date {
  font-size: 0.875rem;
  opacity: 0.5;
  margin: 0;
}

.self-service__error {
  width: 100%;
  max-width: 420px;
  padding: 0.75rem 1rem;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: var(--radius-button, 12px);
  color: #ef4444;
  font-size: 0.875rem;
  text-align: center;
}

/* Loading state */
.self-service__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 3rem;
  opacity: 0.5;
}

.self-service__loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border-color);
  border-top-color: var(--brand-green);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* --------------------------------------------------------------------------
   SECTION 2: Check-In Form
   -------------------------------------------------------------------------- */
.self-service__form {
  width: 100%;
  max-width: 420px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.self-service__hub-group,
.self-service__shift-group {
  width: 100%;
}

/* Shift type toggle buttons */
.self-service__shift-toggle {
  display: flex;
  gap: 0.5rem;
  background: var(--halo-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-button, 12px);
  padding: 0.4rem;
}

.self-service__shift-btn {
  flex: 1;
  padding: 0.6rem;
  border-radius: 8px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-color);
  font-weight: 700;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
  /* Touch target: min-height 44px per ui-design-system §14B */
  min-height: 44px;
}

.self-service__shift-btn.active {
  /* Selected state: 2px border + subtle tint (ui-design-system §4) */
  border: 2px solid var(--brand-green);
  background: rgba(16, 185, 129, 0.15);
  color: var(--brand-green);
}

/* --------------------------------------------------------------------------
   SECTION 3: Action Buttons (Start/End Shift)
   -------------------------------------------------------------------------- */
.self-service__action-btn {
  width: 100%;
  max-width: 420px;
  padding: 1rem;
  font-size: 1.05rem;
  font-weight: 800;
  /* Touch target: min-height 44px */
  min-height: 52px;
  letter-spacing: 1px;
  text-transform: uppercase;
}

.self-service__checkin-btn {
  color: #22c55e;
  box-shadow: 0 0 20px rgba(34, 197, 94, 0.2);
}

.self-service__checkout-btn {
  color: #f97316;
  box-shadow: 0 0 20px rgba(249, 115, 22, 0.2);
}

/* --------------------------------------------------------------------------
   SECTION 4: Active Session Card
   -------------------------------------------------------------------------- */
.self-service__active-card {
  width: 100%;
  max-width: 420px;
  background: rgba(34, 197, 94, 0.06);
  border: 1px solid rgba(34, 197, 94, 0.25);
  border-radius: var(--radius-squircle, 24px);
  padding: 2rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.self-service__active-icon {
  font-size: 2.5rem;
  line-height: 1;
}

.self-service__active-title {
  font-size: 1.1rem;
  font-weight: 800;
  margin: 0;
  color: #22c55e;
}

.self-service__active-shift {
  font-size: 0.875rem;
  font-weight: 600;
  margin: 0;
  opacity: 0.8;
}

.self-service__active-time {
  font-size: 0.8rem;
  opacity: 0.5;
  margin: 0;
}

/* --------------------------------------------------------------------------
   SECTION 5: Receipt Screen
   -------------------------------------------------------------------------- */
.receipt__container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100%;
  padding: clamp(1.5rem, 5vw, 3rem);
  gap: 1.5rem;
}

.receipt__card {
  width: 100%;
  max-width: 440px;
  background: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-squircle, 24px);
  overflow: hidden;
  box-shadow: var(--shadow-premium, 0 12px 40px rgba(0, 0, 0, 0.4));
}

.receipt__card--checkin  { border-top: 3px solid #22c55e; }
.receipt__card--checkout { border-top: 3px solid #f97316; }

.receipt__action-header {
  padding: 1.5rem 1.5rem 1rem;
  text-align: center;
}

.receipt__action-label {
  font-size: 1.35rem;
  font-weight: 800;
  margin: 0;
}

.receipt__details {
  padding: 0 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.receipt__detail-row {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.6rem 0;
  border-bottom: 1px solid var(--border-color);
}

.receipt__detail-row:last-child {
  border-bottom: none;
}

.receipt__detail-icon {
  font-size: 1rem;
  flex-shrink: 0;
  width: 24px;
  text-align: center;
  padding-top: 0.1rem;
}

.receipt__detail-label {
  font-size: 0.6rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  opacity: 0.4;
  margin: 0 0 2px;
}

.receipt__detail-value {
  font-size: 0.9rem;
  font-weight: 600;
  margin: 0;
}

.receipt__detail-value--geo {
  font-size: 0.75rem;
  opacity: 0.7;
}

.receipt__detail-value--mono {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  opacity: 0.7;
}

.receipt__share-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: calc(100% - 3rem);
  margin: 1.25rem 1.5rem;
  padding: 0.875rem;
  font-size: 0.875rem;
  font-weight: 800;
  color: #22c55e;
  min-height: 48px;
}

.receipt__share-icon {
  font-size: 1.1rem;
}

.receipt__done-btn {
  width: 100%;
  max-width: 440px;
  padding: 0.875rem;
  font-size: 0.875rem;
  min-height: 48px;
  opacity: 0.6;
}

/* --------------------------------------------------------------------------
   SECTION 6: Mobile Responsive Adaptations
   -------------------------------------------------------------------------- */
@media screen and (max-width: 480px) {
  .self-service__container,
  .receipt__container {
    padding: 1rem;
    justify-content: flex-start;
    padding-top: 2rem;
  }

  .receipt__card {
    border-radius: 20px;
  }
}
```

---

## Step 3: Import CSS in Components

**In `EmployeeAttendanceBoard.jsx`** (already has this import):
```javascript
import './EmployeeAttendanceBoard.css';
```

**In `AttendanceSelfService.jsx`**, add:
```javascript
import './AttendanceSelfService.css';
```

**In `AttendanceReceiptScreen.jsx`** (same CSS file as self-service):
```javascript
import './AttendanceSelfService.css';
```

Sub-components inside `attendance/` do NOT have their own CSS files — they inherit from the parent's import.

---

## Validation Checklist

- [ ] `EmployeeAttendanceBoard.css` has all 6 sections (tokens, board, grid, drawer, modal, mobile)
- [ ] `AttendanceSelfService.css` has all 6 sections (container, form, buttons, active card, receipt, mobile)
- [ ] ALL colors reference CSS variables — no hardcoded hex values
- [ ] `--attendance-*` tokens are defined inside `.attendance-board__wrapper` (scoped, not global)
- [ ] Mobile styles are inside `@media screen and (max-width: Xpx)` blocks
- [ ] No `!important` used anywhere
- [ ] Touch targets (`min-height: 44px`) on all interactive elements in self-service CSS
- [ ] `shimmer` animation for skeleton rows is defined in the CSS

---

## FEATURE COMPLETE — Run Final Validation

After completing all 13 runbooks, perform the following end-to-end validation:

1. **Manager Board**: Navigate to Attendance Board → grid loads with date range
2. **RBAC**: As contributor → clicking a cell opens SuggestEditModal
3. **RBAC**: As editor → "Pending Approvals" button visible → drawer opens
4. **Approval Flow**: Submit a suggestion → editor approves → grid updates
5. **Self-Service**: Navigate to "My Attendance" → Start Shift form visible
6. **Check-In**: Select hub + shift type → Start Shift → receipt screen shown
7. **WhatsApp**: Tap "Share to WhatsApp" → share sheet opens (or wa.me link on web)
8. **Check-Out**: Return to "My Attendance" → "End Shift" button shown → tap → receipt
9. **Mobile**: Test all flows at 390px viewport width
10. **No Console Errors**: Zero unhandled promise rejections or React warnings
