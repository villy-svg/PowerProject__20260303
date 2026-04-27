---
name: PowerProject UI Design System
description: Core UI conventions and design rules for the PowerProject application. Must be followed for ALL UI changes — buttons, badges, modals, colors, and typography. Never introduce hardcoded hex colors or new styling patterns without referencing these rules first.
---

# PowerProject UI Design System

## 1. Theme Variables (Source of Truth)
All colors and spacing MUST use CSS variables. **Never use hardcoded hex colors for theme elements.**

### Core Variables (`App.css`)
```css
/* Light Mode */
--bg-color: #fcfcfd;
--text-color: #18181b;
--brand-green: #0d9488;      /* Teal 600 */
--border-color: #e4e4e7;

/* Dark Mode */
--bg-color: #09090b;
--text-color: #f4f4f5;
--brand-green: #2dd4bf;      /* Teal 400 */
--border-color: #3f3f46;

/* Halo Glow System */
--halo-glow: rgba(13, 148, 136, 0.2);    /* Light */
--halo-bg:   rgba(13, 148, 136, 0.05);
--halo-glow: rgba(45, 212, 191, 0.15);   /* Dark */
--halo-bg:   rgba(45, 212, 191, 0.05);
```

**Rule**: Ask the user for explicit permission before changing any color-related CSS variable or introducing a new palette.

---

## 2. Halo Buttons (`.halo-button`)
The **primary interactive element** throughout the app.

### Characteristics
- **Background**: `var(--halo-bg)` — a very subtle semi-transparent tint of brand green.
- **Border**: `1px solid color-mix(in srgb, var(--brand-green), transparent 60%)` — a soft, semi-transparent brand green stroke.
- **Text color**: `var(--brand-green)` — inheriting the teal palette.
- **Box shadow**: `0 0 3px var(--halo-glow)` — an ultra-subtle ambient glow.
- **Backdrop filter**: `blur(4px)` — glassmorphism effect.
- **Uppercase text**, `font-weight: 800`, `letter-spacing: 0.5px`.

### Hover State
- Background intensifies to `color-mix(in srgb, var(--brand-green), transparent 85%)`.
- Border becomes solid: `border-color: var(--brand-green)`, `border-width: 2px`.
- Glow amplifies: `box-shadow: 0 0 20px var(--halo-glow)`.
- Subtle lift: `transform: translateY(-1px)`.

### Usage
```jsx
<button className="halo-button">Export</button>
<button className="halo-button">+ New</button>
```

**Rule**: All primary action buttons (header actions, modal confirms, etc.) MUST use `.halo-button`. Do NOT use solid-fill buttons for primary actions.

---

## 3. Standardized Badge System (Neutral Premium)
All metadata chips (Hub, Dept, Role, Function, Assignee) and Priority indicators MUST use this unified system to ensure pixel-perfect alignment.

### A. Technical Specification
- **Typography**: `'JetBrains Mono', monospace`, `font-weight: 800`, `font-size: 0.65rem` (`0.6rem` on mobile).
- **Geometry**: `4px` border-radius (Strict: No pills), `1px 8px` padding, `min-height: 20px` (`18px` on mobile).
- **Layout**: `display: inline-flex`, `align-items: center`, `line-height: 1`, `text-transform: uppercase`, `letter-spacing: 0.5px`.
- **Transitions**: `all 0.2s ease`.

### B. The "Neutral Metadata" Rule
All infrastructure/system metadata MUST be neutralized to avoid visual noise.
- **Background**: `rgba(255, 255, 255, 0.05)`.
- **Border**: `1px solid var(--border-color)`.
- **Text Color**: `var(--text-color)` at `opacity: 0.7`.
- **Usage**: Hub codes, Function codes, Assignee status, Department/Role names.

### C. The "Semantic Priority" Rule
Only task status/priority indicators are allowed to use vibrant colors.
- **Urgent**: `#ef4444` (Red)
- **High**: `#f97316` (Orange)
- **Medium**: `#eab308` (Yellow)
- **Low**: `#22c55e` (Green)
- **Rule**: These MUST still share the technical typography and geometry of the Neutral badges to maintain alignment.

### D. Implementation (CSS Classes)
```css
/* All these MUST inherit from the base definition in globalTheme.css */
.hub-badge, .dept-badge, .role-badge, .tile-function-badge, .assignee-badge-base, .card-priority {
   /* Base styles managed centrally */
}
```

---

