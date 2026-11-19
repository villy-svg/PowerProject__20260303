# Tutorial Rich Text Formatting, Alignment & Associated CSS Audit — PRD & TRD

**Status:** `Implemented`

**Date Created:** 2026-11-19
**Last Updated:** 2026-11-19
**Author / AI Session:** Antigravity session, Nov 2026

---

## Changelog

| Date | Status Change | Summary of Change |
|---|---|---|
| 2026-11-19 | Draft | Initial PRD/TRD created with full dependency mapping, persistence options, and CSS bloat/redundancy audit |
| 2026-11-19 | In Review | Expanded scope per user request to include simple text formatting (Bold, Italic, Underline, Strikethrough, Bullet & Numbered Lists) alongside Left/Center/Right alignment |
| 2026-11-19 | Approved | User approved: Option 1 (Markdown-lite toolbar + `<FormattedText />` + `metadata.slideAlignments`), Body text only alignment, and deletion of orphaned `CustomerVehicleRule` files |
| 2026-11-19 | Implemented | Implemented modular `<SlideTextToolbar />`, `<FormattedText />`, `tutorialUtils.js`, CSS bloat/redundancy cleanup, and deleted orphaned `CustomerVehicleRule` files; verified with ESLint and Vite production build |

---

## 0. Context & Objectives

### 0a. Core Objective
All tutorial slides in the onboarding viewer (`TutorialSlideshowViewer`) are currently hardcoded to center-aligned plain text, making multi-line bullet lists, numbered rules, and bilingual policies difficult to read and impossible to emphasize. Additionally, the tutorial stylesheet (`TutorialSlideshowViewer.css`) has accumulated duplicate global rules, hardcoded colors, and dead selectors that conflict with the PowerProject UI Design System. We will add a unified, modular **Text Formatting & Alignment Toolbar** (Left/Center/Right alignment + Bold, Italic, Underline, Strikethrough, Bullet List, Numbered List) to tutorial editing & creation modes, persist everything cleanly without breaking existing clients, and clean up the audited CSS bloat and redundancies.

### 0b. Success Metrics
- **Metric 1 (Functional — Alignment & Formatting):** Master Admins can set Left, Center, or Right alignment and apply **Bold**, *Italic*, Underline, ~~Strikethrough~~, Bullet List, and Numbered List formatting in `TutorialSlideshowViewer` edit mode and `TutorialFormModal` creation mode, with all formatting persisting across reloads for both DB-backed (`rule_*`) and static (`localStorage`) tutorials.
- **Metric 2 (Backward Compatibility & Safety):** All existing tutorials without an explicit alignment default seamlessly to `center` (zero visual regression); formatting renders via a pure XSS-safe React parser (zero `dangerouslySetInnerHTML`); and `EmployeeRulesBoard.jsx` renders formatted rule text cleanly without raw syntax leakage.
- **Metric 3 (RBAC & Viewport Compliance):** Non-admin roles (`Editor`, `Contributor`, `Viewer`) never see formatting/alignment controls or edit triggers; toolbar buttons meet ≥44px touch target requirements on mobile (`360px`–`768px`) and render cleanly on desktop (`1024px`–`1440px`).
- **Metric 4 (CSS Hygiene):** Eliminate all identified duplicate `.halo-button` overrides, dead CSS variables (`--stage-accent`), self-referencing `var(--text-color, var(--text-color))` fallbacks, and hardcoded `rgba()` colors in `TutorialSlideshowViewer.css`, with zero inline `style={{}}` added.

### 0c. Out of Scope
- ❌ Complex WYSIWYG blocks (embedded images inside text, tables, custom font families, arbitrary hex color pickers, or font-size sliders).
- ❌ Per-paragraph mixed alignment within a single slide (alignment applies at the slide level).
- ❌ Deleting `CustomerVehicleRule.jsx` / `CustomerVehicleRule.css` unless explicitly approved by the user during review (flagged in the audit as unused, kept safe per `safe-code-modification`).
- ❌ Changing `EmployeeRulesBoard.jsx` card alignment (rules board cards stay left-aligned, though inline Bold/Italic/Underline/Strikethrough will render cleanly).

