---
name: Database Migration Policy
description: Rules for maintaining 100% schema parity and history continuity in Supabase migrations.
---

# Database Migration Policy

To maintain a stable development-to-production pipeline and ensure 100% schema parity, always follow these critical rules when interacting with `supabase/migrations`.

### 1. Immutability of History
- **Never Edit Applied Migrations**: Once a migration file has been pushed to the remote server (Staging or Production), it is considered "digitally signed" by its checksum. Never modify the contents of an existing migration file.
- **Checksum Integrity**: If you change an old file, the Supabase CLI will fail with a "Checksum Mismatch" error.

### 2. Iterative Schema Evolution (The "New File" Rule)
- **Always Use New Files**: Every new schema change, column addition, or data fix must be placed in a **new, timestamped `.sql` file**.
- **Example**: If you need to add a column to `employees`, do not edit the file that created the table. Create `20260327000000_add_phone_to_employees.sql`.

### 3. History Continuity & Placeholders
- **Never Delete Applied Files**: If an applied migration file is deleted locally, the CLI will error with "Remote migration not found."
- **Renaming/Moving**: If you must reorganize or consolidate files (like the "Master Mirror" strategy), the old filenames must remain as **empty placeholders** to satisfy the database's `_migrations` history table.

### 4. Idempotent SQL (Safe Repairs)
- **Use `IF NOT EXISTS`**: Always use `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.
- **Logic Triggers**: Wrap complex logic in `DO $$ BEGIN ... END $$` blocks with `IF NOT EXISTS` checks for triggers and indices.
- **Why**: This ensures that your migrations are "self-healing" and can run safely on a database that is already partially or fully updated.

### 5. Master Mirror Strategy (Canonical Start)
- Current Canonical Root: `20260326000001_ultimate_production_mirror.sql`.
- Any environment setup starts by running this Master Mirror. All subsequent changes must follow the iterative rules above.

### 6. Automated Recovery (Repair)
- If a migration history desync occurs (e.g. after a branch merge or a failed deploy), use the automated `repair` step in GitHub Actions:
  `supabase migration repair --status reverted <timestamp>`
- This should only be used as a last resort to "clear the path" for the new, correct migrations.
