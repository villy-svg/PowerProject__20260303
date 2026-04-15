# Phase 6 — Mobile-Responsive Aesthetics

## Context Block

### What You Are Building
You are making the PowerProject web app look and feel native on mobile viewports. This involves adding responsive CSS breakpoints, ensuring touch-friendly interaction targets, implementing safe-area handling for notched devices, and redesigning the sidebar navigation for mobile. 

> [!CAUTION]
> **Zero Desktop Impact Rule**: ALL mobile CSS in this phase MUST be inside `@media` queries. If a single desktop pixel is changed, this phase has failed. The existing web experience on GitHub Pages must be pixel-identical.

### What You MUST Read First
1. `.agent/skills/ui-design-system/SKILL.md` — ALL sections, especially:
   - §1: Theme Variables (CSS custom properties)
   - §2: Halo Buttons (padding, border-radius)
   - §11: Small Laptop Responsiveness (existing breakpoints)
   - §12: Apple-Inspired Premium Design (squircle, glass, spacing)
2. `.agent/skills/development-best-practices/SKILL.md` — CSS and responsive rules
3. `.agent/skills/runtime-stability-and-coding-health/SKILL.md` — Zero-crash policy

### Key Architecture Facts
- **Main CSS files** (edit order matters):
  1. `src/index.css` — Base reset
  2. `src/styles/globalTheme.css` — Design tokens, halo system, shared components
  3. `src/App.css` — Main layout (sidebar, header, content area)
  4. Individual component `.css` files
- **Existing breakpoints** (from UI Design System §11):
  - Large Laptop: `1440px`
  - Small Laptop: `1200px`
  - Tablet/Mobile: `<1024px`
- **New breakpoints** (this phase adds):
  - Tablet: `768px`
  - Phone: `480px`
- **Navigation**: Desktop uses a left sidebar (`Sidebar.jsx`). Mobile needs either bottom tabs or a hamburger menu.
- **The sidebar** has an overlay pattern already (`sidebar-overlay` class)
- **Logo button**: `button.logo-button` toggles sidebar open/close

### Critical CSS Variables for Mobile Scaling
```css
/* From globalTheme.css — these are the desktop values  */
--radius-squircle: 24px;    /* → 16px on phone */
--radius-button: 12px;      /* → 10px on phone */
--glass-blur: 20px;         /* → 12px on phone */
--shadow-premium: 0 12px 40px rgba(0, 0, 0, 0.6);  /* lighter on phone */
```

---

## Prerequisites
- [ ] **Phase 1 completed** — PWA manifest with `viewport-fit=cover`
- [ ] CSS knowledge of `@media`, `env(safe-area-inset-*)`, `clamp()`
- [ ] Access to browser DevTools with device simulation (Chrome recommended)

---

## Sub-Phase 6.1 — Add Mobile Breakpoints to globalTheme.css

### Step 1: Add mobile-specific design token overrides

**File**: `src/styles/globalTheme.css`

Add this section at the **END** of the file, after all existing rules:

```css
/* ==========================================================================
   5. MOBILE VIEWPORT ADAPTATIONS
   Rule: ALL styles below MUST remain inside @media queries.
   Zero desktop impact. See UI Design System §14.
   ========================================================================== */

/* ── Tablet (≤768px) ── */
@media screen and (max-width: 768px) {
  :root,
  [data-theme='dark'] {
    --radius-squircle: 20px;
    --radius-button: 10px;
    --glass-blur: 14px;
    --shadow-premium: 0 8px 24px rgba(0, 0, 0, 0.4);
  }

  /* Scale down halo buttons for touch */
  .halo-button {
    padding: 10px 18px;
    font-size: 0.85rem;
    min-width: 80px;
    min-height: 44px; /* Touch target minimum */
  }

  .master-action-btn {
    padding: 10px 16px;
    font-size: 0.8rem;
    min-height: 44px;
  }

  /* View toggles — larger touch targets */
  .view-toggle-btn {
    padding: 8px 14px;
    font-size: 0.75rem;
    min-height: 38px;
  }

  /* Empty states — less padding on mobile */
  .empty-state-container {
    padding: 2.5rem 1.5rem;
  }

  .empty-state-icon {
    font-size: 3rem;
  }

  .empty-state-title {
    font-size: 1.25rem;
  }
}

/* ── Phone (≤480px) ── */
@media screen and (max-width: 480px) {
  :root,
  [data-theme='dark'] {
    --radius-squircle: 16px;
    --radius-button: 8px;
    --glass-blur: 12px;
    --shadow-premium: 0 4px 16px rgba(0, 0, 0, 0.3);
  }

  /* Full-width buttons on phone */
  .halo-button {
    padding: 12px 16px;
    font-size: 0.82rem;
    width: 100%;
    min-height: 44px;
  }

  .master-action-btn {
    padding: 10px 14px;
    font-size: 0.78rem;
    width: 100%;
    min-height: 44px;
  }

  /* Stack view toggles if needed */
  .view-mode-toggle {
    gap: 4px;
    padding: 3px;
  }

  .view-toggle-btn {
    padding: 6px 10px;
    font-size: 0.7rem;
    min-height: 36px;
  }

  /* Compact empty states */
  .empty-state-container {
    padding: 2rem 1rem;
    gap: 1rem;
  }

  .empty-state-icon {
    font-size: 2.5rem;
  }

  .empty-state-title {
    font-size: 1.1rem;
  }

  .empty-state-text {
    font-size: 0.85rem;
  }
}
```

