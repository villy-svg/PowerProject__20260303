---
name: Shell Architecture System
description: Core rules for the Adaptive Shell Architecture (Phase 2+). Defines the DesktopLayout/MobileLayout shell pattern, LayoutShell orchestration, ContentRouter separation, and the principle of shared data + swapped shells. Must be read before touching any shell, layout, or chrome code.
---

# Shell Architecture System

## 1. The Core Principle

**Shared data + service modules → swapped shells.**

We never duplicate task logic, CRUD operations, filter state, or service layer code. We only duplicate the **frame** (chrome) around the content. The same `TaskController`, `VerticalWorkspace`, `ExecutiveSummary`, and management pages are rendered inside both Desktop and Mobile shells.

## 2. Architecture Overview

```
main.jsx
  └── AuthProvider
       └── App
            ├── AppNavigationProvider
            │    └── TaskBoardProvider
            │         └── LayoutShell (orchestrator)
            │              ├── [Desktop] → DesktopLayout
            │              │    ├── Sidebar (inline panel)
            │              │    ├── DesktopHeader (inline row)
            │              │    └── ContentRouter → <page content>
            │              │
            │              └── [Mobile] → MobileLayout
            │                   ├── MobileHeader (sticky + tray)
            │                   ├── ContentRouter → <page content>
            │                   └── BottomNav (fixed bottom)
```

## 3. Component Responsibilities

| Component | Responsibility | What it does NOT do |
|---|---|---|
| `LayoutShell` | Reads `useLayoutShell()`, picks Desktop or Mobile shell | Never renders content directly |
| `DesktopLayout` | Renders sidebar (inline), header bar, impersonation UI | No overlays, no blur, no tray |
| `MobileLayout` | Renders sidebar (drawer), header (sticky), tray, BottomNav | No inline sidebar, no impersonation |
| `ContentRouter` | Renders the correct page based on `activeVertical` | No chrome rendering at all |
| `DesktopHeader` | Inline menu, view toggles, action buttons | No sticky, no scroll-aware hide |
| `MobileHeader` | Sticky scroll-aware header, mobile action tray | No inline menu row |
| `useLayoutShell` | Central layout decision (shell type, view classification) | No state management |
| `useHeaderState` | Shared header state (menu open, tray visibility) | No viewport detection |

## 4. File Locations

```
src/app/shells/
  ├── LayoutShell.jsx          # Orchestrator
  ├── DesktopLayout.jsx        # Desktop shell
  ├── DesktopLayout.css        # Desktop-only styles
  ├── MobileLayout.jsx         # Mobile shell
  ├── MobileLayout.css         # Mobile-only styles
  ├── DesktopHeader.jsx        # Desktop header
  ├── MobileHeader.jsx         # Mobile header
  ├── DesktopSidebar.jsx       # Desktop sidebar wrapper
  ├── MobileSidebar.jsx        # Mobile sidebar wrapper
  ├── MobileBottomNav.jsx      # Mobile bottom nav wrapper
  ├── WorkspaceSubSidebar.jsx  # Extracted sub-sidebar
  ├── ContentRouter.jsx        # Content routing
  ├── useLayoutShell.js        # Layout decision hook
  ├── useHeaderState.js        # Shared header state
  └── index.js                 # Barrel export
```

## 5. Rules

### 5A. Shell Selection
- **Desktop**: `viewport > 768px` → renders `DesktopLayout`
- **Mobile**: `viewport ≤ 768px` → renders `MobileLayout`
- The shell switch is handled by `useLayoutShell()` → `shellType`
- Both shells receive identical data props from `LayoutShell`

### 5B. CSS Isolation
- `DesktopLayout.css` must NEVER contain `@media (max-width: 768px)` blocks
- `MobileLayout.css` must NEVER contain min-width desktop assumptions
- All responsive adjustments are handled by the shell selection, not media queries
- Exception: `@media (max-width: 1280px)` for desktop sub-breakpoints is OK in DesktopLayout.css
- Exception: `@media (max-width: 360px)` for ultra-compact is OK in MobileLayout.css

### 5C. Content Purity
- `ContentRouter` must have ZERO awareness of which shell is active
- Task logic, filter state, CRUD operations are never duplicated
- Management pages receive the same props regardless of shell
- If a component needs to know if it's on mobile, it uses `useLayoutShell()` — NOT `useIsMobile()`

### 5D. Chrome Separation
- **Backdrop overlays** exist ONLY in `MobileLayout`
- **Blur effects** exist ONLY in `MobileLayout` 
- **BottomNav** exists ONLY in `MobileLayout`
- **Sidebar inline panel** exists ONLY in `DesktopLayout`
- **Impersonation controls** exist ONLY in `DesktopLayout` header

### 5E. Phase 3 Compatibility
- `LayoutShell` accepts a `managementShell` prop (unused in Phase 2)
- `useLayoutShell()` returns `isManagementView` for Phase 3 routing
- `WorkspaceFilterContext` is available for Phase 3 sub-sidebar extraction
- No management-specific styles in shell CSS files

## 6. View Classification

`useLayoutShell()` classifies the current view:

| Classification | Condition | Shell Behavior |
|---|---|---|
| `isDashboard` | `activeVertical === null` | Full dashboard layout |
| `isManagementView` | `activeVertical` in management list | Phase 3: Management-specific shell |
| `isTaskBoard` | Everything else | Standard workspace layout |

**Management views**: `configuration`, `role_management`, `user_management`, `hub_management`, `hub_function_management`, `department_management`, `employee_role_management`, `client_category_management`, `client_service_management`, `client_billing_model_management`

## 7. Adding a New Shell Feature

When adding a new feature to the shell system:

1. **Identify if it's desktop-only, mobile-only, or shared**
2. **Desktop-only**: Add to `DesktopLayout.jsx` + `DesktopLayout.css`
3. **Mobile-only**: Add to `MobileLayout.jsx` + `MobileLayout.css`
4. **Shared**: Add to both layouts, or create a shared component in `src/app/shells/`
5. **NEVER** add shell-specific logic to `ContentRouter` or data components

## 8. Adding a New Vertical

When adding a new vertical to the application:

1. Add the vertical to `verticalRegistry.js` (existing pattern)
2. Add any management views to the `MANAGEMENT_VIEWS` list in `useLayoutShell.js`
3. Add the content route to `ContentRouter.jsx`
4. The shell system requires ZERO changes — it renders any content transparently

## 9. Verification Checklist

Before merging any shell change:

- [ ] `npm run build` passes
- [ ] Desktop: no overlays, no blur, no tray, sidebar inline
- [ ] Mobile: drawer sidebar, tray visible, blur on overlay
- [ ] Shell switch at 768px is clean (no flash)
- [ ] ContentRouter has no shell-awareness
- [ ] CSS is in the correct shell file
- [ ] Phase 3 prop slots are not broken
