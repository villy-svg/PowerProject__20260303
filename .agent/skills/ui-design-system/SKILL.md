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

## 3. Badges & Tags (`.halo-type`)
Used for inline metadata chips on task tiles, sidebars, and tables.

### Halo-Type Badge
```css
/* Applied via: className="[specific-class] halo-type" */

.tile-hub-code.halo-type {
  background: color-mix(in srgb, var(--stage-color), transparent 90%);
  color: var(--stage-color);
  border: 1px solid color-mix(in srgb, var(--stage-color), transparent 70%);
  font-size: 0.7rem; font-weight: 800; padding: 3px 8px;
  border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px;
}

.tile-function-badge.halo-type {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-color);
  border: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 0.65rem; font-weight: 600; padding: 2px 8px;
  border-radius: 20px; text-transform: capitalize; opacity: 0.8;
}
```

### Table Tags (`.v-tag`)
Used in the User Management table to show vertical access.
```css
.v-tag {
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border-color);
  color: var(--text-color);
  border-radius: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase;
}
.v-tag.master { 
  background: rgba(16, 185, 129, 0.1); 
  border: 1px solid var(--brand-green);
  color: var(--brand-green);
}
```

**Rules**:
- Tags/badges use **semi-transparent backgrounds** — never solid fills unless specifically for a `master` or critical status.
- Do NOT introduce red/orange/blue/purple badge colors without explicit permission.
- `None` access level → gray (`#7f8c8d` tint). All active levels → brand-green tint.

---

## 4. Selected State (Buttons in Selector Groups)
For toggle/selector button groups (e.g., capability level selectors in modals):

```css
/* Default (unselected, enabled) */
.v-lvl-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border-color);
  color: var(--text-color); opacity: 0.5;
}

/* Hover */
.v-lvl-btn:hover { opacity: 1; background: rgba(255, 255, 255, 0.1); }

/* Selected (Active) — Halo pattern */
.v-lvl-btn.active {
  border: 2px solid var(--brand-green);
  background: rgba(16, 185, 129, 0.15);  /* Subtle tint, NOT solid fill */
  color: var(--brand-green); opacity: 1;
}

/* Selected "None" — Neutral gray halo */
.v-lvl-btn.active.lvl-none {
  border-color: #7f8c8d;
  background: rgba(127, 140, 141, 0.15);
  color: #7f8c8d;
}

/* Disabled (locked by permission ceiling) */
.v-lvl-btn:disabled { opacity: 0.3; cursor: not-allowed; }
```

**Rule**: Selected states use a **2px border + subtle tint** (halo style), NOT solid fills.

---

## 5. Modals
- **Overlay**: `position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);`
- **Body**: rounded corners (`border-radius: 12px`), border `1px solid var(--border-color)`, background `var(--bg-color)`.
- **Header**: label + `×` close button (`opacity: 0.5`, hover → `opacity: 1`).
- **Footer actions**: Cancel (transparent, outlined) + Confirm (`.halo-button`).

---

## 6. Typography
- **Font**: `'Inter', system-ui, sans-serif` (imported from Google Fonts).
- **Section labels**: `font-weight: 700`, `font-size: 14px`, `opacity: 0.8`.
- **Card titles**: `font-weight: 600–800`.
- **Micro-labels / badges**: `font-size: 0.65–0.75rem`, `font-weight: 700–800`, `text-transform: uppercase`, `letter-spacing: 0.5px`.

---

## 7. Stage/Priority Colors
Stage colors are always referenced via `var(--stage-color)` (passed as a CSS custom property on the element). This allows context-sensitive tinting without hardcoding.

Priority badge convention:
```css
.priority-urgent { color: #ef4444; }
.priority-high   { color: #f97316; }
.priority-medium { color: #eab308; }
.priority-low    { color: #22c55e; }
```
These are the ONLY allowed priority colors.

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

## 9. Standard Form Styling
All forms (Add/Edit wizards) MUST follow these class-based rules to ensure visual parity with the global Halo system. **Avoid inline styles for form inputs.**

### Container Classes
- **`.form-section`**: Groups related fields with consistent spacing.
- **`.form-grid`**: Usually a `display: grid` with `template-columns: 1fr 1fr` for side-by-side inputs.
- **`.form-group`**: Wraps a single label + input pair with `flex-direction: column` and `gap: 0.5rem`.

### Input & Select Styling
- **Background**: `var(--halo-bg)` — ensures the hallmark subtle teal/green tint.
- **Border**: `1px solid var(--border-color)`.
- **Text (Selects)**: `color: var(--brand-green)`, `font-weight: 600`.
- **Focus State**: `border-color: var(--brand-green)`, `box-shadow: 0 0 0 2px rgba(45, 212, 191, 0.2)`.

### View-Only Mode
- Apply `.view-only-mode` to the parent `<form>`.
- Inputs should have `cursor: not-allowed`, `opacity: 0.6`, and a darker `rgba(255, 255, 255, 0.02)` background.

**Rule**: New forms should mirror the implementation in `EmployeeForm.css` or `ClientForm.css`. Never use primitive `rgba(255,255,255,0.05)` for input backgrounds; always use `var(--halo-bg)`.

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

