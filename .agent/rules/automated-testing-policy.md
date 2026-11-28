# Automated Testing Policy (Vite + React)

This rule is **mandatory for all code changes** (new features, bug fixes, refactors, hooks, services, and UI components). Fast, automated Vite-native React testing is required before any code task is considered complete.

## 1. Standard Fast Stack
- **Runner:** **Vitest** (native to Vite — reuses `vite.config.js` transforms for near-instant execution). Always run in single-run non-watch mode (`npx vitest run` / `npm test`).
- **React Testing:** **React Testing Library** (`@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`) running on a lightweight DOM environment (`happy-dom` or `jsdom`).
- **Colocation ("Delete Test"):** Place test files directly alongside the code they test using `*.test.js` / `*.test.jsx` (or `.ts` / `.tsx`) naming.

## 2. Mandatory Testing Requirements
1. **New Features & Modules:** Every new component, custom hook, service, or utility MUST include automated Vitest + React Testing Library tests covering core behavior, loading/empty/error states, and edge cases.
2. **Bug Fixes:** Every bug fix MUST include a regression test that fails without the fix and passes with it.
3. **Edits & Refactors:** Modifying existing runtime code requires running and updating its colocated tests (or adding targeted tests for the modified behavior if none exist yet).
4. **RBAC & Guards:** Components with role/permission or seniority guards must test both authorized and unauthorized states.
5. **Exemptions:** Documentation-only (`.md`), copy-only, or purely cosmetic CSS-only edits with zero runtime logic changes do not require new test files.

## 3. Speed & Determinism Rules
- **Keep Tests Fast:** Individual test files should execute in milliseconds to a few seconds.
- **No Live Network or DB Calls:** Always mock Supabase clients, `fetch`, Capacitor native plugins, and external APIs (`vi.mock`). Use fake timers (`vi.useFakeTimers`) instead of real sleeps.
- **Targeted First:** During iteration, run only the affected test files (`npx vitest run path/to/file.test.jsx`); run the full fast suite before concluding shared-module or cross-cutting changes.
- **No Heavy Browser Automation for Unit/Component Checks:** Do not use Puppeteer/headless browsers where Vitest + React Testing Library can verify the behavior in-memory.

## 4. Non-Negotiable Gate
- All relevant tests MUST pass (`exit code 0`) before finalizing a response.
- Never use `.skip`, delete assertions, or weaken expectations to hide a failure.
- If the Vitest test runner is not yet configured in `package.json`, set it up (with user approval if installing packages) or explicitly report it as a blocker rather than silently skipping verification.

For patterns, templates, and troubleshooting, see `.agent/skills/automated-testing/SKILL.md`.
