---
name: Database Migration Policy
description: Rules for maintaining 100% schema parity and history continuity in Supabase migrations.
---

# Database Migration Policy

To maintain a stable development-to-production pipeline and ensure 100% schema parity, always follow these critical rules when interacting with `supabase/migrations`.

### 1. The 6-File "Stable Core" Baseline
- **The Foundation**: All new environments must start with the 6 core files prefixed with `20260101`.
- **Purpose**: These files are the "System Source of Truth" and must never be deleted. They are logically separated (Tables, FKs, Functions, RLS, Seed, Grants).

### 2. "Repair-Safe" Idempotency
- **Baseline Rule**: The core baseline files must be "Repair-Safe". 
- **Pattern**: Use `IF NOT EXISTS` for all `CREATE` commands AND `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for all critical fields inside the baseline.
- **Why**: This allows the baseline to be re-pushed safely to an existing database to "patch" missing pieces without creating new migration files for one-off fixes.

### 3. Iterative Evolution (Standard Flow)
- **New Files for New Features**: Once the baseline is applied, **never edit the 6 core files** for daily development.
- **Timestamping**: Create a new, timestamped file for every new schema change (e.g., `20260328000000_add_search_to_tasks.sql`).
- **One-Way Street**: Migrations only go forward.

### 4. History Cleansing (Consolidation)
- **Resetting the Clock**: If the migration history becomes fragmented (checksum errors, dozens of messy files), a **One-Time Consolidation** is permitted.
- **Process**:
  1. Wipe local history and replace with a clean baseline.
  2. Run `DELETE FROM supabase_migrations.schema_migrations;` on remote.
  3. `db push --linked` to re-establish the new baseline.
- **Frequency**: This should be extremely rare (after major refactors).

### 5. The "PostgreSQL Kick"
- **Mandatory**: Every schema-changing migration MUST end with `NOTIFY pgrst, 'reload schema';`.
- **Why**: This prevents 406 (Not Acceptable) errors by forcing the Supabase API to refresh its cache.

### 6. Never "UI-Only"
- **Golden Rule**: Never create a table or column in the Supabase UI. Always write the SQL first in a migration file and `db push`. 
- **Parity**: Database drifts are the #1 cause of deployment failure.

---

### 7. Staging vs Production Pipeline

PowerProject runs **two independent Supabase projects**:

| Environment | URL Secret | Project ID Secret | DB Password Secret |
|-------------|------------|-------------------|--------------------|
| **Production** | `SUPABASE_URL` | _(linked)_ | `SUPABASE_DB_PASSWORD` |
| **Staging** | `SUPABASE_STAGING_URL` | `SUPABASE_STAGING_PROJECT_ID` | `SUPABASE_STAGING_DB_PASSWORD` |

**Deployment Flow:**
- **Staging DB**: Push via `staging-db.yml` (triggers on push to `staging` branch).
- **Production DB**: Push via `supabase-deploy.yml` (triggers on push to `main` branch).

**Critical Rule**: Migrations flow **Staging → Production**. Never push a migration directly to production without first validating it on staging. The ordering is: write SQL → push to staging branch → verify → merge to main → production auto-deploys.

**Schema Parity Guard**: The staging and production schemas MUST remain identical. If a migration is applied to staging and causes an error, do NOT push the same migration to production until fixed.

---

### 8. Edge Function Deployment

Edge Functions in `supabase/functions/` are **not** managed by migration files. They are deployed separately:

- **Deploy all functions**: `supabase functions deploy` (via `supabase-deploy.yml`).
- **Staging functions**: Deployed to staging Supabase project using `SUPABASE_STAGING_SERVICE_ROLE_KEY`.
- **Shared code**: Common utilities live in `supabase/functions/_shared/` and are `import`-ed by individual functions.

**Rule**: Never hardcode environment-specific URLs or keys inside Edge Function code. Use `Deno.env.get('SUPABASE_URL')` which is auto-injected by the Supabase runtime.

See [Hot-Cold Archival Engine](file:///c:/Users/villy/OneDrive/Documents/PowerPod%20New/Coding%20Practice/PowerProject/.agent/skills/hot-cold-archival/SKILL.md) for full Edge Function rules.

