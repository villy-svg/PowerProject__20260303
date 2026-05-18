# RB2-07: Smoke Test & Verification Protocol

## Objective
Comprehensive verification that the Phase 2 shell architecture works correctly
across all viewports, all verticals, all management pages, and all interaction patterns.
This runbook produces NO code changes — it is testing only.

---

## Pre-Flight

```powershell
cd "c:\Users\villy\OneDrive\Documents\PowerPod New\Coding Practice\PowerProject"

# 1. Confirm all 6 prior commits exist
git log --oneline -6
# Expected:
# RB2-06: CSS architecture split...
# RB2-05: AppShell switchover...
# RB2-04: Workspace shell integration...
# RB2-03: Navigation shells...
# RB2-02: Header shells...
# RB2-01: Shell infrastructure...

# 2. Build passes
npm run build

# 3. Start dev server
npm run dev
```

---

## Test Matrix

### 1. Desktop Tests (> 768px viewport)

| # | Test | Steps | Expected | Pass? |
|---|---|---|---|---|
| D1 | Shell selection | Open DevTools → check `data-shell` attribute | `data-shell="desktop"` | ☐ |
| D2 | Sidebar inline | Load app at 1280px | Sidebar is inline flex panel, no overlay | ☐ |
| D3 | Sidebar toggle | Click logo button | Sidebar collapses (width → 0), content expands | ☐ |
| D4 | No backdrop | Open sidebar | No dark overlay behind sidebar | ☐ |
| D5 | No BottomNav | Check DOM | BottomNav component not in DOM | ☐ |
| D6 | No mobile tray | Check DOM | `.mobile-action-tray` has `display: none` | ☐ |
| D7 | Header visible | Navigate to any vertical | Title, description, actions row all visible | ☐ |
| D8 | Header menu | Click MENU button | Expanded row appears inline (not overlay) | ☐ |
| D9 | No blur | Open sub-sidebar or menu | Content area NOT blurred | ☐ |
| D10 | Impersonation | (Master admin) Use impersonation dropdown | Dropdown works, user switches | ☐ |
| D11 | UserProfile | Click profile icon | Config navigation works | ☐ |

### 2. Mobile Tests (≤ 768px viewport)

| # | Test | Steps | Expected | Pass? |
|---|---|---|---|---|
| M1 | Shell selection | Open DevTools → check `data-shell` | `data-shell="mobile"` | ☐ |
| M2 | Sidebar drawer | Click menu/logo | Sidebar slides in from left with backdrop | ☐ |
| M3 | Backdrop dismiss | Tap backdrop | Sidebar closes | ☐ |
| M4 | BottomNav visible | Load dashboard | BottomNav appears at bottom | ☐ |
| M5 | BottomNav hidden | Enter a vertical | BottomNav hidden (unless overlay triggered) | ☐ |
| M6 | Mobile tray | Enter a vertical | Mobile action tray appears at bottom | ☐ |
| M7 | Scroll hide | Scroll down in task board | Header and tray hide | ☐ |
| M8 | Scroll show | Scroll back up | Header and tray reappear | ☐ |
| M9 | Header compact | Enter a vertical | Title is compact (1.25rem, centered) | ☐ |
| M10 | Description hidden | Check header | Description text is NOT visible on mobile | ☐ |
| M11 | Menu overlay | Tap menu in tray | Full-screen menu slides down from top | ☐ |
| M12 | Body scroll lock | Open menu | Background content cannot scroll | ☐ |
| M13 | Sub-sidebar | Tap sidebar button in tray | Sub-sidebar slides in with backdrop | ☐ |
| M14 | Add button | Tap + button in tray | Task modal opens | ☐ |
| M15 | Blur effect | Open sub-sidebar | Content area blurs behind sidebar | ☐ |
| M16 | Logo hidden | Enter a vertical | Logo button hidden | ☐ |
| M17 | Brand hidden | Enter a vertical | "PowerProject" title hidden | ☐ |

### 3. Vertical-Specific Tests