---

## 1. Current State & Dependencies

### 1a. Technical Dependencies

| Type | Name | Path |
|---|---|---|
| Component | `TutorialSlideshowViewer` | `src/features/tutorials/TutorialSlideshowViewer.jsx` |
| Component | `TutorialHub` (exports `parseRuleSlides`) | `src/features/tutorials/TutorialHub.jsx` |
| Component | `TutorialFormModal` | `src/features/tutorials/TutorialFormModal.jsx` |
| Component (Orphaned) | `CustomerVehicleRule` | `src/features/tutorials/CustomerVehicleRule.jsx` |
| Stylesheet | `TutorialSlideshowViewer.css` | `src/features/tutorials/TutorialSlideshowViewer.css` |
| Stylesheet (Orphaned) | `CustomerVehicleRule.css` | `src/features/tutorials/CustomerVehicleRule.css` |
| Global Stylesheet | `globalTheme.css` (`.u-text-left`, `.u-text-center`, `.u-text-right`, `.halo-button.btn-icon`) | `src/styles/globalTheme.css` |
| Shared Icons | `Icons.jsx` (needs alignment icons added) | `src/components/ui/Icons.jsx` |
| Service | `rulesService.js` (`fetchRules`, `createRule`, `updateRule`, `deleteRule`) | `src/services/employees/rulesService.js` |
| Consumer (App Boot) | `App.jsx` (auto-plays onboarding & special rule tutorials via `parseRuleSlides` + `TutorialSlideshowViewer`) | `src/App.jsx` |
| Consumer (Attendance) | `AttendanceSelfService.jsx` (renders mandatory No-Cash slide via `TutorialSlideshowViewer`) | `src/verticals/Employees/attendance/AttendanceSelfService.jsx` |
| Consumer (Rules Board) | `EmployeeRulesBoard.jsx` & `RuleFormModal.jsx` (read/write same `employee_rules` table) | `src/verticals/Employees/EmployeeRulesBoard.jsx`, `src/verticals/Employees/RuleFormModal.jsx` |
| Route | `ContentRouter.jsx` (`activeVertical === 'tutorials'`) | `src/app/shells/ContentRouter.jsx` |

**Conflict Detection Result (`docs/features/README.md`):** No `Draft`, `In Review`, or `Approved` feature touches `employee_rules` or any `src/features/tutorials/*` file. No conflict.

### 1b. Product Dependencies (Current User Flow)

**Current flow:**
1. User navigates to **System Tutorials** (`TutorialHub`) or receives an auto-played onboarding/special-rule slide via `App.jsx` or `AttendanceSelfService.jsx`.
2. Master Admin clicks **+ Add Tutorial** (`TutorialFormModal`) to create a new DB-backed tutorial (title, description, category, Page 1 content), or clicks **Edit** (`IconEdit`) on a card to edit metadata.
3. Master Admin opens any tutorial in `TutorialSlideshowViewer` and clicks the **Edit Page** (`IconEdit`) or **Add Page** (`IconPlus`) icon button to edit slide title and text inline.
4. In `onboarding` layout (`.onboarding-content-body`), `text-align: center` and `align-items: center` force all slide titles and body paragraphs to center-align.

**Pain point / gap:**
- There is no control to align slide text to Left, Center, or Right in either `TutorialSlideshowViewer` edit mode or `TutorialFormModal`.
- Multi-line numbered policies (e.g., English + Kannada rule lists) look ragged when forced to center alignment.
- `TutorialSlideshowViewer.css` (962 lines) has accumulated redundant overrides of `globalTheme.css`, hardcoded dark-mode `rgba()` colors, and conflicting rules (`white-space: pre-line` vs `u-whitespace-prewrap`).

### 1c. Logical Dependencies (Current Business Rules)

