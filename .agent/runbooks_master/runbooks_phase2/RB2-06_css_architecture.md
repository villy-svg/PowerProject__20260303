# RB2-06: CSS Architecture Split

## Objective
Separate CSS into shell-scoped stylesheets so that:
- `DesktopLayout.css` contains desktop-only styles (no `@media max-width` breakpoints)
- `MobileLayout.css` contains mobile-only styles (no `min-width` desktop assumptions)
- Existing CSS files (`App.css`, `VerticalWorkspace.css`, `MasterPageHeader.css`, `Sidebar.css`, `BottomNav.css`) have their `@media` blocks migrated to the appropriate shell CSS

**Critical rule**: We are MIGRATING styles, not rewriting them. The visual output must be
pixel-identical before and after. We are organizing, not redesigning.

---

## Pre-Flight Checks

```powershell
cd "c:\Users\villy\OneDrive\Documents\PowerPod New\Coding Practice\PowerProject"

# 1. Confirm RB2-05 commit exists
git log --oneline -5

# 2. Build passes
npm run build

# 3. Take visual screenshots at 1280px and 375px for comparison
# (Manual — use browser DevTools)
```

---

## Step 1: Audit Existing Media Queries

Before making any changes, catalog every `@media` block in the affected CSS files.

### Files to audit:

| File | Mobile blocks | Desktop blocks |
|---|---|---|
| `App.css` | `@media (max-width: 768px)` lines 76-92, `@media (max-width: 480px)` lines 154-161 | None (desktop is default) |
| `VerticalWorkspace.css` | `@media (max-width: 768px)` lines 107-118, `@media (max-width: 1024px)` lines 127-156 | None |
| `MasterPageHeader.css` | `@media (max-width: 1024px)` lines 132-362 | None (desktop is default) |
| `Sidebar.css` | `@media (max-width: 768px)` lines 205-253, `@media (min-width: 769px)` lines 255-258, `@media (max-width: 768px)` lines 270-273 | None |
| `BottomNav.css` | ALL of BottomNav is mobile-only | None |

---

## Step 2: Populate `DesktopLayout.css`

**File**: `src/app/shells/DesktopLayout.css`

Move desktop-specific layout styles here. These are the styles that assume
a sidebar is inline, a full header bar is visible, and there's no bottom nav.

```css
/* ==========================================================================
   DESKTOP LAYOUT SHELL — Phase 2 Adaptive UI
   
   RULE: NO @media (max-width: 768px) blocks in this file.
   All mobile-specific styles belong in MobileLayout.css.
   
   This file contains:
   1. Desktop layout grid (sidebar + main content)
   2. Desktop header bar (inline, always visible)
   3. Desktop sidebar (inline panel, not overlay)
   4. Desktop workspace adjustments
   ========================================================================== */

/* ── 1. Desktop Shell Container ──────────────────────────────────────── */
.desktop-layout {
  display: flex;
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
  background-color: var(--bg-color);
  color: var(--text-color);
  transition: background-color 0.3s ease, color 0.3s ease;
}

.desktop-layout .app-main-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 0;
  overflow: hidden;
  transition: all var(--transition-main);
  background-color: var(--surface-card);
  position: relative;
  min-height: 0;
}

.desktop-layout .app-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding-top: 0;
}

/* ── 2. Desktop Header ───────────────────────────────────────────────── */
/* The desktop header is always visible — no scroll-aware hiding */
.desktop-header-shell {
  /* Inherits from .master-page-header base styles */
  /* No sticky behavior, no transform animations */
}

.desktop-header-shell .header-row-2 {
  /* Description is always visible on desktop */
  display: block;
}

.desktop-header-shell .master-header-actions-row {
  /* Always visible on desktop — no hiding */
  display: flex !important;
}

/* Desktop expanded menu is inline, not a fixed overlay */
.desktop-header-shell .expanded-menu-row {
  position: relative;
  top: auto;
  left: auto;
  margin-top: 16px;
  padding: 12px 16px;
  background: transparent;
  border: 1px solid color-mix(in srgb, var(--brand-green), transparent 85%);
  border-radius: 16px;
  backdrop-filter: blur(20px);
  animation: slideDown 0.2s ease-out;
  width: 100%;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3), 0 0 15px rgba(0, 255, 135, 0.05);
}

/* ── 3. Desktop Sidebar ──────────────────────────────────────────────── */
/* Sidebar is an inline flex panel on desktop — never fixed/overlay */
.desktop-layout .sidebar {
  position: relative;
  height: 100vh;
  z-index: 10;
  /* No fixed positioning, no translateX */
}

/* ── 4. Desktop Workspace ────────────────────────────────────────────── */
/* Sub-sidebar is inline on desktop — no backdrop needed */
.desktop-layout .sidebar-backdrop,
.desktop-layout .menu-backdrop {
  display: none !important;
}

/* No blur on desktop — sub-sidebar and menu are inline */
.desktop-layout .workspace-main-view.is-blurred {
  filter: none !important;
}

/* Desktop workspace content gets generous padding */
.desktop-layout .workspace-content {
  padding: 32px;
}

@media (max-width: 1280px) {
  .desktop-layout .workspace-content {
    padding: 24px;
  }
  .desktop-layout .sub-sidebar {
    width: 240px;
  }
}

/* ── 5. Desktop-Only Utilities ───────────────────────────────────────── */
/* Hide mobile-only elements on desktop */
.desktop-layout .mobile-action-tray {
  display: none !important;
}

.desktop-layout .bottom-nav {
  display: none !important;
}

/* Logo is always visible on desktop */
.desktop-layout .logo-button {
  display: flex;
}

/* Desktop mobile-menu-header is hidden */
.desktop-layout .mobile-menu-header {
  display: none;
}
```

