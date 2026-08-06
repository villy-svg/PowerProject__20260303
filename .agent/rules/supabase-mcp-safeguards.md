---
description: Mandatory rules for interacting with Supabase via MCP to prevent unintended database modifications.
---

# Supabase MCP Safety Rules

## 1. Strict Read-Only Default
When using the Supabase MCP server tools, the AI agent must default to **READ-ONLY** operations. 

**Allowed (Read-Only) Tools:**
- `list_tables`
- `execute_sql` (STRICTLY `SELECT` queries ONLY. Do not use `INSERT`, `UPDATE`, `DELETE`, `DROP`, `CREATE`, `ALTER`, etc.)
- `get_advisors`
- `get_logs`
- `list_migrations`
- `list_organizations`
- `get_organization`
- `list_projects`
- `get_project`
- `get_cost`
- `confirm_cost`
- `get_project_url`
- `get_publishable_keys`
- `list_edge_functions`
- `get_edge_function`
- `list_branches`
- `search_docs`

## 2. Explicit User Approval Required for Modifying Actions
The agent MUST NOT use any of the following tools or perform mutating operations without **explicit, manual confirmation** from the user:

**Blocked Actions (Require Explicit Approval):**
- `apply_migration`
- `deploy_edge_function`
- `execute_sql` (if the query contains mutating keywords like `INSERT`, `UPDATE`, `DELETE`, `DROP`, `CREATE`, `ALTER`, `TRUNCATE`)
- Any other action that alters production data, schema, or configuration in Supabase.

## 3. Workflow for Approval
If a modifying action is necessary to solve the user's problem:
1. Explain exactly what action needs to be taken.
2. Show the exact SQL query or command that will be executed.
3. Stop and ask the user explicitly: "Do I have your permission to run this on your database?"
4. **Only proceed after the user replies with a clear confirmation.**