- **Rule 1:** Only Master Admins (`user?.roleId === 'master_admin' || permissions?.canManageRoles`) can create, edit, or delete tutorials and slides.
- **Rule 2:** DB-backed tutorials (`flow.id.startsWith('rule_')`) persist slide content in `employee_rules.content` separated by the explicit delimiter `\n---PAGE_BREAK---\n` (with optional `### Slide Title` prefix on pages > 0).
- **Rule 3:** Static built-in tutorials (`introTutorial`, etc.) persist edits in `localStorage` under `powerpod_tutorial_override_array_${flow.id}` (full slide array JSON).
- **Rule 4:** `EmployeeRulesBoard.jsx` reads the same `employee_rules` rows and strips `---PAGE_BREAK---` and `### ` for plain card rendering.
- **Rule 5:** `App.jsx` auto-plays special rules using `parseRuleSlides(rule.title, rule.content || '')` with `onlyFirstSlide={true}` — any persisted alignment MUST also be hydrated in `App.jsx` so login-time slides match `TutorialHub`.

### 1d. Data & State Dependencies

| Table / View | Relevant Columns | Relationships |
|---|---|---|
| `employee_rules` | `id`, `title`, `content`, `impact`, `category_id`, `metadata` (`Json \| null`), `is_active`, `sort_order` | `category_id → rule_categories.id`, `sub_category_id → rule_sub_categories.id`, `created_by → user_profiles.id` |
| `rule_categories` | `id`, `name`, `icon`, `sort_order` | Referenced by `employee_rules.category_id` |

**Client-side state (React):**
- [x] `useState` in `TutorialSlideshowViewer.jsx` (`editableSlides`, `editTitle`, `editText`, `isEditing`, `saving`, + new `editAlign`)
- [x] `useState` in `TutorialFormModal.jsx` (`form`, + new `text_align`)
- [x] `@tanstack/react-query` in `TutorialHub.jsx` (`queryKey: ['employee_rules', { activeOnly: true }]`)
- [x] `localStorage` overrides in `TutorialHub.jsx` / `TutorialSlideshowViewer.jsx` (`powerpod_tutorial_override_array_${flow.id}`)

### 1e. Security & Access (RBAC)

| Operation | Admin (Master Admin) | Editor | Contributor | Viewer |
|---|---|---|---|---|
| READ tutorials & alignment | ✅ | ✅ | ✅ | ✅ |
| CREATE tutorial / set alignment | ✅ | ❌ | ❌ | ❌ |
| UPDATE slide text / alignment | ✅ | ❌ | ❌ | ❌ |
| DELETE tutorial / slide | ✅ | ❌ | ❌ | ❌ |

**Sphere of Influence applies?** No — Tutorials and `employee_rules` are organization-wide instructional content visible to all authenticated users, writable only by Master Admins (`user?.roleId === 'master_admin' || permissions?.canManageRoles`).

**RLS policy function used:** Existing `employee_rules` RLS policies (unchanged).
**Vertical(s) affected:** `tutorials` (`TutorialHub`), `App.jsx` (global onboarding), `AttendanceSelfService.jsx` (shared viewer).

---

## 2. Proposed Options & Strategy

### 2a. Technical Options (Alignment Persistence)

**Option A — Store per-slide alignment in existing `employee_rules.metadata` JSONB column (No DB Migration)**
- **Approach:**
  - For DB-backed `rule_*` tutorials: store `metadata: { ...(existingMetadata || {}), slideAlignments: ['left', 'center', ...] }` on `employee_rules` via existing `createRule` / `updateRule` calls in `rulesService.js` (also works automatically with `VITE_OFFLINE_BYPASS`).
  - Hydrate `textAlign: rule.metadata?.slideAlignments?.[idx] || 'center'` in a shared helper (e.g., `buildRuleFlow(rule)` used by both `TutorialHub.jsx` and `App.jsx` — eliminating the current duplicated rule-to-flow mapping!).
  - For static tutorials (`introTutorial`, etc.): store `textAlign` directly on each slide object in `powerpod_tutorial_override_array_${flow.id}` (`localStorage`).