---

## Step 3: Populate `MobileLayout.css`

**File**: `src/app/shells/MobileLayout.css`

```css
/* ==========================================================================
   MOBILE LAYOUT SHELL — Phase 2 Adaptive UI
   
   RULE: NO min-width desktop assumptions in this file.
   All desktop-specific styles belong in DesktopLayout.css.
   
   This file contains:
   1. Mobile layout container
   2. Mobile header (sticky, scroll-aware)
   3. Mobile sidebar (off-canvas drawer)
   4. Mobile action tray (bottom pill bar)
   5. Mobile workspace adjustments
   6. Touch target sizing
   ========================================================================== */

/* ── 1. Mobile Shell Container ───────────────────────────────────────── */
.mobile-layout {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
  background-color: var(--bg-color);
  color: var(--text-color);
  padding-top: var(--safe-top, 0px);
  padding-left: var(--safe-left, 0px);
  padding-right: var(--safe-right, 0px);
  transition: background-color 0.3s ease, color 0.3s ease;
}

.mobile-layout .app-main-area {
  margin-left: 0 !important;
  width: 100% !important;
  padding-bottom: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: var(--surface-card);
  position: relative;
  min-height: 0;
}

.mobile-layout .app-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 8px;
}

/* ── 2. Mobile Header ────────────────────────────────────────────────── */
.mobile-header-shell {
  padding-top: 12px;
  margin-bottom: 16px;
}

.mobile-header-shell .header-row-1 h1 {
  font-size: 1.25rem;
  text-align: center;
  width: 100%;
  opacity: 0.9;
  text-shadow: 0 0 20px var(--halo-glow);
}

/* Description hidden on mobile for space */
.mobile-header-shell .header-row-2 {
  display: none;
}

/* Actions row hidden on mobile — replaced by tray */
.mobile-header-shell .master-header-actions-row {
  display: none !important;
}

/* Mobile scroll-aware hide */
.mobile-header-shell.header-hidden {
  transform: translateY(-110%);
  opacity: 0;
  pointer-events: none;
  z-index: 2000;
  transition: transform 0.4s cubic-bezier(0.32, 0, 0.67, 0), opacity 0.4s ease;
}

/* Mobile sticky state */
.mobile-header-shell.is-sticky {
  position: sticky !important;
  top: 0;
  z-index: 2000;
  background: var(--bg-color);
  margin-bottom: 0px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-color);
}

/* Mobile expanded menu is a full-screen overlay */
.mobile-header-shell .expanded-menu-row {
  position: fixed !important;
  top: 0;
  left: 0;
  right: 0;
  z-index: 2100;
  margin-top: 0;
  padding: calc(var(--safe-top, 0px) + 20px) 20px 30px 20px;
  background: var(--bg-color);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  max-height: 85vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 16px;
  border-radius: 0 0 24px 24px;
  animation: slidePaneDown 0.4s cubic-bezier(0.19, 1, 0.22, 1);
}

@keyframes slidePaneDown {
  from { transform: translateY(-100%); }
  to { transform: translateY(0); }
}

.mobile-header-shell .mobile-menu-header {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  width: 100%;
  margin-bottom: 12px;
}

.mobile-header-shell .master-header-left,
.mobile-header-shell .master-header-right {
  flex-direction: column;
  align-items: stretch;
  width: 100%;
  gap: 16px;
}

.mobile-header-shell .master-header-left .view-mode-toggle {
  margin-right: 0;
  width: 100%;
}

/* ── 3. Mobile Sidebar ───────────────────────────────────────────────── */
.mobile-layout .sidebar {
  position: fixed;
  top: 0;
  left: 0;
  height: 100vh;
  width: 80vw;
  max-width: 300px;
  transform: translateX(-100%);
  opacity: 1 !important;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 10px 0 40px rgba(0, 0, 0, 0.3);
  z-index: 3010;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.mobile-layout .sidebar.open {
  transform: translateX(0);
}

.mobile-layout .sidebar:not(.open) {
  width: 80vw;
  max-width: 300px;
  transform: translateX(-100%);
}

/* ── 4. Mobile Sub-Sidebar ───────────────────────────────────────────── */
.mobile-layout .sub-sidebar {
  width: 240px;
  position: fixed;
  z-index: 1001;
  top: 0;
  bottom: 0;
  left: 0;
  transform: translateX(-100%);
  box-shadow: 10px 0 30px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              bottom 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.mobile-layout .sub-sidebar.tray-visible {
  bottom: 64px;
}

.mobile-layout .workspace-container:not(.sub-sidebar-collapsed) .sub-sidebar {
  transform: translateX(0);
}

.mobile-layout .sidebar-backdrop,
.mobile-layout .menu-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: transparent;
  cursor: pointer;
}

/* ── 5. Mobile Workspace ─────────────────────────────────────────────── */
.mobile-layout .workspace-content {
  padding: 0 12px 12px 12px;
  padding-bottom: calc(100px + var(--safe-bottom, 0px));
  transition: filter 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.mobile-layout .workspace-main-view.is-blurred {
  filter: blur(8px);
  transition: filter 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* ── 6. Mobile Logo / Brand ──────────────────────────────────────────── */
.mobile-layout .mobile-hidden {
  display: none !important;
}

.mobile-layout .mobile-logo-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  cursor: pointer;
  position: absolute;
  left: 1rem;
  top: calc(10px + var(--safe-top, 0px));
  z-index: 3011;
  transition: transform 0.2s ease;
  padding: 0;
  width: 44px;
  height: 44px;
}

/* ── 7. Ultra-Compact Viewport (≤360px, iPhone SE) ───────────────────── */
@media screen and (max-width: 360px) {
  .mobile-header-shell .expanded-menu-row {
    padding: calc(var(--safe-top, 0px) + 16px) 12px 24px 12px;
    gap: 12px;
    max-height: 90vh;
  }
  .mobile-header-shell .master-header-left,
  .mobile-header-shell .master-header-right {
    gap: 12px;
  }
  .mobile-header-shell .view-mode-toggle,
  .mobile-header-shell .header-filter-group {
    flex-direction: column !important;
    align-items: stretch !important;
    width: 100% !important;
    gap: 8px !important;
  }
  .mobile-header-shell .view-mode-toggle .view-toggle-btn,
  .mobile-header-shell .header-filter-group .toggle-depri-btn {
    width: 100% !important;
    min-height: 44px !important;
    margin: 0 !important;
    justify-content: center;
  }
}

@media screen and (max-width: 480px) {
  .mobile-layout .sidebar {
    width: 100%;
  }
}
```

