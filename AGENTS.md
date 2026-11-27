# Mandatory Post-Edit Audit & Bug-Check Protocol

Whenever you create or edit **any** file in this workspace, you MUST complete all four steps below before concluding your response:

## 1. CSS Files (`.css`, `.scss`) — Post-Edit Audit
- Audit every touched stylesheet for **redundancies** (duplicate selectors, repeated declarations, overridden/dead rules) and **bloat** (overly specific selectors, unnecessary `!important`, hardcoded colors/spacing instead of design tokens, or rules already covered by shared/global classes).
- Refactor and remove any redundancies or bloat found.

## 2. JSX / TSX Files (`.jsx`, `.tsx`) — Post-Edit Audit
- Audit every touched file for **redundancies** (duplicate logic/markup, unused imports, unused variables/props, dead branches), **bloat** (unnecessary wrappers, overly verbose blocks), and **inline styling** (`style={{...}}` or inline style attributes).
- Eliminate inline styles by moving them to external CSS classes (per `.agent/rules/ui-design-system.md`) and trim redundancies/bloat.

## 3. All Other Files (`.js`, `.ts`, `.html`, `.sql`, `.json`, `.md`, configs, scripts, etc.) — Post-Edit Audit
- Audit every touched file for **redundancies** (duplicated logic, unused imports/exports/variables/helpers), **bloat** (dead code, unnecessary verbosity, redundant config), and **inline styling** (any inline `style="..."` attributes or embedded style strings where external CSS classes should be used).
- Clean up any issues found.

## 4. Final Bug-Hunt Iteration & Mistake Disclosure
- After completing all needful edits and the audits above, run **1 additional dedicated pass** across every file you touched specifically to catch **new bugs** (missing/broken imports, null/undefined access, prop/variable/column mismatches, hook ordering, async/error-handling gaps, broken CSS selectors/cascades, edge cases, or unintended regressions). Fix anything discovered.
- **Required Closing Clarification:** At the end of your response, explicitly clarify whether any mistakes were made while editing — listing what was caught and fixed during the audit/bug-hunt pass, or confirming that no mistakes were found.

For the detailed checklist, see `.agent/skills/post-edit-audit/SKILL.md`.