- **Pros:**
  - Zero database migration needed (`employee_rules.metadata` already exists as `Json | null` in `db_types.ts:859`).
  - Zero leakage into `employee_rules.content` — `EmployeeRulesBoard.jsx`, search, and older Capacitor OTA app versions remain 100% unaffected.
  - Per-slide granularity (e.g., Slide 1 centered intro, Slide 2 left-aligned numbered rules).
- **Cons:**
  - If an admin manually inserts/deletes `---PAGE_BREAK---` inside `RuleFormModal.jsx` (outside the tutorial viewer), array indices in `slideAlignments` could shift (gracefully falls back to `'center'`).
- **Complexity:** Low
- **Estimated effort:** ~1.5–2 hours (including modular `<TextAlignSelector />` + CSS audit cleanup).

**Option B — Embed inline alignment marker inside `employee_rules.content` (e.g., `<!-- align:left -->`)**
- **Approach:** Prepend a marker token to each page inside `content` and parse/strip it inside `parseRuleSlides()` and `EmployeeRulesBoard.jsx`.
- **Pros:** Alignment travels inline with page text even if edited raw in `RuleFormModal.jsx`.
- **Cons:** Pollutes `content`; breaks older Capacitor mobile builds (stale OTA clients would render literal `<!-- align:left -->` text on screen); requires updating `EmployeeRulesBoard.jsx` and `RuleFormModal.jsx` to strip markers.
- **Complexity:** Medium
- **Estimated effort:** ~2–3 hours + OTA backward-compatibility hazard.

**Option C — Add a dedicated `text_align` column on `employee_rules` via Supabase migration**
- **Approach:** Add `text_align TEXT DEFAULT 'center'` or JSONB column via staging migration.
- **Pros:** Dedicated schema column.
- **Cons:** Redundant with existing `metadata` JSONB column; requires staging-first migration and schema parity overhead for a simple UI presentation preference.
- **Complexity:** Medium
- **Estimated effort:** ~3 hours.

**Recommended:** **Option A** — Reuses the existing `employee_rules.metadata` JSONB column with zero migration risk, zero OTA breakage, and clean separation from `EmployeeRulesBoard.jsx`.

#### Inline Text Formatting Architecture (Bold, Italic, Underline, Strikethrough, Lists)

**Formatting Option 1 (Recommended) — Zero-Dependency Markdown-Lite Toolbar + Safe React AST Renderer (`<FormattedText />`)**
- **Approach:**
  - Keep native `<textarea>` inputs (100% reliable on Capacitor Android/iOS WebViews and Indic/Kannada IMEs).
  - Build a single modular `<SlideTextToolbar />` component that operates on the textarea `ref`:
    - **Inline styles** (wraps selected text or inserts placeholder + restores cursor selection; supports `Ctrl/Cmd+B`, `Ctrl/Cmd+I`, `Ctrl/Cmd+U`):
      - **Bold:** `**text**` → `<strong>`
      - **Italic:** `*text*` → `<em>`
      - **Underline:** `__text__` → `<u>`
      - **Strikethrough:** `~~text~~` → `<s>`
    - **List helpers** (prefixes selected line(s)):
      - **Bullet list:** `• `
      - **Numbered list:** `1. ` (auto-incrementing across selected lines)
    - **Alignment** (per-slide, stored in `metadata.slideAlignments` / `slide.textAlign`):
      - **Left** / **Center** / **Right**
  - Build a pure, **100% XSS-safe React component** `<FormattedText text={...} />` (zero `dangerouslySetInnerHTML`) that parses `**bold**`, `*italic*`, `__underline__`, and `~~strike~~` into React elements while preserving newlines.
  - Render `<FormattedText />` in `TutorialSlideshowViewer.jsx` (view mode + optional live preview toggle in edit mode) and `EmployeeRulesBoard.jsx` so rules cards also display bold/italic/underline cleanly.
- **Pros:** Zero new npm packages (0 KB dependency bloat); 100% XSS-safe; rock-solid on mobile WebViews & Kannada IMEs; older Capacitor OTA versions still show human-readable text rather than raw HTML tags.
- **Cons:** While typing inside the `<textarea>`, the admin sees lightweight markers (`**bold**`, `__underline__`) rather than live WYSIWYG (mitigated by a 1-click Preview toggle or instant save feedback).
- **Complexity:** Low–Medium