| # | Vertical | Desktop | Mobile | Pass? |
|---|---|---|---|---|
| V1 | Dashboard | ExecutiveSummary renders | Same content, mobile layout | ☐ |
| V2 | Hub Tasks | Task board with HubSubSidebar | Same, sidebar as drawer | ☐ |
| V3 | Daily Tasks | Task board with daily filter | Same | ☐ |
| V4 | Employee Tasks | Task board with EmployeeSubSidebar | Same | ☐ |
| V5 | Client Tasks | Task board with ClientSubSidebar | Same | ☐ |
| V6 | Hub Management | Full table view | Same content | ☐ |
| V7 | Department Mgmt | Full table view | Same content | ☐ |
| V8 | Client Category | Full table view | Same content | ☐ |
| V9 | Configuration | Config panel | Same content | ☐ |
| V10 | User Management | Admin table | Same content | ☐ |

### 4. Resize Tests (Breakpoint Transitions)

| # | Test | Steps | Expected | Pass? |
|---|---|---|---|---|
| R1 | Desktop → Mobile | Resize from 1280px to 375px | Shell switches from desktop to mobile | ☐ |
| R2 | Mobile → Desktop | Resize from 375px to 1280px | Shell switches from mobile to desktop | ☐ |
| R3 | Tablet boundary | Resize to exactly 768px | Mobile shell active | ☐ |
| R4 | Just above tablet | Resize to 769px | Desktop shell active | ☐ |
| R5 | Small laptop | Resize to 1024px | Desktop shell, compact sidebar | ☐ |
| R6 | No flash | Resize rapidly | No visible layout flash or jitter | ☐ |

### 5. RBAC Tests

| # | Test | Steps | Expected | Pass? |
|---|---|---|---|---|
| A1 | Non-admin vertical block | Login as non-admin, try admin view | Redirected to null (dashboard) | ☐ |
| A2 | Configuration guard | Non-config user clicks Configuration | Access denied or redirect | ☐ |
| A3 | Vertical assignment | User without hub access | Cannot see Hub vertical | ☐ |
| A4 | Global scope | Master admin | Can see all verticals | ☐ |

### 6. Task CRUD Tests

| # | Test | Steps | Expected | Pass? |
|---|---|---|---|---|
| T1 | Add task (desktop) | Click + Add Task in header | Modal opens, task saves | ☐ |
| T2 | Add task (mobile) | Tap + in tray | Modal opens, task saves | ☐ |
| T3 | Edit task | Click task card | Edit modal opens, changes save | ☐ |
| T4 | Delete task | Delete from edit modal | Task removed from board | ☐ |
| T5 | Stage change | Drag (kanban) or dropdown (list) | Stage updates optimistically | ☐ |
| T6 | Filters | Use sub-sidebar filters | Tasks filter correctly | ☐ |
| T7 | View modes | Switch kanban/list/tree | All three views work | ☐ |
| T8 | CSV import | Import tasks via CSV | Tasks appear on board | ☐ |
| T9 | Bulk actions | Select multiple → bulk action | Actions apply to all selected | ☐ |

---

## Performance Checks

```powershell
# 1. Lighthouse audit at 1280px
# Target: Performance > 85, no layout shift warnings

# 2. Lighthouse audit at 375px
# Target: Performance > 80, touch targets ≥ 44px

# 3. Check for duplicate event listeners
# DevTools → Performance → Record → Check for excessive resize handlers
# Expected: Only ONE resize listener from useIsMobile
```

---

## Build Verification

```powershell
# 1. Production build
npm run build

# 2. Check bundle size
# The shell system should add minimal overhead (< 5KB gzipped)

# 3. Verify no console errors
npm run dev
# Check browser console — should be clean (no warnings about missing props, etc.)
```

---

## Regression Catalog

If any test fails, document it here:

| Test ID | Failure Description | Root Cause | Fix Applied |
|---|---|---|---|
| | | | |

---

## Final Git Tag

If ALL tests pass:

```powershell
git tag -a "phase2-complete" -m "Phase 2: Adaptive Shell Architecture — all smoke tests pass"
git push origin --tags
```

---

## Phase 3 Readiness Checklist

Before declaring Phase 2 complete, verify these Phase 3 prerequisites are met:

- [ ] `useLayoutShell` returns `isManagementView` correctly for all management pages
- [ ] `LayoutShell` has the `managementShell` prop slot (unused but present)
- [ ] `WorkspaceFilterContext` is created and ready for Phase 3 integration
- [ ] `ContentRouter` cleanly separates management views from task board views
- [ ] CSS is organized into shell-scoped files (easy to add DesktopManagementShell.css)
- [ ] Shell barrel export includes all components
- [ ] No management-specific styles leak into shell CSS (management styles stay in their vertical folders)
