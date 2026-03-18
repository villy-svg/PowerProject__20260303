---
name: Master Page Header System
description: Rules for standardizing top-level management page headers. Ensures consistent placement of titles, descriptions, view toggles (snap left), and action buttons (snap right). 
---

# Master Page Header System

## 1. Component Structure (`MasterPageHeader.jsx`)
All management pages MUST use the `MasterPageHeader` component for their top section.

### Props Definition
- **title**: Main page title (e.g., "Hub Management").
- **description**: Concise summary of what the user can do on this page.
- **leftActions**: Snapped to the LEFT. Used for view toggles (Grid/List) and primary filter chips.
- **rightActions**: Snapped to the RIGHT. Used for CRUD actions (Add New), Import, and Export buttons.

---

## 2. View Mode Toggles (Grid vs List)
The standardized "View Toggle" allows users to switch between a visual card grid and a dense data table.

### Implementation Pattern
```jsx
const [viewMode, setViewMode] = useState('grid');

// In MasterPageHeader leftActions:
<div className="view-mode-toggle">
  <button 
    className={`view-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
    onClick={() => setViewMode('grid')}
  >
    Grid
  </button>
  <button 
    className={`view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
    onClick={() => setViewMode('list')}
  >
    List
  </button>
</div>
```

---

## 3. Alignment Rules
- **Snap Left**: The `leftActions` block must be the first element in Row 3. This is reserved for "How I see the data" tools.
- **Snap Right**: The `rightActions` block is for "What I do to the data" tools.
- **Spacing**: Row 3 should use `justify-content: space-between` to force the two blocks to the edges.

---

## 4. Header Styling (Halo Integration)
All buttons in the header MUST follow the **PowerProject UI Design System** skill.

### Toggle Specific Styles
Selected states use a **solid brand-green fill + dark text** to match the `TaskController` implementation:

```css
/* Selected (Active) — Solid Brand Green */
.view-toggle-btn.active {
  background: var(--brand-green);
  color: #000;
  opacity: 1;
}
```

**Rule**: The `view-mode-toggle` container MUST use `var(--halo-bg)` and an `8px` gap.

---

## 5. Sub-sidebar Synergy
On pages where a sub-sidebar exists (e.g., Hub Tasks), the sub-sidebar handles **Filters** while the header handles **View/Actions**.
- For simpler management pages (Departments, Roles), keep filters in the header `leftActions` if needed, or omit them for simplicity.
