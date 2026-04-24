# Multi-Hub Fan-Out Task Engine — Runbook Master Index

## Goal

Replace the single-hub, single-assignee task model with a **fan-out hierarchy** that uses `task_context_links` for multi-hub and multi-assignee relationships, and `parent_task_id` for parent→child nesting. Simultaneously retire the `daily_tasks` table by consolidating everything into the unified `tasks` table.

---

## The Three Modes (User's Mental Model)

| # | Hubs Selected | Assignees Selected | What Gets Created |
|---|---|---|---|
| **Mode 1** | 1 hub | 1 assignee | **One task.** Simple. No children. Hub and assignee linked via `task_context_links`. |
| **Mode 2** | 1 hub | N assignees | **One parent task** (linked to the hub) + **N child tasks** (one per assignee). Each child has `parent_task_id` pointing to the parent. |
| **Mode 3** | M hubs | any | **One parent task** (linked to ALL M hubs) + **M child tasks** (one per hub). Each child is linked to its specific hub. Each child can then have its own assignee(s). |

### Visual Diagram

```
MODE 1:  Template → [Task] ← hub_link + assignee_link

MODE 2:  Template → [Parent Task] ← hub_link
                      ├── [Child Task 1] ← assignee_link(Alice)
                      ├── [Child Task 2] ← assignee_link(Bob)
                      └── [Child Task 3] ← assignee_link(Carol)

MODE 3:  Template → [Parent Task] ← hub_link(Hub-A) + hub_link(Hub-B) + hub_link(Hub-C)
                      ├── [Child Task Hub-A] ← hub_link(Hub-A) + assignee_link(Alice)
                      ├── [Child Task Hub-B] ← hub_link(Hub-B) + assignee_link(Bob)
                      └── [Child Task Hub-C] ← hub_link(Hub-C) + assignee_link(Carol, Dave)
```

---

## Architecture Context (Current State — Read First)

| Artifact | Table | Purpose |
|---|---|---|
| `tasks` | `public.tasks` | Project tasks with `parent_task_id` self-ref, `hub_id` (single), `assigned_to` (single) |
| `daily_tasks` | `public.daily_tasks` | Daily tasks — **TO BE RETIRED** into `tasks` |
| `daily_task_templates` | `public.daily_task_templates` | Recurring blueprints with `hub_id` (single), `assigned_to` (single) |
| `task_context_links` | `public.task_context_links` | Polymorphic link table. Currently supports: `assignee`, `client`, `partner`, `vendor`, `employee` |
| `assignees()` | Computed function | PostgREST join: `tasks → task_context_links → employees` |
| `generate_daily_tasks()` | PL/pgSQL function | Cron-triggered generator. Currently inserts into `daily_tasks`. |

### Key Columns After Standardization Migration (20260423102600)

- `tasks`: `vertical_id`, `stage_id`, `parent_task_id`, `assigned_to`, `hub_id`, `task_board` (jsonb), `metadata` (jsonb)
- `daily_tasks`: `vertical_id`, `stage_id`, `assigned_to`, `hub_id`, `task_board`, `metadata`
- `task_context_links`: `source_type` ('task'|'daily_task'|'template'), `source_id`, `entity_type`, `entity_id`, `metadata` (jsonb)

---

## Phase → Runbook Mapping

| Phase | Runbook | File | Status |
|---|---|---|---|
| **Phase 1: Multi-Hub Database Support** | | | |
| | 1.1 Add `hub` entity_type + computed relationship | [01_HUB_CONTEXT_LINKS.md](./01_HUB_CONTEXT_LINKS.md) | ☐ |
| | 1.2 Migrate existing hub_id data into context links | [02_MIGRATE_HUB_DATA.md](./02_MIGRATE_HUB_DATA.md) | ☐ |
| **Phase 2: Table Consolidation** | | | |
| | 2.1 Merge `daily_tasks` into `tasks` table | [03_CONSOLIDATE_TABLES.md](./03_CONSOLIDATE_TABLES.md) | ☐ |
| **Phase 3: Generator Fan-Out** | | | |
| | 3.1 Role-Aware Template Config (Metadata) | [04_TEMPLATE_MULTI_HUB.md](./04_TEMPLATE_MULTI_HUB.md) | ☐ |
| | 3.2 Atomic Generator Spawner (Fan-Out) | [05_GENERATOR_FANOUT.md](./05_GENERATOR_FANOUT.md) | ☐ |
| **Phase 4: RLS & Indexes** | | | |
| | 4.1 Hybrid RLS (Hub + Role + Status) | [06_RLS_MULTI_HUB.md](./06_RLS_MULTI_HUB.md) | ☐ |
| | 4.2 GIN & Composite Performance Indexes | [07_INDEXES.md](./07_INDEXES.md) | ☐ |
| **Phase 5: Frontend Services** | | | |
| | 5.1 Update taskService for multi-hub | [08_TASK_SERVICE.md](./08_TASK_SERVICE.md) | ☐ |
| | 5.2 Update templateService for multi-hub | [09_TEMPLATE_SERVICE.md](./09_TEMPLATE_SERVICE.md) | ☐ |
| | 5.3 Retire dailyTaskService | [10_RETIRE_DAILY_SERVICE.md](./10_RETIRE_DAILY_SERVICE.md) | ☐ |
| **Phase 6: Frontend UI** | | | |
| | 6.1 Multi-hub task form | [11_TASK_FORM_UI.md](./11_TASK_FORM_UI.md) | ☐ |
| | 6.2 Board hierarchy & nesting UI | [12_BOARD_NESTING_UI.md](./12_BOARD_NESTING_UI.md) | ☐ |

---

## Execution Rules

1. **Run phases in order.** Each phase depends on the previous.
2. **Each runbook is atomic.** Complete one before starting the next.
3. **Every runbook ends with validation.** Do NOT proceed until validation passes.
4. **Migration naming**: `YYYYMMDDHHMMSS_descriptive_name.sql`.
5. **PostgreSQL Kick**: Every migration MUST end with `NOTIFY pgrst, 'reload schema';`.
6. **Staging First**: Always deploy to staging, validate, then merge to main.
7. **Context Links are the source of truth.** The old scalar `hub_id` / `assigned_to` columns remain for backward compatibility as the "primary" reference. Multi-entity relationships live exclusively in `task_context_links`.

---

## Key Design Decisions

| Decision | Rationale |
|---|---|
| Hub links use `task_context_links` (not a new table) | Identical pattern to assignees. One polymorphic table for all entity relationships. |
| Keep scalar `hub_id` on `tasks` | Backward compatibility. Stores the "primary" hub. Multi-hub data lives in context links. |
| Consolidate `daily_tasks` → `tasks` with `task_board` tag | Eliminates schema duplication. `task_board` JSONB distinguishes task types. |
| Fan-out creates real child rows (not virtual) | Children are independent tasks that can be tracked, reassigned, and completed individually. |
| Parent task is an "umbrella" | Parent tracks overall progress. Children are the actionable units. Parent stage can be derived from children's stages. |
| No `scheduled_date` or `is_recurring` on tasks | The template manages scheduling. Generated tasks are just tasks — no special daily-task columns. |
