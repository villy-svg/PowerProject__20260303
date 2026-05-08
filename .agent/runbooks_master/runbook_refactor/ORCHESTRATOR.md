# PowerProject Modular Refactor — ORCHESTRATOR

## Purpose
This file is the master control document for the entire modular refactoring effort.
Each runbook in this folder is a fully self-contained implementation guide intended for
a low-context model executing it independently in a fresh chat session.

---

## Project Context (Read Before Anything)

**Stack**: React 18 + Vite + Supabase + Capacitor (PWA/Android hybrid)
**Entry Point**: `src/App.jsx` (631 lines — primary refactor target)
**Component Root**: `src/components/` (63 files — mixed shared + feature-specific)
**Verticals**: ChargingHubs, Employees, Clients (each in `src/verticals/`)
**Services**: `src/services/` (auth, core, tasks, employees, rules, storage)
**Hooks**: `src/hooks/` (18 global hooks — many are feature-scoped)
**Styles**: `src/styles/` (globalTheme.css + systems/ tokens)
**Constants**: `src/constants/` (roles, stages, verticals, taskSchema, taskBoards)

**Dev server**: `npm run dev` (already running — do NOT restart unless told)
**Build command**: `npm run build:staging` (use this to verify each runbook)

---

## Runbook Execution Order (MANDATORY — Sequential)

Runbooks have dependencies. A model MUST NOT start a runbook until the prior one
is verified complete. The sequence is:

```
RB-01 → RB-02 → RB-03 → RB-04 → RB-05 → RB-06
  ↓
RB-07 (depends on RB-01 through RB-04)
  ↓
RB-08 → RB-09 → RB-10 → RB-11 → RB-12
```

| # | File | Title | Depends On | Risk |
|---|---|---|---|---|
| 01 | `RB-01-vertical-registry.md` | Create verticalRegistry.js | None | 🟡 Low |
| 02 | `RB-02-auth-context.md` | Extract AuthContext | RB-01 | 🔴 High |
| 03 | `RB-03-navigation-context.md` | Extract AppNavigationContext | RB-02 | 🟠 Medium |
| 04 | `RB-04-taskboard-context.md` | Extract TaskBoardContext | RB-03 | 🔴 High |
| 05 | `RB-05-split-taskservice.md` | Split taskService.js | RB-01 | 🟠 Medium |
| 06 | `RB-06-extract-listviewrow.md` | Extract ListViewRow | RB-01 | 🟡 Low |
| 07 | `RB-07-slim-appjsx.md` | Slim App.jsx | RB-01–RB-04 | 🟡 Low |
| 08 | `RB-08-barrel-exports.md` | Vertical barrel exports | RB-07 | 🟢 Minimal |
| 09 | `RB-09-move-task-hooks.md` | Colocate task hooks | RB-08 | 🟡 Low |
| 10 | `RB-10-inline-styles.md` | Remove inline styles | RB-09 | 🟢 Minimal |
| 11 | `RB-11-split-css.md` | Split TaskController.css | RB-10 | 🟡 Low |
| 12 | `RB-12-client-service.md` | Add clientService.js | RB-11 | 🟢 Minimal |

---

## Completion Checklist for EACH Runbook

Before marking a runbook DONE and starting the next one, the executing model MUST:

- [ ] `npm run build:staging` completes with zero errors
- [ ] Dev server hot-reload shows no red error overlay
- [ ] Hub Task Board (`activeVertical = CHARGING_HUBS`) opens and loads tasks
- [ ] Employee Management page opens
- [ ] Client Management page opens
- [ ] Login / Logout flow works
- [ ] No `console.error` output relating to the changed files

---

## Global Rules (Apply to Every Runbook)