> [!IMPORTANT]
> **Design Token Scaling Rationale**:
> - `--radius-squircle` reduces from 24→20→16px because cards on phone viewports are smaller, and oversized radii look disproportionate.
> - `--glass-blur` reduces because heavy blur is GPU-intensive on mobile and adds no value at small sizes.
> - `min-height: 44px` on all interactive elements follows Apple HIG / Material Design touch target guidelines.

---

## Sub-Phase 6.2 — Safe Area Handling

### Step 1: Add safe area CSS variables

**File**: `src/styles/globalTheme.css`

Add this inside the mobile media queries section (at the end of the file):

```css
/* ── Safe Area Support (Notched Devices) ── */
@media screen and (max-width: 768px) {
  /* Provide fallback values for devices without notches */
  :root {
    --safe-top: env(safe-area-inset-top, 0px);
    --safe-right: env(safe-area-inset-right, 0px);
    --safe-bottom: env(safe-area-inset-bottom, 0px);
    --safe-left: env(safe-area-inset-left, 0px);
  }
}
```

### Step 2: Apply safe area padding to the app layout

**File**: `src/App.css`

Add at the END of the file:

```css
/* ── Mobile Safe Area Padding ── */
@media screen and (max-width: 768px) {
  .app-container {
    padding-top: var(--safe-top, 0px);
    padding-left: var(--safe-left, 0px);
    padding-right: var(--safe-right, 0px);
  }
}
```

> [!NOTE]
> We do NOT add `padding-bottom` to `.app-container` because the bottom safe area will be handled by the mobile navigation bar (Sub-Phase 6.4).

---

## Sub-Phase 6.3 — Create `useIsMobile` Hook

### Step 1: Create the hook file

**File**: `src/hooks/useIsMobile.js`

```javascript
/**
 * useIsMobile Hook
 * 
 * Provides reactive viewport size detection for conditional rendering.
 * Uses a debounced resize listener for performance.
 * 
 * Breakpoints match the UI Design System §14:
 * - isPhone: ≤480px
 * - isTablet: ≤768px (includes phones)
 * - isMobile: ≤768px (alias for isTablet)
 * - isDesktop: >768px
 * 
 * Skill compliance:
 * - Dev Best Practices: Isolated hook, not scattered in components
 * - Runtime Stability: SSR-safe with window check
 */

import { useState, useEffect } from 'react';

const BREAKPOINTS = {
  phone: 480,
  tablet: 768,
};

export function useIsMobile() {
  const [dimensions, setDimensions] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
  }));

  useEffect(() => {
    let timeoutId = null;

    const handleResize = () => {
      // Debounce resize events (100ms)
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setDimensions({ width: window.innerWidth });
      }, 100);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  const isPhone = dimensions.width <= BREAKPOINTS.phone;
  const isTablet = dimensions.width <= BREAKPOINTS.tablet;
  const isMobile = isTablet; // Convenience alias
  const isDesktop = !isTablet;

  return {
    isPhone,
    isTablet,
    isMobile,
    isDesktop,
    viewportWidth: dimensions.width,
  };
}
```

---

## Sub-Phase 6.4 — Mobile Navigation Pattern

### Step 1: Add mobile header and navigation styles

**File**: `src/App.css`

Add at the END of the file (inside `@media` queries):

