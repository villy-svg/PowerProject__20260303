# Database Migration & Naming Standards

Rules for maintaining 100% schema parity and ensuring predictable database evolution.

## 1. Table Naming Convention
- **Strict Pattern**: All database tables MUST follow the hierarchical pattern: `[vertical]_[feature]_[details]` (e.g., `employee_attendances_daily`).
- **Related Objects**: 
  - Foreign Keys: `fk_[table]_[referenced_table]_[column]`
  - Indexes: `idx_[table]_[columns]`
  - Triggers/Functions: `trg_[table]_[action]` / `func_[table]_[action]`

## 2. Migration Core Baseline Immunity
- **Do Not Edit Baseline**: Never edit the 6 core baseline files (`20260101*.sql`) once they have been applied.
- **Forward Only**: All new schema changes must be added via timestamped SQL migration files.

## 3. PostgreSQL Schema Kick
- **Mandatory Refresh**: Every schema-changing SQL migration MUST end with `NOTIFY pgrst, 'reload schema';` to prevent Supabase API caching errors (HTTP 406).

## 4. Staging → Production Pipeline
- **Explicit Push Permission Required**: Agents MUST NEVER push any database migration anywhere — neither via `git push` (to `staging`, `main`, or any remote branch) nor via `supabase db push` (to any remote database) — without the user's explicit permission first. Always create the migration file locally and wait for user approval before pushing.
- **Strict Flow**: Migrations MUST flow from Staging to Production. Never push a migration directly to production without validating it on staging first.
- **No UI Edits**: Never create tables or columns directly in the Supabase UI. Always write the SQL first in a migration file.
