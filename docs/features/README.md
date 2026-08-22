# Feature Registry — PowerProject

This is the **living index** of all Product/Technical Requirements Documents (PRDs/TRDs)
maintained in `docs/features/`. It is the first file a new AI model or developer should
read when joining this project.

> **AI Instruction:** This file MUST be updated every time a new `docs/features/*.md` file
> is created, or when an existing file's status changes. Update the Status column and the
> "Tables/Components Touched" column. This enables conflict detection — before planning any
> new feature, scan this table to see if another planned/in-progress feature touches the
> same tables or components.

---

## How to Read This Registry

| Column | Meaning |
|---|---|
| **Feature** | Clickable link to the PRD/TRD document |
| **Status** | Current lifecycle stage |
| **Last Updated** | Date the document was last meaningfully changed |
| **Tables Touched** | Supabase tables this feature reads/writes |
| **Components Touched** | Key React components or hooks affected |
| **Owner Session** | AI session or developer who created/owns the plan |

**Status values:**
- `Draft` — Plan is being written, not yet approved
- `In Review` — User is actively reviewing and debating the plan
- `Approved` — User has confirmed the strategy; execution may begin
- `Implemented` — Code has been shipped; document has implementation notes
- `Deferred` — Agreed to not build this yet; reason is noted in the document
- `Superseded` — This plan was replaced by a newer document (link to replacement)

---

## ⚠️ Conflict Detection Protocol

Before creating a new plan, check this table. If your new feature touches any table or
component already listed under a `Draft`, `In Review`, or `Approved` feature, you MUST:

1. Read that feature's PRD/TRD document fully.
2. Note the conflict in Phase 1 of your new document under "1a. Technical Dependencies."
3. Alert the user: "Feature X (currently in [Status]) also touches [table/component].
   We need to sequence these carefully to avoid merge conflicts or logic collisions."

---

## Feature Index

| Feature | Status | Last Updated | Tables Touched | Components Touched | Owner Session |
|---|---|---|---|---|---|
| [Employee Attendance Board Optimization](./employee_attendance_board_optimization.md) | Draft | 2026-08-22 | None | `EmployeeAttendanceBoard.jsx`, `AttendanceGrid.jsx`, `MasterPageHeader.jsx` | Antigravity session |
| [Signup & Login Flow](./signup_login_flow.md) | Implemented | 2026-08-22 | `hr_employees`, etc. | `Auth` components | Unknown |

---

## Deferred Features

Features that have been planned but consciously set aside. Do not build these without
re-reading the document and getting fresh approval.

| Feature | Deferred On | Reason Summary |
|---|---|---|
| _(none yet)_ | — | — |

---

## Superseded Plans

Old plans that have been replaced. Kept here for historical audit trail.

| Old Feature | Superseded By | Date |
|---|---|---|
| _(none yet)_ | — | — |