```css
/* ── Mobile Layout Adaptations ── */
@media screen and (max-width: 768px) {
  /* Header: collapse to essential controls */
  .app-header {
    padding: 8px 12px;
    padding-top: calc(8px + var(--safe-top, 0px));
  }

  /* Brand title: smaller on mobile */
  .brand-title-centered {
    font-size: 1rem;
    letter-spacing: 0;
  }

  /* Sidebar: full-screen overlay on mobile (already partially implemented) */
  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    width: 280px;
    z-index: calc(var(--z-modal) + 1);
    transform: translateX(-100%);
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .sidebar.open {
    transform: translateX(0);
  }

  .sidebar-overlay.active {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    z-index: var(--z-modal);
  }

  /* Main area takes full width when sidebar is hidden */
  .app-main-area {
    margin-left: 0 !important;
    width: 100% !important;
  }

  /* Logo button: always visible as hamburger trigger */
  .logo-button {
    position: fixed;
    top: calc(8px + var(--safe-top, 0px));
    left: 12px;
    z-index: var(--z-header);
    width: 40px;
    height: 40px;
    min-height: 44px; /* Touch target */
    min-width: 44px;
  }

  /* Content area padding for mobile */
  .app-content {
    padding: 12px;
    padding-bottom: calc(12px + var(--safe-bottom, 0px));
  }
}

/* ── Phone-Specific Layout ── */
@media screen and (max-width: 480px) {
  .app-header {
    padding: 6px 8px;
    padding-top: calc(6px + var(--safe-top, 0px));
  }

  .brand-title-centered {
    font-size: 0.9rem;
  }

  .sidebar {
    width: 100%; /* Full-width sidebar on phone */
  }

  .app-content {
    padding: 8px;
    padding-bottom: calc(8px + var(--safe-bottom, 0px));
  }
}
```

> [!IMPORTANT]
> **Skill Compliance — UI Design System §12B**:
> The sidebar overlay uses `backdrop-filter: blur(4px)` matching the modal overlay pattern. The sidebar itself should have `backdrop-filter: blur(var(--glass-blur))` for the glassmorphism effect.

---

## Sub-Phase 6.5 — Touch Target Enforcement

### Step 1: Add universal touch target rules

**File**: `src/styles/globalTheme.css`

Add inside the existing tablet `@media` block (`max-width: 768px`):

```css
  /* ── Universal Touch Target Enforcement ── */
  /* All interactive elements must be at least 44px */
  button,
  a,
  select,
  input[type="checkbox"],
  input[type="radio"],
  .selection-area,
  [role="button"],
  [tabindex] {
    min-height: 44px;
    min-width: 44px;
  }

  /* Input fields — taller for fat-finger friendliness */
  input[type="text"],
  input[type="email"],
  input[type="password"],
  input[type="number"],
  input[type="search"],
  input[type="url"],
  input[type="tel"],
  textarea,
  select {
    min-height: 44px;
    font-size: 16px; /* Prevents iOS zoom on focus */
  }

  /* Badge/tag elements — ensure tappable even if visually small */
  .tag-neutral,
  .dept-badge,
  .role-badge,
  .hub-badge,
  .status-pill {
    min-height: 28px;
    display: inline-flex;
    align-items: center;
  }
```

> [!IMPORTANT]
> **`font-size: 16px` for inputs is critical.** iOS Safari automatically zooms in on input fields with `font-size < 16px` on focus. This creates a disorienting experience where the viewport zooms in and doesn't zoom back. Setting `min 16px` on mobile prevents this behavior entirely.

---

## Sub-Phase 6.6 — Update UI Design System Skill (§14)

### Step 1: Add §14 to the UI Design System skill file

**File**: `.agent/skills/ui-design-system/SKILL.md`

Add the following section at the END of the file, after §13:

```markdown

---

## 14. Mobile Viewport Adaptations

All mobile-specific styles MUST follow these rules to ensure zero impact on the desktop experience.

### A. Breakpoints
| Name | Max-Width | Target Devices |
|------|-----------|----------------|
| **Tablet** | `768px` | iPads, Android tablets, small laptops in portrait |
| **Phone** | `480px` | All smartphones (iPhone SE to iPhone Pro Max) |

### B. Touch Target Minimum
- **Rule**: ALL interactive elements (`button`, `a`, `select`, `input`, `[role="button"]`) MUST have `min-height: 44px` and `min-width: 44px` on mobile viewports.
- **Source**: Apple Human Interface Guidelines + Material Design 3.
- **Input Font Size**: All text inputs MUST be `font-size: 16px` minimum on mobile to prevent iOS Safari auto-zoom.

### C. Design Token Scaling
| Token | Desktop | Tablet (768px) | Phone (480px) |
|-------|---------|-----------------|----------------|
| `--radius-squircle` | 24px | 20px | 16px |
| `--radius-button` | 12px | 10px | 8px |
| `--glass-blur` | 20px | 14px | 12px |
| `--shadow-premium` | `0 12px 40px` | `0 8px 24px` | `0 4px 16px` |

### D. Safe Area Handling
- **Rule**: Use `env(safe-area-inset-*)` for padding on edges that touch the screen boundary.
- **Pattern**: Define CSS variables `--safe-top`, `--safe-right`, `--safe-bottom`, `--safe-left` with `env()` fallback.
- **Prerequisite**: `<meta name="viewport" content="viewport-fit=cover">` must be in `index.html`.

### E. Mobile Navigation
- **Desktop**: Left sidebar (always visible or toggle).
- **Mobile (≤768px)**: Sidebar becomes a full-height overlay (slide from left), triggered by the logo/hamburger button. Overlay has `backdrop-filter: blur(4px)` and semi-transparent background.
- **Phone (≤480px)**: Sidebar takes full viewport width.

### F. Testing Requirements
Test all mobile changes at these viewport widths:
- `360px` — Small Android (Galaxy S series)
- `390px` — iPhone 14 / 15
- `428px` — iPhone 14 Pro Max
- `768px` — iPad Mini / tablet boundary

### G. Zero Desktop Impact Rule
- **Rule**: ALL mobile CSS MUST be inside `@media screen and (max-width: Xpx)` queries.
- **Verification**: After any mobile CSS change, open the app at `1440px` width and confirm ZERO visual differences from the previous state.
- **Violation**: Any mobile CSS that escapes its `@media` query and affects desktop is a blocking bug.
```