1. **Never delete logic** — only move it. If a function moves files, import it back where needed.
2. **One runbook at a time** — never start N+1 until N passes `npm run build:staging`.
3. **No new libraries** — do not install any npm packages. Use existing React patterns only.
4. **CSS safety** — when moving a CSS class to a new file, grep for all usages before deleting from the old file.
5. **No hardcoded hex colors** — always use `var(--css-variable)` from the design system.
6. **Preserve all JSDoc comments** — do not delete any existing `/** */` documentation.
7. **Import verification** — after every file creation, scan that file's imports and confirm every referenced path exists.
8. **Prop contract preservation** — when a component stops receiving a prop via drilling (because a context now provides it), update the component's prop signature and every parent that was passing it.
9. **Git commit after every passing runbook** — immediately after `npm run build:staging` succeeds, run `git add -A && git commit -m "refactor: RB-XX <short description>"`. This is your rollback checkpoint.
10. **Backend is off-limits** — do NOT touch any file in `src/services/` except where explicitly stated in the runbook. Do NOT modify any Supabase schema or edge functions. This refactor is frontend/structure only.

---

## Design System Reference (Do NOT Violate)

| Token | Value |
|---|---|
| `var(--brand-green)` | Primary green |
| `var(--brand-blue)` | Secondary blue |
| `var(--bg-surface)` | Card backgrounds |
| `var(--bg-elevated)` | Elevated panels |
| `var(--text-color)` | Primary text |
| `var(--text-secondary)` | Muted text |
| `var(--border-color)` | Borders |
| `var(--status-danger)` | Error states (replaces `#ff4444`) |

Button classes: `halo-button`, `master-action-btn`
Badge classes: `card-priority`, `neutral-badge`

---

## Key File Sizes (For Reference)

| File | Lines | Status |
|---|---|---|
| `src/App.jsx` | 631 | 🔴 God component — primary target |
| `src/services/tasks/taskService.js` | 785 | 🔴 Monolith — split in RB-05 |
| `src/components/TaskListView.jsx` | 540 | 🟠 Two components — split in RB-06 |
| `src/components/TaskController.jsx` | 403 | 🟠 Needs CSS split (RB-11) |
| `src/components/TaskController.css` | ~500 | 🟠 15KB — split in RB-11 |
| `src/verticals/ChargingHubs/HubTaskForm.jsx` | ~900 | 🔴 Future RB (not in scope yet) |

---

## Post-Refactor Success Metrics

- `App.jsx` under 200 lines
- `taskService.js` under 300 lines
- Zero prop chains deeper than 3 levels for `user`, `permissions`, `setActiveVertical`
- All vertical-specific hooks colocated in their feature directory
- `npm run build:staging` bundle size does not increase by more than 2%
- Zero new `console.error` or `console.warn` entries introduced

---

## PowerShell Compatibility — MANDATORY READ

> ⚠️ The system runs **PowerShell 5.1**. `Select-String` in PS5.1 does NOT support
> the `-Recurse` flag. Every grep command in these runbooks uses the correct form:

**WRONG (fails silently):**
```powershell
Select-String -Recurse -Path "src" -Pattern "foo"
```

**CORRECT (always use this form):**
```powershell
Get-ChildItem -Recurse "src" -Include "*.jsx","*.js" | Select-String -Pattern "foo"
```

All runbooks in this folder already use the correct form.
If you ever need to write an ad-hoc grep, use the CORRECT form above.

---

## How to Feed a Runbook to a Low-Context Model

Paste this preamble before each runbook content:

```
You are implementing a single, focused refactoring task for the PowerProject
React application. The full codebase is at:
  c:\Users\villy\OneDrive\Documents\PowerPod New\Coding Practice\PowerProject

IMPORTANT RULES:
- Read the runbook COMPLETELY before making any changes.
- Follow every step exactly, in order. Do not skip steps.
- Do NOT touch any file in src/services/ unless the runbook explicitly says to.
- Do NOT modify any Supabase schema, migrations, or edge functions.
- After completing all steps, run: npm run build:staging
- If the build succeeds, run: git add -A && git commit -m "<commit message from the runbook>"
- Report the build output (success or errors).
```

Then paste the full contents of the relevant RB-XX file.
