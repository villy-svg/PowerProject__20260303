# Supabase GitHub Secrets Setup

## Required GitHub Secrets

You need to add these secrets to your GitHub repository:

### 1. SUPABASE_ACCESS_TOKEN
- Go to https://supabase.com/dashboard/account/tokens
- Generate a new access token
- Add it as: `SUPABASE_ACCESS_TOKEN`

### 2. SUPABASE_PROJECT_ID  
- Go to your Supabase project dashboard
- Look at the URL: `https://supabase.com/dashboard/project/PROJECT_ID`
- Copy the PROJECT_ID (looks like: `abcdefghijk123456`)
- Add it as: `SUPABASE_PROJECT_ID`

### 3. SUPABASE_DB_PASSWORD (Optional)
- Your database password
- Add it as: `SUPABASE_DB_PASSWORD`

## How to Add Secrets

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add each secret with the exact name and value

## Troubleshooting

### If workflow fails:
1. Check that secrets are spelled exactly right
2. Verify SUPABASE_ACCESS_TOKEN has proper permissions
3. Make sure SUPABASE_PROJECT_ID is correct (no extra spaces)
4. Check that migrations folder has proper SQL files

### To run manually:
1. Go to **Actions** tab in GitHub
2. Click **Supabase Deploy** workflow
3. Click **Run workflow** → **Run workflow**

## Current Migrations Ready for Deployment

✅ `20260303060000_add_city_to_tasks.sql`
✅ `20260303070000_add_function_to_tasks.sql`  
✅ `20260303080000_add_function_code_to_hub_functions.sql`
✅ `20260303090000_create_hub_functions.sql`
✅ `20260303100000_rename_hub_location_to_city.sql`
✅ `20260316010000_create_employees_table.sql`
✅ `20260316020000_create_employee_history_table.sql`
✅ `20260316030000_create_employee_roles_table.sql`
✅ `20260316040000_create_departments_table.sql`
✅ `20260317080000_create_hubs_table.sql`