---

## Checkpoint — Phase 6 Complete

### Desktop Regression (CRITICAL — Test First!)
Open the app at `1440px × 900px`:
- [ ] **PASS**: App appearance is IDENTICAL to pre-Phase-6 (screenshot comparison recommended)
- [ ] **PASS**: All halo buttons have the same size, padding, and effects
- [ ] **PASS**: Sidebar behavior unchanged (toggle works, overlay works)
- [ ] **PASS**: Header layout unchanged
- [ ] **PASS**: No console errors

### Small Laptop Regression
Open the app at `1280px × 800px`:
- [ ] **PASS**: Same behavior as before Phase 6 (existing §11 breakpoints unaffected)

### Tablet Viewport (768px)
Open Chrome DevTools → Responsive → 768px width:
- [ ] **PASS**: Design tokens scale down (verify `--radius-squircle` is `20px`)
- [ ] **PASS**: Halo buttons are touch-friendly (≥44px height)
- [ ] **PASS**: Sidebar operates as overlay (slide from left)
- [ ] **PASS**: No horizontal scrollbar
- [ ] **PASS**: Input fields are 16px font size (no iOS zoom)

### Phone Viewport (360px)
Open Chrome DevTools → Responsive → 360px width:
- [ ] **PASS**: No horizontal overflow (no content wider than viewport)
- [ ] **PASS**: Buttons are full-width and ≥44px tall
- [ ] **PASS**: Text is readable (no text smaller than 12px)
- [ ] **PASS**: Sidebar slides in at full viewport width
- [ ] **PASS**: Safe area CSS variables resolve (even if 0 on desktop)
- [ ] **PASS**: Dark mode glassmorphism effects still work

### Phone Viewport (390px — iPhone 14)
- [ ] **PASS**: Same as 360px checks pass

### Phone Viewport (428px — iPhone 14 Pro Max)
- [ ] **PASS**: Same as 360px checks pass

### Hook Verification
- [ ] **PASS**: `src/hooks/useIsMobile.js` exists
- [ ] **PASS**: Exports `useIsMobile` function
- [ ] **PASS**: Returns `{ isPhone, isTablet, isMobile, isDesktop, viewportWidth }`

### Skill File Verification
- [ ] **PASS**: `.agent/skills/ui-design-system/SKILL.md` has a new §14 section
- [ ] **PASS**: §14 covers breakpoints, touch targets, token scaling, safe areas, navigation, testing widths, zero desktop impact

---

## Rollback Plan

1. **Revert globalTheme.css**: Remove the entire "5. MOBILE VIEWPORT ADAPTATIONS" section at the end of the file
2. **Revert App.css**: Remove all `@media` blocks added at the end of the file
3. **Delete hook**: Remove `src/hooks/useIsMobile.js`
4. **Revert skill file**: Remove §14 from `.agent/skills/ui-design-system/SKILL.md`
5. **Verify**: Open at 1440px — app is identical to pre-phase state

---

## Files Modified Summary

| Action | File | Description |
|--------|------|-------------|
| **MODIFIED** | `src/styles/globalTheme.css` | Added mobile breakpoint overrides, touch targets, safe areas |
| **MODIFIED** | `src/App.css` | Added mobile layout rules (header, sidebar overlay, content) |
| **NEW** | `src/hooks/useIsMobile.js` | Reactive viewport size detection hook |
| **MODIFIED** | `.agent/skills/ui-design-system/SKILL.md` | Added §14: Mobile Viewport Adaptations |
