# Runbook Risk Analysis & Hardening Notes

This file documents identified risks for a low-context model executing these
runbooks verbatim, and the corrective additions made to each runbook.

## Global Risks Identified

1. **`Select-String -Recurse` does not exist in PS 5.1** — every verification
   grep using this flag will fail silently. All runbooks have been corrected to
   use the working form: `Get-ChildItem -Recurse "src" -Include "*.jsx","*.js" | Select-String -Pattern "..."`.

2. **RB-02 leaves `authService` import ambiguous** — the instruction says to
   remove the import then adds a footnote to keep it. A low-context model will
   delete it on the first pass. The note has been elevated to a ⚠️ warning block.

3. **RB-03 `AppNavigationProvider` placement** — the runbook correctly says NOT
   to add the provider to `main.jsx`, but does not explicitly say WHERE it goes
   inside `App.jsx`. A low-context model might wrap the wrong component. The
   instruction has been made exact.

4. **RB-04 "Option A vs Option B" ambiguity** — the runbook presents two options
   and says "implement Option A". A low-context model may implement both. The
   Option B block has been labelled FUTURE SCOPE — DO NOT IMPLEMENT.

5. **RB-05 table name assumption** — `taskFixService.js` uses `task_context_links`
   as the table name. A low-context model has no way to verify this without being told.
   The pre-flight check now explicitly includes a grep to confirm the table exists.

6. **RB-06 `ListViewRow` line range is approximate** — the runbook says
   "lines 23–354". These numbers will drift as the file is edited. A low-context
   model that relies on these numbers literally will cut the wrong range.
   Instructions now say to use the function signature as the anchor, not line numbers.

7. **RB-08 barrel files list components that may not exist** — e.g.
   `EmployeeTreeCard`, `ClientListRow` etc. A model creating the barrel will fail
   the build if any export target file is missing. A pre-flight existence check
   has been added.

8. **RB-09 hook path assumptions** — `useTaskController.js` imports are listed as
   guesses (`import { STAGE_LIST } from '../constants/stages'`). A model that copies
   these without verifying will break the build. Now explicitly says: read the
   actual import block first, then update paths.

9. **RB-12 `clientService.js` uses wrong table names** — the real tables in the
   codebase are `client_billing_models` (not `billing_models`) and
   `client_services`. The service template has been corrected.

10. **RB-12 `clientService.js` misses `useClients.js` hook** — `ClientManagement.jsx`
    already uses `useClients` hook which calls Supabase directly. RB-12 must update
    the hook too, not just the management components. This is now explicitly covered.

11. **No explicit git commit-point guidance per runbook** — only RB-07 and RB-08
    mention commits. A low-context model may run all 12 runbooks without ever
    committing, making rollback impossible. Each runbook now has a mandatory commit step.