**Formatting Option 2 — `contentEditable` WYSIWYG + Sanitized HTML (`DOMPurify`)**
- **Approach:** Replace `<textarea>` with `contentEditable`, save HTML (`<b>`, `<i>`, `<u>`, `<s>`, `<ul>`) into `employee_rules.content`, sanitize with `dompurify`, and render via `dangerouslySetInnerHTML`.
- **Pros:** True in-place WYSIWYG while typing.
- **Cons:** Requires installing `dompurify`; `contentEditable` has notorious mobile WebView & Indic IME cursor bugs in Capacitor; breaks older OTA mobile apps (which would render raw `<b>...</b>` tags as text); complicates `---PAGE_BREAK---` splitting.
- **Complexity:** High

**Recommended:** **Formatting Option 1** — Zero dependencies, XSS-safe, Capacitor/Kannada-IME safe, and backward-compatible with older OTA clients.

---

### 2b. Product Options (UI/UX)

**Modular Control: `<SlideTextToolbar />` (Unified Formatting + Alignment Bar)**
- A single compact toolbar row placed directly above the slide content `<textarea>` in:
  1. **`TutorialSlideshowViewer.jsx` Edit Mode** (both `onboarding` and screenshot modal layouts)
  2. **`TutorialFormModal.jsx`** (Create New Tutorial — Page 1 Slide Content)
- Grouped cleanly with a subtle vertical divider (`1px solid var(--border-color)`):
  - **Group 1 — Alignment:** `[Left] [Center] [Right]` (segmented halo active state)
  - **Group 2 — Inline Style:** `[B] [I] [U] [S]` (Bold, Italic, Underline, Strikethrough)
  - **Group 3 — Lists:** `[• List] [1. List]`
  - *(Optional)* **Preview toggle** (`Eye` icon) to preview rendered formatting + alignment before clicking Save.

**Design Question — Alignment Target Scope:**
- **UX Option 1 (Body + Title together):** Choosing Left / Center / Right aligns both the slide heading (`onboarding-title` / `slideshow-editor__label`) and the slide body (`onboarding-text` / `slideshow-caption-text`).
- **UX Option 2 (Body text only; Title stays centered in onboarding):** Choosing Left / Center / Right aligns only the body paragraph (`onboarding-text` / `slideshow-caption-text`), keeping the slide title centered above it.

**Desktop View (DesktopLayout — ≥1024px):**
- Compact segmented control (`height: 32px`, `min-width: 34px` per button) tucked cleanly above the text input or in the edit toolbar, with tooltip labels (`Align Left`, `Align Center`, `Align Right`).

**Mobile View (MobileLayout — <1024px):**
- Inside `@media screen and (max-width: 768px)`, each alignment button expands to `min-height: 44px; min-width: 44px;` to comply with the Apple HIG / Material Design 3 touch-target rule (`ui-design-system` §14B), with zero desktop impact (`§14G`).

**Entry point to this feature:**
- System Tutorials (`activeVertical === 'tutorials'`) → Open any tutorial → Click Edit (`IconEdit`) or Add Page (`IconPlus`), OR click **+ Add Tutorial** in `TutorialHub` header.

---

### 2c. Logical Options (Business Rule Implementation)

**Option A — Frontend normalization + defensive fallback (`['left', 'center', 'right'].includes(val) ? val : 'center'`)**
- **How it works:** Pure utility helper `normalizeTextAlign(val)` validates alignment values on both read and write, always defaulting to `'center'` for `onboarding` (and `'left'` or `'center'` for screenshot captions).
- **Security:** Write access remains gated by existing Master Admin UI check + Supabase RLS on `employee_rules`.
- **Risk:** Negligible — even corrupted JSON in `metadata` falls back cleanly to `'center'`.

