---
name: automated-testing
description: MANDATORY fast automated Vite + React testing workflow using Vitest and React Testing Library. Enforces colocated unit/component/hook tests, deterministic mocking, fast execution, and zero-failure gating on all code changes.
---

# Automated Vite + React Testing (Vitest + React Testing Library)

## When to Use
- **Mandatory** for every task that creates, modifies, refactors, or fixes runtime code (`.js`, `.jsx`, `.ts`, `.tsx`).
- Exempt only for documentation-only (`.md`), text/copy-only, or purely cosmetic CSS-only changes with zero runtime logic impact.

---

## 1. Standard Stack & Setup
PowerProject runs on **Vite + React**, so automated tests MUST use Vite's native test ecosystem for speed:
- **Test Runner:** `vitest` (shares Vite config/ESBuild transforms; no separate Babel/Webpack pipeline).
- **Component & Hook Testing:** `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`.
- **DOM Environment:** `happy-dom` (fastest) or `jsdom`.
- **Non-Watch Execution:** Always execute with `npx vitest run` (or `npm test` configured to `vitest run`) so agent runs terminate immediately and never hang in watch mode.

---

## 2. Colocation & Naming Conventions
Follow the **Colocation ("Delete Test")** architecture:
- Place tests directly next to the module under test:
  - `src/features/Tasks/TaskCard.jsx` -> `src/features/Tasks/TaskCard.test.jsx`
  - `src/hooks/useEmployees.js` -> `src/hooks/useEmployees.test.js`
  - `src/utils/dateHelpers.js` -> `src/utils/dateHelpers.test.js`
- When a feature folder is deleted, its tests are deleted cleanly with it.

---

## 3. What to Test (Behavior Over Implementation)
1. **React Components:**
   - Query like a user: prefer `getByRole`, `getByLabelText`, `getByText` over CSS selectors or internal state inspection.
   - Verify rendered states: loading, empty (`[]` / `null`), error, and populated states.
   - Verify user interactions with `@testing-library/user-event` (clicks, form inputs, modal open/close, submit callbacks).
   - Verify RBAC / permission visibility (e.g., Viewer cannot see Edit/Delete controls; Editor/Admin can).
   - Verify zero-crash guards (null/undefined props, `"0"` truthy-render bugs).
2. **Custom Hooks & Services:**
   - Test with `renderHook` (or direct unit calls for pure services/utilities).
   - Verify optimistic updates, error rollback behavior, and query parameter formatting (`camelCase` <-> `snake_case`).
3. **Bug Fixes (Regression Mandate):**
   - Write a targeted test that reproduces the exact failure scenario before/alongside the fix so it can never regress.

---

## 4. Keeping Tests Fast & Deterministic
- **Mock External Boundaries:**
  - Mock Supabase (`vi.mock('../../lib/supabaseClient', ...)`), `fetch`, and Capacitor plugins (`@capacitor/*`) so tests never hit live networks or databases.
  - Mock timers (`vi.useFakeTimers()`) for debounces, polling, or timeouts — never wait on real wall-clock delays.
- **Reset State Between Tests:**
  - Call `vi.clearAllMocks()` in `beforeEach` and rely on `@testing-library/react`'s `cleanup()` in `afterEach`.
- **Targeted Execution First:**
  - Run only the touched test file(s) during iteration:
    ```bash
    npx vitest run src/features/MyFeature/MyComponent.test.jsx
    ```
  - Run the full fast suite (`npx vitest run`) before finishing changes to shared components, hooks, contexts, or utilities.
- **Avoid Slow Browser Harnesses:**
  - Do not spin up Puppeteer or a live dev server for unit/component verification; reserve browser automation strictly for explicit E2E requests.

---

## 5. Mandatory Gate & Reporting
Before declaring any code task complete:
1. Run the relevant Vitest test command and confirm **100% pass (`exit code 0`)**.
2. Never add `.skip`, comment out failing assertions, or weaken assertions to force a green run.
3. If `vitest` is not yet installed in `package.json`, inform the user (or install/configure it if approved) instead of silently bypassing automated tests.
4. Include the executed test command and result summary in your final response.