---

## Step 4: Clean Up Original CSS Files

### IMPORTANT: Do NOT delete media queries from original files yet.

In Phase 2, we use an **additive** approach:
- The new shell CSS files add the shell-scoped styles
- The original CSS files keep their `@media` blocks (they still work because
  the CSS cascade respects the more specific selectors)

In Phase 3, when the shell system is fully proven, we can remove the duplicate
`@media` blocks from the original files.

For now, add a comment to each original file marking the blocks as "migrated":

```css
/* MIGRATED TO SHELL CSS (DesktopLayout.css / MobileLayout.css) — Phase 3 will remove */
```

---

## Step 5: Verify CSS Isolation

```powershell
# 1. Build check
npm run build

# 2. Verify no visual regression at 1280px (desktop)
# Compare with screenshot from pre-flight

# 3. Verify no visual regression at 375px (mobile)
# Compare with screenshot from pre-flight

# 4. Verify CSS specificity:
# - Desktop shell styles should override base styles on desktop
# - Mobile shell styles should override base styles on mobile
# - No !important conflicts
```

---

## Verification Checklist

- [ ] `npm run build` passes
- [ ] Desktop (1280px): Sidebar inline, no backdrop, no blur, no tray
- [ ] Desktop (1280px): Header description visible, actions row visible
- [ ] Mobile (375px): Sidebar is drawer, backdrop appears
- [ ] Mobile (375px): Header is sticky, tray appears at bottom
- [ ] Mobile (375px): Menu slides down as full-screen overlay
- [ ] Mobile (320px): Ultra-compact styles apply correctly
- [ ] No CSS specificity conflicts (no layout glitches)

---

## Git Checkpoint

```powershell
git add -A
git commit -m "RB2-06: CSS architecture split — DesktopLayout.css + MobileLayout.css with shell-scoped styles"
```

---

## Files Created / Modified

| File | Action | Lines | Purpose |
|---|---|---|---|
| `src/app/shells/DesktopLayout.css` | MODIFIED (was skeleton) | ~120 | Desktop shell styles |
| `src/app/shells/MobileLayout.css` | MODIFIED (was skeleton) | ~200 | Mobile shell styles |
| Original CSS files | COMMENTS ONLY | +1 each | Migration markers |