## 4. Selected State (Buttons in Selector Groups)
For toggle/selector button groups (e.g., capability level selectors in modals):

```css
/* Selected (Active) — Halo pattern */
.v-lvl-btn.active {
  border: 2px solid var(--brand-green);
  background: rgba(16, 185, 129, 0.15);
  color: var(--brand-green); opacity: 1;
}
```

**Rule**: Selected states use a **2px border + subtle tint** (halo style), NOT solid fills.

---

## 5. Modals
- **Overlay**: `position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);`
- **Body**: rounded corners (`border-radius: 24px` — Squircle), border `1px solid var(--border-color)`, background `var(--bg-color)`.
- **Footer actions**: `.halo-button` for confirmations.

---

## 6. Typography
- **Technical Metadata**: `'JetBrains Mono', monospace` (Badges, Codes, IDs).
- **Core Interface**: `'Inter', system-ui, sans-serif` (Body, Labels, Titles).
- **Micro-labels**: `0.65rem`, `font-weight: 800`, `text-transform: uppercase`, `letter-spacing: 0.5px`.

---

## 7. Global Stage/Priority Colors
Stage colors are referenced via `var(--stage-color)`.

Priority badge convention:
- **Urgent**: `rgba(239, 68, 68, 0.15)` bg, `#ef4444` text.
- **High**: `rgba(249, 115, 22, 0.15)` bg, `#f97316` text.
- **Medium**: `rgba(234, 179, 8, 0.1)` bg, `#eab308` text.
- **Low**: `rgba(34, 197, 94, 0.1)` bg, `#22c55e` text.

**Rule**: These are the ONLY allowed semantic colors. They MUST use the standard badge geometry (4px radius, 20px height).


---

## 8. General Rules Summary
| Rule | Policy |
|------|--------|
| Hardcoded hex colors | ❌ Prohibited — use CSS variables |
| Changing color themes | 🔒 Requires explicit user permission |
| Button style for actions | ✅ `.halo-button` always |
| Badge backgrounds | ✅ Semi-transparent (rgba) only |
| Selected states | ✅ Halo border + subtle tint (no solid fills) |
| Introducing new color palettes | 🔒 Requires explicit user permission |
| Assignee badges on generic cards | ❌ Only render in vertical-specific tile components (e.g., `HubTaskTile`) |
---

## 9. Standard Form Styling (Block-in-a-Box)
All management forms (Add/Edit wizards) MUST follow the **"Block-in-a-Box"** architecture to ensure visual parity with the global design system.

### A. Form Blocks (`.form-group`)
Every label + input pair MUST be wrapped in a `.form-group` block.
- **Background**: `rgba(255, 255, 255, 0.02)`
- **Border**: `1px solid var(--border-color)`
- **Radius**: `12px`
- **Padding**: `14px`
- **Interaction**: On focus-within, the block background intensifies and the border lights up in brand-green.

### B. Inner Value Box (`.form-input-container`)
The actual input, select, or selector MUST be nested within a secondary container.
- **Background**: `var(--halo-bg)`
- **Border**: `1px solid var(--border-color)`
- **Radius**: `8px`
- **Min-Height**: `44px`
- **Typography**: `font-weight: 600`, `font-size: 0.95rem`.
- **Value Highlight**: Select values should be highlighted in `var(--brand-green)`.

### C. Layout & Density
- **Grids**: Use `.form-row-grid` for 2-column layouts with a consistent `16px` gap (matches block spacing).
- **Separation**: The `.vertical-task-form` container uses a `16px` gap between blocks.
- **Labels**: Labels must be uppercase, technical, and neutralized (`opacity: 0.5`, `font-weight: 800`).

**Rule**: All new forms MUST inherit from `ManagementForms.css`. Never use primitive `rgba(255,255,255,0.05)` for input backgrounds; always use the `form-input-container` wrapper.

---

## 10. Master Dropdown System (`.master-dropdown`)
To maintain the premium dark aesthetic, ALL dropdown (`<select>`) elements MUST use the standardized master style for consistency, especially to avoid the default white background on options.

### Stylistic Requirements
- **Background**: `var(--halo-bg)` with a solid `#0b1314` fallback for the `<option>` list in dark mode.
- **Text Color**: `var(--brand-green)` for the selected value, `var(--text-color)` for list options.
- **Border**: `1px solid var(--border-color)`, focuses to `var(--brand-green)`.
- **Custom Arrow**: Always use the SVG chevron arrow instead of the browser default.