**Option B — Postgres CHECK constraint / trigger validating `metadata->'slideAlignments'`**
- **How it works:** Database trigger rejects invalid alignment strings inside `metadata`.
- **Security:** Enforced at DB layer.
- **Risk:** Over-engineered for a non-sensitive UI alignment token; requires a migration.

**Recommended:** **Option A** — Alignment is a presentation preference; defensive frontend normalization with `'center'` fallback is safe, zero-migration, and resilient to malformed data.

---

### 2d. Trade-offs (Cost vs. Benefit)

| Dimension | Recommended (Option A: `metadata` JSONB) | Alternative (Option B: Inline content marker) |
|---|---|---|
| Security | ✅ Uses existing `employee_rules` RLS | ✅ Uses existing `employee_rules` RLS |
| Speed to ship | ✅ Zero DB migration | ✅ Zero DB migration |
| OTA Backward Compat | ✅ Stale mobile apps ignore `metadata` safely | ❌ Stale mobile apps render raw marker text |
| Reversibility | ✅ Instant frontend revert | ⚠️ Requires stripping markers from DB rows |
| Maintenance burden | ✅ Shared `buildRuleFlow()` helper | ⚠️ Must strip markers in every `content` consumer |

---

### 2e. Rollout & Backward Compatibility

- **Feature flag required?** No — strictly additive UI control visible only to Master Admins, with default `'center'` preserving existing visuals 100%.
- **Database migration required?** No — uses existing `employee_rules.metadata` (`Json | null`) column.
- **Mobile app (Capacitor) impact:**
  - Does this break older cached app versions? **No** — older apps simply ignore `rule.metadata.slideAlignments` and continue rendering center-aligned text.
  - OTA push required after deployment? Standard OTA push will deliver the new alignment rendering and editor control to mobile devices.
- **Impact on existing users:** Existing tutorials continue to render center-aligned until a Master Admin explicitly changes a slide's alignment.

---

## 2f. Associated Files CSS Bloat & Redundancy Audit

A full audit of `src/features/tutorials/TutorialSlideshowViewer.css` (962 lines), `src/features/tutorials/CustomerVehicleRule.css` (168 lines), and their JSX consumers revealed the following concrete issues:

