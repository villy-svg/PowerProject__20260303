# Daily Task Engine — Senior Manager & Sub-Task Hierarchy

## Runbook Master Index

This folder contains a phased set of runbooks for implementing the **Senior Manager & Sub-Task hierarchy** within the Daily Task Engine. Each runbook is self-contained, sequentially ordered, and written so that any low-context model or developer can follow it from start to finish without guessing.

---

## Architecture Context (Read First)

### What We Have Today

| Artifact | Purpose |
|---|---|
| `daily_task_templates` table | Recurring blueprints (title, freq, assignee, vertical, etc.) |
| `daily_tasks` table | Generated instances shown on the Kanban board |
| `generate_daily_tasks()` PL/pgSQL function | Iterates templates, inserts one `daily_tasks` row per template per schedule tick |
| `dailyTaskTemplateService.js` | Frontend CRUD for templates |
| `dailyTaskService.js` | Frontend CRUD for generated daily task instances |
| `useDailyTasks.js` hook | React state management for daily tasks |
| `DailyTasksManagement.jsx` | Template management UI (grid/list, modal form) |

### What We're Building

A mirroring of the main `tasks` table's `parent_task` self-referencing hierarchy into the daily task engine:

1. **Template-level**: A master template can have sub-task blueprints (via `daily_task_template_subtasks` junction table + `has_sub_assignees` toggle + `senior_manager_id` field).
2. **Instance-level**: Generated daily tasks gain a `parent_task_id` self-reference, enabling parent ↔ child nesting.
3. **Generator update**: When a parent template fires, its sub-templates also fire atomically.
4. **RLS update**: Senior managers see their sub-assignee tasks; sub-assignees see only their own.
5. **Frontend**: Template wizard gains sub-task configuration; board gains nesting UI.

### Existing Hierarchy Pattern (Gold Standard — `tasks` table)

```
tasks.parent_task UUID → REFERENCES tasks(id) ON DELETE SET NULL
```

We replicate this exact pattern into `daily_tasks`.

---

## Phase → Runbook Mapping

| Phase | Runbook | File | Status |
|---|---|---|---|
| **Phase 1: Database Migrations** | | | |
| | 1.1 Template Schema Extension | [01_TEMPLATE_SCHEMA.md](./01_TEMPLATE_SCHEMA.md) | ☐ |
| | 1.2 Sub-Task Blueprint Table | [02_SUBTASK_BLUEPRINT_TABLE.md](./02_SUBTASK_BLUEPRINT_TABLE.md) | ☐ |
| | 1.3 Daily Tasks Self-Reference | [03_DAILY_TASKS_SELF_REF.md](./03_DAILY_TASKS_SELF_REF.md) | ☐ |
| **Phase 2: Generator Logic** | | | |
| | 2.1 Generator Function Update | [04_GENERATOR_UPDATE.md](./04_GENERATOR_UPDATE.md) | ☐ |
| **Phase 3: RLS & Performance** | | | |
| | 3.1 RLS Policy Updates | [05_RLS_POLICIES.md](./05_RLS_POLICIES.md) | ☐ |
| | 3.2 Performance Indexes | [06_PERFORMANCE_INDEXES.md](./06_PERFORMANCE_INDEXES.md) | ☐ |
| **Phase 4: Frontend Services** | | | |
| | 4.1 Template Service Extension | [07_TEMPLATE_SERVICE.md](./07_TEMPLATE_SERVICE.md) | ☐ |
| | 4.2 Daily Task Service Extension | [08_DAILY_TASK_SERVICE.md](./08_DAILY_TASK_SERVICE.md) | ☐ |
| | 4.3 React Hook Updates | [09_REACT_HOOKS.md](./09_REACT_HOOKS.md) | ☐ |
| **Phase 5: Frontend UI** | | | |
| | 5.1 Template Wizard Sub-Task Config | [10_TEMPLATE_WIZARD_UI.md](./10_TEMPLATE_WIZARD_UI.md) | ☐ |
| | 5.2 Board Nesting UI | [11_BOARD_NESTING_UI.md](./11_BOARD_NESTING_UI.md) | ☐ |

---

## Execution Rules

1. **Run phases in order.** Phase 2 depends on Phase 1 tables existing. Phase 4 depends on Phase 3 RLS.
2. **Each runbook is atomic.** Complete one before starting the next.
3. **Every runbook ends with validation.** Do NOT proceed until validation passes.
4. **Migration naming**: Use timestamp format `YYYYMMDDHHMMSS_descriptive_name.sql`.
5. **PostgreSQL Kick**: Every migration MUST end with `NOTIFY pgrst, 'reload schema';`.
6. **Staging First**: Always push to staging, validate, then merge to main for production.

---

## Key Design Decisions

| Decision | Rationale |
|---|---|
| Separate `daily_task_template_subtasks` table (not self-referencing templates) | Templates are blueprints, not instances. A junction table is cleaner than polluting the template table with a `parent_template_id` that would complicate the generator loop. |
| `parent_task_id` self-reference on `daily_tasks` (not a junction table) | Mirrors the proven `tasks.parent_task` pattern exactly. Simpler queries, no join overhead. |
| `senior_manager_id` on templates (not on daily_tasks) | The manager is a template-level concept (who oversees this recurring task). Generated tasks inherit `assigned_to` from sub-blueprints. |
| `has_sub_assignees` boolean toggle | Explicit opt-in prevents the generator from doing unnecessary sub-task lookups for the 95% of templates that are simple single-assignee tasks. |
| `ON DELETE SET NULL` for self-reference | If a parent daily task is deleted, children become orphaned top-level tasks rather than being cascade-deleted. This prevents accidental data loss. |
| `CHECK (parent_task_id != id)` constraint | Hard prevention of infinite self-referencing loops at the database level. |
