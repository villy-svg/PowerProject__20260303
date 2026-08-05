# UI & Design System Enforcement

These rules ensure visual consistency and adherence to the PowerProject premium design aesthetics.

## 1. Zero Inline Styling
- **Strict Prohibition**: The `style={{}}` prop or inline HTML styles are **strictly prohibited**.
- **External CSS**: All styling MUST use CSS classes defined in external stylesheets.

## 2. Design System Tokens (No Hardcoded Colors)
- **CSS Variables Only**: You MUST use established CSS variables for all colors, spacing, and border radii (e.g., `var(--brand-green)`, `var(--radius-squircle)`).
- **No Hex Codes**: Hardcoded hex colors are prohibited. Introducing new palettes requires explicit user permission.

## 3. Primary Action Buttons
- **The Halo Button**: All primary action buttons MUST use the `.halo-button` class (glassmorphism style with subtle glow).
- **No Solid Fills**: Do not use solid fill buttons for primary actions unless specifically designated by a component's active state.

## 4. Unified 4-Color Status Palette
All status, priority, and attendance indicators must strictly use:
- **Danger**: `var(--status-danger)` (`#f43f5e`)
- **Warning**: `var(--status-warning)` (`#f59e0b`)
- **Neutral**: `var(--status-neutral)` (`#3b82f6`)
- **Success**: `var(--status-success)` (`#10b981`)
*(Note: Direct usage of `#ef4444` is deprecated).*

## 5. Standardized Forms & Dropdowns
- **Block-in-a-Box Forms**: All management forms must use the `.form-group` and `.form-input-container` wrapper architecture.
- **Master Dropdowns**: All `<select>` dropdowns must use `.master-dropdown` to avoid default browser styling (white backgrounds on options).

## 6. Glow vs Border Conflict
- **Choose One**: Use *either* an ambient glow (`box-shadow`) *or* a border. Do not stack both on the same active element unless one is near-invisible (like the default `.halo-button` resting state).