| # | Severity | Location | Finding | Proposed Action |
|---|---|---|---|---|
| 1 | High | `TutorialSlideshowViewer.css:946-955` | **Exact duplicate of `globalTheme.css:1073-1081`** (`.halo-button.btn-icon`). Local copy adds `padding: 0.35rem 0.5rem` on a `32x32` box. | Remove duplicate from `TutorialSlideshowViewer.css`; inherit from `globalTheme.css`. |
| 2 | High | `TutorialSlideshowViewer.css:371, 383, 388, 425, 434, 557, 803` | **Hardcoded `rgba(...)` colors** (`rgba(18, 18, 20, 0.85)`, `rgba(45, 212, 191, 0.4)`, `rgba(255, 255, 255, 0.4)`) — violates `ui-design-system` §1/§8 and breaks Light Mode. | Replace with CSS variables (`var(--bg-color)`, `var(--halo-glow)`, `color-mix(in srgb, ...)`). |
| 3 | Medium | `TutorialSlideshowViewer.css:806-825` | **Redundant `.halo-button.onboarding-next-btn`** re-declares base `.halo-button` and `:hover` properties (`background`, `color`, `font-weight`, `border`, `border-radius`, `transition`) already in `globalTheme.css:192-219`. | Slim down to only the overrides specific to onboarding (`width: 100%`, `font-size: 1rem`, `padding: 12px`). |
| 4 | Medium | `TutorialSlideshowViewer.css:538-540, 807` | **Dead CSS variable `--stage-accent`** (never referenced anywhere in the codebase) and dead `.next-action-btn` rule block. | Remove `.next-action-btn` rule and `--stage-accent` declaration. |
| 5 | Medium | `TutorialSlideshowViewer.css:892, 910, 925` | **Self-referencing variable fallback** `color: var(--text-color, var(--text-color));`. | Simplify to `color: var(--text-color);`. |
| 6 | Medium | `TutorialSlideshowViewer.css:886-919` | **Duplicated editor field styles** between `.slideshow-editor__input` and `.slideshow-editor__textarea` (8 identical properties repeated). | Merge shared base properties into `.slideshow-editor__input, .slideshow-editor__textarea` and keep only divergent rules separate. |
| 7 | Medium | `TutorialSlideshowViewer.css:774` vs `TutorialSlideshowViewer.jsx:270` | **Conflicting `white-space`**: CSS sets `.onboarding-text { white-space: pre-line; }` while JSX applies `.u-whitespace-prewrap` (`white-space: pre-wrap`). Also `.onboarding-title` and `.onboarding-text` lack `width: 100%`, which would break left/right alignment inside `align-items: center` flex parent! | Standardize on `white-space: pre-wrap` in `.onboarding-text`, add `width: 100%` to `.onboarding-title` and `.onboarding-text`, and remove redundant `u-whitespace-prewrap` class if consolidated. |
| 8 | Low | `TutorialSlideshowViewer.css:752-755` | **Redundant `.onboarding-image.logo-image`** repeats `max-width: 100%; max-height: 100%;` already set on `.onboarding-image` (lines 739-741). | Remove dead duplicate block. |
| 9 | Low | `TutorialSlideshowViewer.css:827-843` | **Inverted `@media (max-height: 700px)` rule** increases `.onboarding-image-container` `max-width` from `160px` → `200px` and `margin-bottom` from `12px` → `20px` on *shorter* screens (stale legacy values). | Fix to actually compact spacing on short screens (e.g., `height: 90px; margin-bottom: 8px;`) or remove conflicting bloat. |
| 10 | Low | `TutorialSlideshowViewer.css:68, 149, 192, 272, 409, 506, 702, 758, 773` | **Repeated `font-family: 'Inter', system-ui, sans-serif;`** across 9 selectors even though root `body` already inherits it. | Remove redundant `font-family` declarations (keep `'JetBrains Mono'` where monospace is intentional). |
| 11 | Info | `src/features/tutorials/CustomerVehicleRule.jsx` & `.css` | **Orphaned component & stylesheet** (168 lines CSS) — not imported anywhere in `src/`. | **Do NOT delete without explicit user approval** (per `safe-code-modification` §1A). Leave untouched unless user asks to remove. |

---

## 3. Risks, Mitigation & Verification

### 3a. Technical Risks

| Risk | Impact | Mitigation |
|---|---|---|
| `.onboarding-content-body` uses `align-items: center`, causing short lines inside `h2`/`p` to remain visually centered even with `text-align: left/right` | Left/Right alignment appears broken on short text | Ensure `.onboarding-title` and `.onboarding-text` have `width: 100%` so `text-align` spans the full content box width. |
| `App.jsx` constructs `rule_*` flows separately from `TutorialHub.jsx` | Auto-played login tutorials ignore saved alignment | Extract a shared `buildRuleFlow(rule)` helper in `src/features/tutorials/tutorialUtils.js` (or `TutorialHub.jsx`) and use it in both `TutorialHub.jsx` and `App.jsx`. |
| Updating `employee_rules.metadata` overwrites future/existing keys in `metadata` | Accidental metadata loss | Always merge `{ ...(flow.metadata || {}), slideAlignments }` when saving. |
| CSS cleanup alters visual appearance of `.onboarding-next-btn` or `.annotation-thought-bubble` | Subtle visual regression in Light/Dark mode | Verify both Light and Dark themes and desktop/mobile viewports after cleanup. |

### 3b. Product Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Existing tutorials shift alignment unexpectedly | Visual regression for all users | Default alignment is explicitly `'center'` when `textAlign` is unset. |
| Mobile edit buttons are too small to tap | Frustrating mobile admin UX | Enforce `min-height: 44px; min-width: 44px` inside `@media (max-width: 768px)`. |

### 3c. Logical Risks (Edge Cases)

