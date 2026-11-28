# Post-Edit Audit & Bug-Check Policy

This rule is **mandatory on every run that creates or edits files**. No file-editing task is complete until all five steps below have been executed.

## 1. CSS Post-Edit Audit (Redundancies & Bloat)
- Inspect every modified `.css` / `.scss` file for duplicate selectors, repeated property declarations, dead/overridden rules, excessive selector specificity, unnecessary `!important`, and hardcoded values that duplicate design tokens or existing global/shared classes.
- Remove redundancies and bloat before finalizing.

## 2. JSX / TSX Post-Edit Audit (Redundancies, Bloat & Inline Styling)
- Inspect every modified `.jsx` / `.tsx` file for unused imports/variables/props, duplicated JSX or logic, unnecessary wrapper elements, and **inline styling** (`style={{...}}` or `style="..."`).
- Move any inline styles to external stylesheets using design system tokens and remove all redundancies and bloat.

## 3. Other Files Post-Edit Audit (Redundancies, Bloat & Inline Styling)
- Inspect every other modified file (`.js`, `.ts`, `.html`, `.sql`, `.json`, `.md`, scripts, configs, etc.) for duplicated logic, unused imports/exports/variables, dead code, unnecessary bloat, and any inline styling (`style="..."` or embedded style strings).
- Clean up any issues found.

## 4. Final Bug-Hunt Iteration & Mistake Clarification
- After finishing all needful edits and the audits above, run **1 extra iteration** reviewing every file touched to uncover **new bugs** introduced during the edit (syntax/runtime errors, missing imports, null/undefined crashes, prop/schema mismatches, async/await issues, broken styles, or regressions). Fix any bugs found.
- At the end of the response, explicitly state whether any mistakes were made during editing (detailing what was caught and corrected, or confirming none were found).

## 5. Fast Automated Vite + React Testing (Code Changes)
- Whenever runtime code (`.js`, `.jsx`, `.ts`, `.tsx`) is created or modified, write/update colocated **Vitest + React Testing Library** tests (`*.test.{js,jsx,ts,tsx}`) and run them in non-watch mode (`npx vitest run <path>` or `npx vitest run`).
- Keep tests fast and deterministic (mock Supabase, `fetch`, Capacitor plugins, and timers). All relevant tests MUST pass before concluding (see `.agent/rules/automated-testing-policy.md`). Docs-only, copy-only, or cosmetic CSS-only edits are exempt.
