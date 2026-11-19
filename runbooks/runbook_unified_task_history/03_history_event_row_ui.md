# Runbook 3: Presentational History Event Row UI & Scoped CSS

**Impact:** Zero (new unmounted component + additive CSS classes)  
**Target Files:**
- `src/components/tasks/TaskHistoryEventRow.jsx` (new)
- `src/components/tasks/SubmissionHistory.css` (additive classes only — no edits to existing rules)

---

## 1. Objective
Build the lightweight, presentational timeline row component for `kind === 'history'` events and the accompanying CSS styles (filter pills, compact history row, diff drawer, date dividers) adhering strictly to PowerProject's UI Design System (`--brand-mint`, glassmorphism tokens, zero hardcoded hex colors, mobile-friendly touch targets).

---

## 2. Exact Logic & Design to Build

### 2.1 Visual Hierarchy (Submissions vs. Activity Events)
Proof-of-work submissions are actionable (attachments + Approve/Reject), while task edits are informational.
- **Submission node (`kind === 'submission'`):** Keeps the existing full-size colored `.status-node` (`pending`/`approved`/`rejected`) and rich expandable card.
- **History node (`kind === 'history'`):** Uses a smaller, subtler timeline dot (`.history-node`, e.g., 8px muted ring/dot, with subtle semantic accent variants: `created`, `stage`, `link`, `edit`, `delete`) aligned on the exact same vertical `.timeline-line` rail.

### 2.2 `TaskHistoryEventRow.jsx` Props & Behavior
```js
// Pure presentational component — no Supabase calls
const TaskHistoryEventRow = ({
  item,         // UnifiedTimelineItem (kind === 'history')
  isExpanded,   // boolean
  onToggle,     // () => void
  isLast,       // boolean (hides trailing .timeline-line)
  formatDate,   // (isoString) => string
}) => { ... }
```
- **Collapsed State (Default):**
  - Single compact row: `[Actor Name] [Summary sentence] · [DD MMM YYYY, HH:MM]`
  - If `item.data.changes.length > 0` (expandable detail exists, e.g., multi-field edit or description diff), show a subtle chevron indicator and make the row clickable (`role="button"`, keyboard accessible with `Enter`/`Space`).
  - If there is no extra detail beyond the one-line summary (e.g., simple `LINK_ADD`), do **not** make it clickable (avoids "dead clicks" that open an empty drawer).
- **Expanded State (for multi-field edits, description changes, or `INSERT` snapshot):**
  - Clean 2-column or stacked `Field: Old → New` diff list.
  - Strikethrough / muted styling on `Old`, crisp primary text on `New`.

### 2.3 Filter Pills & Optional Date Separators (CSS Only in Runbook 3)
Add additive CSS classes to `SubmissionHistory.css`:
- `.timeline-filter-bar` + `.timeline-filter-pill` (with `.active` state using existing `--brand-mint` / `color-mix` tokens matching `.submission-count-badge`).
- `.timeline-date-divider` (subtle sticky/inline date label like `19 Nov 2026` separating days).
- `.history-event-row`, `.history-event-diff`, `.history-diff-old`, `.history-diff-new`.
- Responsive `@media (max-width: 640px)` rules so long timestamps and actor names stack cleanly on mobile without horizontal overflow.

---

## 3. Corner Cases & Potential Bugs
1. **Timeline rail misalignment:** `.submission-item` uses `width: 12px` for `.timeline-marker` and `gap: 1.5rem`. If `.history-node` is smaller (e.g., `8px`), it MUST stay horizontally centered inside the same `12px` `.timeline-marker` column so the vertical `.timeline-line` never zig-zags between submission items and history items.
2. **Dark Mode & Light Mode contrast:** Hardcoding hex colors (like `#666` or `#f5f5f5`) breaks theme switching. Strictly use CSS custom properties (`var(--text-primary)`, `var(--text-secondary)`, `var(--border-color)`, `var(--brand-mint)`, `color-mix(...)`).
3. **Long titles / descriptions / hub names on narrow mobile modals:** Use `min-width: 0`, `overflow-wrap: anywhere`, and `flex-wrap: wrap` on summary rows so a long task title or file name never pushes the timestamp off-screen.
4. **Click bubbling inside forms:** `SubmissionHistory` is rendered inside `<form>` elements in `HubTaskForm.jsx` and `EmployeeRemarkForm.jsx`. Any interactive toggle button MUST have `type="button"` so clicking to expand a history diff never accidentally submits the parent task form!
5. **Rapid mobile taps:** Ensure filter pills and expandable rows have comfortable tap targets (`min-height: 32px`–`36px`) and clean `:focus-visible` outlines.

---

## 4. Potential Future Needs
- **Avatar support:** Reserve a clean slot in the row header so user initials/avatars can be added later without changing the layout structure.
- **Badge-style stage pills in diffs:** Rendering `TODO → REVIEW` using the app's existing stage badge classes makes status transitions scannable at a glance.
- **Admin-only technical metadata drawer:** If master admins later want to inspect raw JSON or `client_info` (IP/User-Agent) for forensic auditing, `TaskHistoryEventRow` can accept an optional `showAuditMeta` prop without altering the standard user view.
