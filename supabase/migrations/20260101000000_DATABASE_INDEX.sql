-- =========================================================================
-- POWERPROJECT: MASTER MIGRATION INDEX (DAY 0)
-- This file is a living map of the database architecture.
-- It tracks which migrations introduced or modified major entities.
-- =========================================================================

-- [ignoring loop detection]

/*
## 1. CORE INFRASTRUCTURE
| Entity Type | Name | Primary Migration | Last Modified By |
| :--- | :--- | :--- | :--- |
| Table | public.user_profiles | 20260101000001 | 20260429220000 |
| Table | public.employees | 20260101000001 | 20260423102600 |
| Table | public.hubs | 20260101000001 | 20260423102600 |
| Function | public.get_user_permission_level | 20260101000001 | 20260423203000 |

## 2. TASK & CONTEXT LINK ENGINE
| Entity Type | Name | Primary Migration | Last Modified By |
| :--- | :--- | :--- | :--- |
| Table | public.tasks | 20260101000001 | 20260430103000 |
| Table | public.task_context_links | 20260423102600 | 20260429220000 |
| RPC | public.rpc_orchestrate_tasks | 20260428153400 | 20260430103000 |
| Function | public.generate_daily_tasks | 20260423203000 | 20260423203000 |

## 3. SECURITY & AUDITING
| Entity Type | Name | Primary Migration | Last Modified By |
| :--- | :--- | :--- | :--- |
| Table | public.security_audit_logs | 20260421110000 | 20260429220000 |
| Table | public.tasks_history | 20260429220000 | 20260429220000 |
| Trigger | public.log_task_history | 20260429220000 | 20260429220000 |
| Trigger | public.protect_task_columns | 20260423102600 | 20260430103000 |

## 4. ROLE-BASED ACCESS CONTROL (RLS)
| Table | Security Strategy | Key Migration |
| :--- | :--- | :--- |
| tasks | Hierarchical (Vertical + Assignee + TCL) | 20260423203000 |
| task_context_links | Management (Editor + Creator + Assignee) | 20260429220000 |
| user_profiles | Self-View + Master Admin Management | 20260421110000 |

## 5. COMPLETE MIGRATION CHRONOLOGY
| Migration File | Title / Group | Focus & Key Accomplishments |
| :--- | :--- | :--- |
| **20260101000000** | **DATABASE_INDEX** | **Living Map: Table of contents for the entire schema.** |
| 20260101000001 | Baseline: Tables | Core schema: profiles, employees, hubs, tasks. |
| 20260101000002 | Baseline: FKs/Indexes | Referential integrity and performance optimization. |
| 20260101000003 | Baseline: Triggers | Automation: updated_at, basic audit stamps. |
| 20260101000004 | Baseline: RLS | Initial Row Level Security policies. |
| 20260101000005 | Baseline: Seed | Default vertical, role, and system data. |
| 20260101000006 | Baseline: Grants | Postgres permission grants for authenticated/anon. |
| 20260330000000 | Submissions | Proof of Work: created task_submissions table. |
| 20260330000001 | Submissions: Rejection | Logic for rejection comments and rework loops. |
| 20260330000002 | Submissions: Harden | Constraints and security policies for submissions. |
| 20260405000000 | Workflow: RBAC | Hardened workflow transitions and manual move logic. |
| 20260406000001 | Entities: Table | Universal registry for physical assets (Charging Hubs). |
| 20260406000002 | Entities: Registry | Type definitions and field metadata for entities. |
| 20260406000003 | Entities: Linkage | Linked submissions to specific entities for tracking. |
| 20260406000005 | Archive: Logs | Initial archival logging for hot-cold data management. |
| 20260406000006 | Entities: Atomic RPC | Atomic creation of entities with all context metadata. |
| 20260421110000 | Security: User Mgmt | Admin security audit logs and atomic permission sync. |
| 20260423102600 | Task Standardization | Normalized to snake_case. Introduced Context Link Table. |
| 20260423203000 | Multi-Hub & Fan-Out | Consolidated tasks. Implemented Hub-based Fan-Out engine. |
| 20260425150000 | Backup System | Implemented automated task state backup/restore logic. |
| 20260428153400 | Orchestration RPC | Atomic multi-task/link orchestrator for frontend/CSV. |
| 20260429220000 | Auditing & Support | Lean Task History auditing + Idempotent RPC. |
| 20260430103000 | Orchestration Hardening | **[LATEST]** UUID safety, Orphan protection, Workflow Guard repair. |

=========================================================================
*/

-- Idempotent registration of the index
DO $$
BEGIN
    RAISE NOTICE 'Database Index Loaded. Refer to 20260101000000_DATABASE_INDEX.sql for the schema map.';
END $$;
