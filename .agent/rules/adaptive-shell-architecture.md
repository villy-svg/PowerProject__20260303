# Adaptive UI & Shell Architecture System

These rules govern how PowerProject handles the differences between Desktop (high density) and Mobile (focused action) layouts.

## 1. Adaptive Component Swapping
- **Swap, Don't Squish**: For complex data views (like Kanban boards or Data Tables), **swap the entire component tree** rather than trying to responsively squish a desktop table onto a phone screen.
- **Example**: `{isMobile ? <ClientMobileList /> : <ClientDesktopTable />}`.

## 2. Viewport Breakpoints
Adhere to standard breakpoints tested against real devices:
- **Phone**: `≤ 480px`
- **Tablet / Mobile**: `≤ 768px` (Triggers `MobileLayout` shell)
- **Small Laptop**: `769px – 1280px` (Must be tested at 1024x768 and 1280x800)
- **Desktop**: `> 1280px`

## 3. Shell Architecture Isolation
- **The Core Principle**: Shared data + service modules → swapped shells. Task logic is never duplicated, only the frame around it.
- **LayoutShell**: Orchestrator that swaps between `DesktopLayout` (inline sidebar, header bar) and `MobileLayout` (drawer, tray, BottomNav).
- **ContentRouter Purity**: The `ContentRouter` and individual page components must have **zero awareness** of which shell is active.

## 4. CSS File Purity
- **Desktop Styles**: `DesktopLayout.css` must NEVER contain `@media (max-width: 768px)` blocks.
- **Mobile Styles**: `MobileLayout.css` must NEVER contain minimum width assumptions for desktop.
