# Tech Debt Logging Rule

## Context
As the PowerProject scales, the team frequently makes conscious decisions to defer or ignore certain technical bugs, product limitations, or architectural compromises (e.g., due to low impact, high effort to fix, or deliberate grace-degradation).

## The Rule
1. Whenever the user explicitly instructs you to "ignore" a bug, architecture flaw, or product issue, you MUST log it.
2. Open or create the file `docs/tech_debt_log.md` (located in the project root).
3. Add a new entry to the `Logged Items` section detailing:
   - **Location**: The file/service where the issue resides.
   - **Issue**: A clear, technical description of the bug or limitation.
   - **Reason for Deferral**: Why it was ignored (based on the user's instructions or your deduction).
   - **Date Logged**: The current month and year.

## Rationale
This prevents future AI agents or developers from wasting time discovering, auditing, or attempting to fix code that was intentionally left as-is. It serves as a central registry for the team to periodically review deferred work.
