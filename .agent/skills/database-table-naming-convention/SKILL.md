---
name: database-table-naming-convention
description: Use when creating new database tables, writing schema migration files, or renaming existing tables to ensure a unified naming structure starting with vertical name, then feature name, and then specific details.
---

# Database Table Naming Convention

## Overview
All new tables in the database (including staging, production, and backups) must follow a strict, unified naming structure to ensure consistency, prevent namespace collision, and keep related features grouped together.

## The Naming Pattern
Every table name must follow the hierarchical pattern:
`[vertical]_[feature]_[details]`

* **`[vertical]`**: The primary department, module, or high-level vertical of the application (e.g., `employee`, `client`, `task`, `notification`, `auth`).
* **`[feature]`**: The specific component or sub-module within that vertical (e.g., `attendances`, `billing`, `documents`, `profiles`).
* **`[details]`**: Any additional details, timeframes, types, or qualifiers (e.g., `daily`, `monthly`, `requests`, `backup`).

## Examples

| Original / Incorrect Name | Correct / Standardized Name | Vertical | Feature | Details |
| :--- | :--- | :--- | :--- | :--- |
| `daily_attendances` | `employee_attendances_daily` | `employee` | `attendances` | `daily` |
| `attendance_edit_requests` | `employee_attendances_requests` | `employee` | `attendances` | `requests` |
| `client_services` | `client_services` (already correct) | `client` | `services` | None |
| `tasks_backup` | `task_tasks_backup` | `task` | `tasks` | `backup` |
| `push_notifications` | `notification_push` | `notification` | `push` | None |

## Related Database Objects
When applying this naming convention, ensure that related database objects follow a matching pattern:

1. **Foreign Keys (FKs)**: Naming format should be `fk_[table]_[referenced_table]_[column]`.
2. **Indexes**: Naming format should be `idx_[table]_[columns]`.
3. **Triggers**: Naming format should be `trg_[table]_[action]`.
4. **Trigger Functions**: Naming format should be `func_[table]_[action]`.