### Implementation
```css
/* Import the master system in your component CSS */
@import '../../styles/DropdownSystem.css';

/* Apply to the select element */
.my-custom-form select {
  @extend .master-dropdown; /* Or simply apply the class in JSX */
}
```

**Rule**: All dropdowns in management forms (Clients, Employees, Hubs) MUST use `.master-dropdown`. Never leave dropdown options to default browser styling (white background).

## 11. Small Laptop Responsiveness (11" & 13")
To ensure the application remains functional on high-density 11" and 13" laptops (e.g., MacBook Air, Surface Go), ALL layouts MUST follow these scaling rules.

### Breakpoints
- **Large Laptop**: `1440px`
- **Small Laptop/Tablet Landscape**: `1200px` (Target for 11"/13" screens)
- **Tablet / Mobile**: `<1024px`

### Core Constraints
1.  **Dynamic Spacing**: Use `clamp()` for paddings and margins to prevent "overflow death" on small screens.
    -   Example: `padding: clamp(1rem, 3vw, 2.5rem);`
2.  **Horizontal Scrolling**: Tables and long lists MUST be wrapped in `.responsive-table-wrapper` with `overflow-x: auto`. Do NOT force-squish columns.
3.  **Flex Wrapping**: Container flex-bases should be fluid. Sidebar and Main Area ratios MUST shift to 1:0 (hidden sidebar) or reduced width below `1200px`.
4.  **Font Scaling**: Root font size should decrease from `16px` to `15px` or `14px` on narrow viewports to preserve layout integrity.

**Rule**: New designs MUST be tested at `1280x800` (13" sim) and `1024x768` (11" sim) to ensure no UI elements overlap or become inaccessible.

---

## 12. Apple-Inspired Premium Design Standards
To maintain a world-class, "Apple-level" feel, all UI changes MUST adhere to these premium design principles.

### A. The "Squircle" Standard (Continuous Curves)
Avoid simple geometric rounded corners (e.g., `12px`). Use the **Squircle** curvature for an organic, approachable feel.
- **Global Token**: `var(--radius-squircle)` (24px) for cards, modals, and layouts.
- **Button Token**: `var(--radius-button)` (12px) for interactive elements.
- **Rule**: Never use `4px` or `8px` for primary cards; they must be generous (`24px`).

### B. Materials & Layering (Glassmorphism)
Everything should feel like it has physical depth and realistic material properties.
- **Glass Finish**: Use `backdrop-filter: blur(var(--glass-blur))` (15px-20px) for headers, modals, and floating cards.
- **Shadows**: Use `var(--shadow-premium)` for soft, expansive depth. Elements should feel like they "float" above the midnight canvas.
- **Satin Accents**: Borders in dark mode should be extremely subtle (`rgba(255,255,255,0.08)`) to create a "satin" edge, not a harsh outline.

### C. Fluid Typography & Spacing
Designs must feel balanced regardless of screen size.
- **Proportional Scaling**: Always use `clamp()` for font sizes and padding.
- **Breathing Room**: Prioritize white space. If a layout feels cramped, increase the gap or padding using `clamp(1rem, 5vw, 3rem)`.
- **Weight Hierarchy**: Use `800` for titles, `600` for subtitles, and `400-500` for body text.

### D. Sophisticated Midnight Palette
Avoid aggressive saturations. Use colors functionally (to signify status), not structurally (as borders or backgrounds).
- **Core Environment**: Midnight Black (`#050505`) or Deep Space Gray (`#121214`).
- **Accent Palette**: Sophisticated Mint (`#70f3da`) and Electric Blue (`#60a5fa`).
- **Rule**: Use the mint/blue accents only for status, icons, or text highlights.

---

## 13. General Rules Summary (Updated)
| Rule | Policy |
|------|--------|
| Prohibited Colors | ❌ Hardcoded Hex, Neon/Aggressive Saturations |
| Corner Radius | ✅ `var(--radius-squircle)` (24px) for major cards |
| Action Buttons | ✅ `.halo-button` with `blur` and `shadow` |
| Spacing & Fonts | ✅ `clamp()` for fluid responsiveness |
| Depth | ✅ `backdrop-filter` and `shadow-premium` |
| Main Area Buttons | ❌ No solid fills. Use `.halo-button` (glass) or icon-only actions. |
| Layout Consistency| ✅ Must be tested at 1024px (11") and 1280px (13") |

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