| Edge Case | What Goes Wrong | How We Handle It |
|---|---|---|
| Admin adds a new slide via `+` button | New slide has no alignment set | Initialize new slide with `textAlign: 'center'` (or inherit previous slide's alignment; default `'center'`). |
| Admin deletes a slide from the middle of a multi-page rule | `slideAlignments` array indices shift out of sync | Always regenerate `slideAlignments = slidesToSave.map(s => normalizeTextAlign(s.textAlign))` on every save/delete. |
| Static tutorial edited previously in `localStorage` without `textAlign` | `slide.textAlign` is `undefined` | Fallback to `'center'` (onboarding) / `'left'` (screenshot modal) via `normalizeTextAlign()`. |
| `VITE_OFFLINE_BYPASS=true` local dev mode | `rulesService.js` updates localStorage cache | `updateRule` / `createRule` already spreads `...data`, so `metadata` persists identically offline and online. |

### 3d. Testing Plan

**Pre-deployment checklist:**

```
[ ] TEST 1 — Master Admin sets Left / Center / Right alignment in TutorialSlideshowViewer (DB-backed rule)
    Persona: Master Admin
    Action: Open a DB-backed tutorial → Click Edit → Select Left → Save → Reload page & reopen tutorial
    Expected: Slide text renders left-aligned both during edit preview and after reload.

[ ] TEST 2 — Master Admin sets alignment on a Static Tutorial (introTutorial)
    Persona: Master Admin
    Action: Open "Introduction to PowerProject" → Edit Slide 2 → Select Right → Save → Reload
    Expected: Slide 2 renders right-aligned from localStorage override; Slide 1 remains center-aligned.

[ ] TEST 3 — Create New Tutorial with alignment in TutorialFormModal
    Persona: Master Admin
    Action: Click "+ Add Tutorial" → Fill fields → Select Left alignment → Create → Open tutorial
    Expected: Page 1 renders left-aligned immediately.

[ ] TEST 4 — Non-admin RBAC check
    Persona: Viewer / Contributor / Editor
    Action: Open TutorialHub and open a tutorial slideshow
    Expected: No Edit/Add/Delete buttons and no Alignment selector rendered; saved alignment is still respected in view mode.

[ ] TEST 5 — EmployeeRulesBoard integrity
    Persona: Any user
    Action: Navigate to Employees → Rules & Regulations after editing a tutorial's alignment
    Expected: Rule card displays clean text with zero raw markup or metadata artifacts.

[ ] TEST 6 — Mobile & Desktop viewports + Light/Dark mode
    Action: Inspect TutorialHub & TutorialSlideshowViewer at 375px, 768px, 1280px, 1440px in both Light and Dark mode
    Expected: No horizontal overflow, ≥44px mobile touch targets, thought bubbles and buttons remain legible in both themes.
```

### 3e. Rollback & Reversibility

**Is this change reversible without data loss?** ✅ Yes

**Rollback procedure:**
Frontend-only change (zero DB migrations):
1. Revert the commit.
2. Trigger an OTA push via Capacitor.
3. Any `slideAlignments` entries written to `employee_rules.metadata` are harmlessly ignored by the reverted frontend.

---

## Implementation Notes

**Status at implementation:** `Implemented` (2026-11-19)

**Deviations from plan:**
- Moved textarea formatting helpers (`applyWrapFormat`, `applyLinePrefix`, `handleFormattingKeyDown`) from `SlideTextToolbar.jsx` into `tutorialUtils.js` so `SlideTextToolbar.jsx` exports only a React component (satisfying `react-refresh/only-export-components`).
- Fixed a pre-existing `react-hooks/rules-of-hooks` violation in `TutorialSlideshowViewer.jsx` where the countdown `useEffect` was placed below `if (!currentSlide) return null;`.

**Final migration name(s):** None (uses existing `employee_rules.metadata` JSONB column)

**Unexpected discoveries:**
- Confirmed `TutorialSlideshowViewer.css` had a full duplicate of `.halo-button.btn-icon` from `globalTheme.css`, an inverted `@media (max-height: 700px)` rule, and 7 hardcoded `rgba()` colors — all resolved.

**Follow-up items / future iterations:**
- None required.
