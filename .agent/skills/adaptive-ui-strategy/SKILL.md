---
name: Adaptive UI Strategy
description: Rules for handling Larger screens (Desktop) and Smaller screens (Mobile) with distinct, optimized interfaces. Ensures high-density management for desktop and focused action for mobile.
---

# Adaptive UI Strategy

This skill defines how PowerProject handles the fundamental differences between desktop and mobile experiences. We prioritize **Adaptive rendering** (swapping components) over pure **Responsive design** (squishing components) for complex views.

## 1. The Core Philosophy
- **Desktop (High Density)**: Optimized for precision, multi-tasking, and data-heavy management. Use full tables, side-by-side grids, and hover-based interactions.
- **Mobile (Focused Action)**: Optimized for thumb-driven, single-task focus. Use vertical stacks, bottom trays (sheets), and 44px+ touch targets.

## 2. Breakpoint Standards
Always use these standardized breakpoints from `useIsMobile()` and CSS media queries:

| Device Category | Breakpoint | CSS Variable Reference |
| :--- | :--- | :--- |
| **Phone** | `≤ 480px` | `@media (max-width: 480px)` |
| **Tablet / Mobile** | `≤ 768px` | `@media (max-width: 768px)` |
| **Small Laptop** | `769px - 1280px` | Use `clamp()` for fluid spacing; avoid sidebar overflow. |
| **Desktop** | `> 1280px` | Full high-density management layout. |

## 3. Implementation Patterns (Adaptive vs Responsive)

### A. Component Swapping (Adaptive)
For complex data views (like Kanban or Management Tables), **swap the entire component tree** rather than forcing a desktop table to fit a mobile screen.

```jsx
import { useIsMobile } from '../hooks/useIsMobile';

function ClientManagement() {
  const { isMobile } = useIsMobile();

  return (
    <div className="management-container">
      {isMobile ? <ClientMobileList /> : <ClientDesktopTable />}
    </div>
  );
}
```

### B. CSS Separation
- **Desktop First**: Write base styles for desktop (default).
- **Mobile Scoping**: Wrap ALL mobile-specific overrides in `@media (max-width: 768px)`.
- **Isolation**: Mobile-specific classes (e.g., `.mobile-only-tray`) should not even exist in the DOM on desktop if possible.

## 4. Interaction Paradigms

### Desktop (Precision)
- **Hover**: Use hover for tooltips, row highlights, and appearing action buttons.
- **Multi-select**: Support `Shift+Click` or `Ctrl+Click` for bulk actions.
- **Keyboard**: Implement shortcuts (Esc to close, Enter to save).
- **Right-Click**: Context menus are acceptable for advanced users.

### Mobile (Touch)
- **Touch Targets**: Minimum `44px x 44px`. Add padding, not just size.
- **No Hover**: Essential information/actions MUST be visible without hover.
- **Gestures**: Prefer vertical scrolling. Avoid horizontal scroll unless it's a specific nav bar or carousel.
- **Bottom Trays**: Use bottom-anchored "sheets" for actions/filters instead of centered modals.

## 5. Navigation & Layout

### Desktop Layout
- **Sidebar**: Fixed or collapsible left navigation.
- **Master Header**: Persistent top bar with breadcrumbs and primary "Add" actions on the right.
- **Modals**: Centered overlays for forms.

### Mobile Layout
- **Bottom Nav**: Persistent icons for primary verticals.
- **Top-Down Menu**: The "Menu" button should trigger a top-down tray for secondary navigation.
- **Drawer/Sheet**: Forms should open as a full-screen drawer or a large bottom sheet.

## 6. Data Density & Presentation

| Element | Desktop Pattern | Mobile Pattern |
| :--- | :--- | :--- |
| **Tables** | Multi-column, sortable, fixed headers. | Convert to "Cards" or "List Items". |
| **Grids** | 3-4 columns (Auto-fit). | 1 column (Stack). |
| **Forms** | Side-by-side fields (2 columns). | Single column, large labels. |
| **Modals** | `max-width: 600px`, centered. | `width: 100%`, anchored to bottom or full-screen. |

## 7. Performance & Constraints
- **Blur Effects**: Reduce `backdrop-filter: blur()` intensity on mobile to prevent GPU lag.
- **Animations**: Use `transform: translate3d` for hardware acceleration. Keep mobile transitions shorter (200ms vs 300ms).
- **Hidden Content**: Use `display: none` for mobile elements on desktop and vice-versa to reduce accessibility tree bloat.

## 8. Shell Architecture Integration

Starting with Phase 2, adaptive rendering is enforced at the **shell level** rather than via inline `useIsMobile` guards:

- **`LayoutShell`** orchestrates which shell (Desktop vs Mobile) to render
- **`DesktopLayout`** and **`MobileLayout`** swap the chrome around shared content
- **`ContentRouter`** renders page content with zero shell-awareness

For complete details, see:
- [Shell Architecture System](file:///c:/Users/villy/OneDrive/Documents/PowerPod%20New/Coding%20Practice/PowerProject/.agent/skills/shell-architecture-system/SKILL.md) — rules for the shell system
- [Phased Refactoring Roadmap](file:///c:/Users/villy/OneDrive/Documents/PowerPod%20New/Coding%20Practice/PowerProject/.agent/skills/phased-refactoring-roadmap/SKILL.md) — tracks Phase 1/2/3 progress
- `runbooks_phase2/` — verbatim implementation runbooks

## 9. Verification Checklist
- [ ] Does the UI work at `360px` (Small Phone)?
- [ ] Does the UI work at `1024px` (Small Laptop)?
- [ ] Are all touch targets at least `44px`?
- [ ] Did you swap components for complex views (Adaptive) rather than just resizing (Responsive)?
- [ ] Is there **ZERO** impact on desktop layout when adding mobile styles?
- [ ] Are shell-specific styles in the correct CSS file (DesktopLayout.css vs MobileLayout.css)?
- [ ] Does ContentRouter have zero awareness of the active shell?
