---
name: post-edit-audit
description: MANDATORY post-edit audit, bug-hunt, and fast automated Vite + React testing workflow for EVERY file edit. Audits CSS for redundancies and bloat; audits JSX and all other files for redundancies, bloat, and inline styling; runs one final bug-hunting iteration over all touched files; runs fast Vitest + React Testing Library tests on code changes; and clarifies at the end whether any mistakes were made during editing.
---

# Post-Edit Audit & Final Bug-Hunt

## When to Use
- **Mandatory** after completing edits to **any** file in the workspace (CSS, JSX/TSX, JS/TS, HTML, SQL, JSON, Markdown, configs, scripts, etc.).
- Execute this workflow **before** declaring a task complete or sending the final response.

---

## Step 1: CSS Post-Edit Audit (`.css`, `.scss`)
For every stylesheet created or modified:
1. **Redundancies**: Check for duplicate selectors, repeated property declarations within or across blocks, overridden/dead rules, and styles already provided by global/shared utility or component classes.
2. **Bloat**: Check for overly deep/specific selectors, unnecessary `!important` overrides, unused newly added classes, and hardcoded colors/spacing/radii that should use design system CSS variables.
3. **Remediate**: Consolidate or remove redundant/bloated rules without breaking existing cascade or dynamic class names.

## Step 2: JSX / TSX Post-Edit Audit (`.jsx`, `.tsx`)
For every JSX/TSX file created or modified:
1. **Redundancies**: Check for unused imports, unused variables/state/props, duplicated markup or helper logic, and unreachable/dead branches.
2. **Bloat**: Check for unnecessary wrapper `<div>`/`<>` nodes, overly verbose inline expressions, or repeated blocks that should reuse existing components/helpers.
3. **Inline Styling**: Check for any `style={{...}}` props or inline `style` attributes. Move styling to external CSS classes using design system variables (per `.agent/rules/ui-design-system.md`).
4. **Remediate**: Clean up all findings before moving on.

## Step 3: Other Files Post-Edit Audit (`.js`, `.ts`, `.html`, `.sql`, `.json`, `.md`, etc.)
For every other file created or modified:
1. **Redundancies**: Check for duplicated logic, unused imports/exports/variables/parameters, and repeated definitions or instructions.
2. **Bloat**: Check for dead code, overly verbose blocks, redundant configuration entries, or leftover debug statements.
3. **Inline Styling**: Check for any inline `style="..."` attributes (e.g., in HTML, templates, or JS-generated markup) and move them to external CSS classes.
4. **Remediate**: Clean up all findings before moving on.

## Step 4: Final Bug-Hunt Iteration & Mistake Disclosure
After all needful edits and Steps 1–3 are complete:
1. **Run 1 More Bug-Finding Pass** over **every file touched** in the session, specifically looking for newly introduced bugs:
   - Missing or wrong imports / circular dependencies.
   - Null/undefined dereferences, unsafe destructuring, or `"0"` truthy-render bugs.
   - Prop name, variable name, or DB column (`camelCase` vs `snake_case`) mismatches.
   - Hook placement violations, stale closures, or missing `await` / `try-catch` blocks.
   - Broken CSS selectors, specificity regressions, or missing class names after removing inline styles.
   - Edge cases, off-by-one errors, or unintended regressions in sibling logic.
2. **Fix** any bugs found during this pass.
3. **Clarify at the End of Your Response**: Include a brief closing note stating whether any mistakes were made while editing:
   - If mistakes/issues were found during the audit or bug-hunt pass, briefly list what they were and confirm they were fixed.
   - If no mistakes were found, explicitly state that the post-edit audit and final bug-hunt pass found no mistakes.

## Step 5: Fast Automated Vite + React Testing (Code Changes)
For every edit touching runtime code (`.js`, `.jsx`, `.ts`, `.tsx`):
1. **Add / Update Colocated Tests**: Ensure colocated `*.test.{js,jsx,ts,tsx}` tests using **Vitest + React Testing Library** cover new behavior, bug-fix regressions, edge/empty/error states, and RBAC guards (see `.agent/skills/automated-testing/SKILL.md`).
2. **Run Fast Non-Watch Verification**: Execute targeted tests (`npx vitest run <path>`) — and the full fast suite (`npx vitest run`) for shared modules — with external services (Supabase, `fetch`, Capacitor, timers) mocked.
3. **Zero-Failure Gate**: Confirm 100% pass (`exit code 0`) and report the test command and result in the final response. (Docs-only `.md`, copy-only, and purely cosmetic CSS-only edits are exempt.)
