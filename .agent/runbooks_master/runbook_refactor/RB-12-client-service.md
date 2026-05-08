# RB-12 — Add `clientService.js`

**Risk Level**: 🟢 Minimal | **Depends On**: RB-11 complete | **Est. Time**: 1 hour

> ⚠️ **BACKEND SAFETY**: This runbook adds a new service file that wraps existing
> Supabase queries already working in the components. It does NOT change any SQL,
> table schemas, RLS policies, or column names. All existing component behavior
> is preserved — only the call site moves from component → service.

> ⚠️ **TABLE NAME VERIFICATION REQUIRED**: Run the pre-flight grep to confirm the
> exact table names used in your codebase. The template uses names found in the
> current codebase (`client_billing_models`, not `billing_models`).

---

## Problem

The Clients vertical lacks a dedicated service layer. `ClientManagement.jsx`,
`ClientCategoryManagement.jsx`, `ClientBillingModelManagement.jsx`, and
`ClientServiceManagement.jsx` likely call `supabase.from('clients')` directly
inside the component or via ad-hoc patterns — violating the Repository Pattern
established by `src/services/employees/employeeService.js`.

**Rule (from Development Best Practices skill)**:
> A React component MUST NEVER directly call `supabase.from()`.
> All data access must be abstracted into a Service Layer or a Custom Hook.

---

## Objective

Create `src/services/clients/clientService.js` mirroring the employees pattern.
Update all Client management components to use this service.

---

## Pre-Flight Checks

### Confirm what exists for employees (reference pattern):
```powershell
Get-Content "src/services/employees/employeeService.js" | Select-Object -First 30
```

### Scan Client components for raw Supabase calls:
```powershell
Get-ChildItem -Recurse "src/verticals/Clients" -Include "*.jsx" | Select-String -Pattern "supabase" | Select-Object Filename, LineNumber, Line | Format-Table -AutoSize
```

Record which components and which tables they query.

### CRITICAL: Confirm exact table names in the codebase:
```powershell
Get-ChildItem -Recurse "src/verticals/Clients" -Include "*.jsx" | Select-String -Pattern "from\('client" | Select-Object Line | Sort-Object -Unique
```

The current codebase uses:
- `client_categories` ✔
- `client_billing_models` ✔ (NOTE: NOT `billing_models`)
- `client_services` ✔
- `clients` ✔

If your grep shows different names, use THOSE names in the service template below.

### Check if `useClients.js` hook exists and calls Supabase directly:
```powershell
Get-Content "src/hooks/useClients.js" | Select-Object -First 30
```
This hook likely calls Supabase directly. It must be updated in Step 4 of this runbook.

### Confirm services/clients directory doesn't exist yet:
```powershell
Get-ChildItem "src/services/clients" -ErrorAction SilentlyContinue
# Should return nothing
```

---

## Step 1 — Create directory

```powershell
mkdir src/services/clients
```

---

## Step 2 — Create `src/services/clients/clientService.js`

```js
/**
 * clientService.js
 * Stateless service for all Supabase CRUD operations on the 'clients' table
 * and related reference tables (client_categories, billing_models, services).
 *
 * Consuming components:
 *   - src/verticals/Clients/ClientManagement.jsx
 *   - src/verticals/Clients/ClientCategoryManagement.jsx
 *   - src/verticals/Clients/ClientBillingModelManagement.jsx
 *   - src/verticals/Clients/ClientServiceManagement.jsx
 *
 * Pattern mirrors: src/services/employees/employeeService.js
 * Canonical location: src/services/clients/clientService.js
 */
import { supabase } from '../core/supabaseClient';

// ─────────────────────────────────────────────────────────────────────────────
// SELECT strings (PostgREST)
// ─────────────────────────────────────────────────────────────────────────────

const CLIENT_SELECT = `
  *,
  client_categories(id, name),
  client_billing_models(id, name),
  client_services(id, name)
`;

// ─────────────────────────────────────────────────────────────────────────────
// Normalizer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * normalizeClient(row)
 * Maps a Supabase client row to the camelCase shape used in the app.
 */
const normalizeClient = (row) => ({
  id: row.id,
  name: row.name,
  email: row.email || null,
  phone: row.phone || null,
  address: row.address || null,
  city: row.city || null,
  categoryId: row.category_id || null,
  categoryName: row.client_categories?.name || null,
  billingModelId: row.billing_model_id || null,
  billingModelName: row.client_billing_models?.name || null,
  services: Array.isArray(row.client_services) ? row.client_services : [],
  status: row.status || 'active',
  notes: row.notes || null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  metadata: row.metadata || {},
});

/**
 * mapClientToRow(client)
 * Maps camelCase client shape back to DB snake_case for inserts/updates.
 */
const mapClientToRow = (client) => ({
  name: client.name,
  email: client.email || null,
  phone: client.phone || null,
  address: client.address || null,
  city: client.city || null,
  category_id: client.categoryId || null,
  billing_model_id: client.billingModelId || null,
  status: client.status || 'active',
  notes: client.notes || null,
  metadata: client.metadata || {},
});

// ─────────────────────────────────────────────────────────────────────────────
// Client CRUD
// ─────────────────────────────────────────────────────────────────────────────

export const clientService = {
  /**
   * getClients() — Fetch all clients with joined relations.
   * @returns {Array} Normalized client array.
   */
  async getClients() {
    const { data, error } = await supabase
      .from('clients')
      .select(CLIENT_SELECT)
      .order('name', { ascending: true });

    if (error) throw error;
    return (data || []).map(normalizeClient);
  },

  /**
   * getClientById(id) — Fetch a single client by ID.
   * @param {string} id
   * @returns {object} Normalized client.
   */
  async getClientById(id) {
    const { data, error } = await supabase
      .from('clients')
      .select(CLIENT_SELECT)
      .eq('id', id)
      .single();

    if (error) throw error;
    return normalizeClient(data);
  },

  /**
   * addClient(clientData) — Insert a new client record.
   * @param {object} clientData - camelCase client shape
   * @returns {object} Normalized created client.
   */
  async addClient(clientData) {
    const row = mapClientToRow(clientData);
    const { data, error } = await supabase
      .from('clients')
      .insert(row)
      .select(CLIENT_SELECT)
      .single();

    if (error) throw error;
    return normalizeClient(data);
  },

  /**
   * updateClient(id, clientData) — Update a client record.
   * @param {string} id
   * @param {object} clientData - camelCase partial or full client shape
   * @returns {object} Normalized updated client.
   */
  async updateClient(id, clientData) {
    const row = mapClientToRow(clientData);
    const { data, error } = await supabase
      .from('clients')
      .update(row)
      .eq('id', id)
      .select(CLIENT_SELECT)
      .single();

    if (error) throw error;
    return normalizeClient(data);
  },

  /**
   * deleteClient(id) — Permanently delete a client.
   * @param {string} id
   */
  async deleteClient(id) {
    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * searchClients(query) — Search clients by name (case-insensitive).
   * @param {string} query
   * @returns {Array} Matching normalized clients.
   */
  async searchClients(query) {
    const { data, error } = await supabase
      .from('clients')
      .select(CLIENT_SELECT)
      .ilike('name', `%${query}%`)
      .order('name', { ascending: true });

    if (error) throw error;
    return (data || []).map(normalizeClient);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Client Categories CRUD
// ─────────────────────────────────────────────────────────────────────────────

export const clientCategoryService = {
  async getCategories() {
    const { data, error } = await supabase
      .from('client_categories')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async addCategory(categoryData) {
    const { data, error } = await supabase
      .from('client_categories')
      .insert({ name: categoryData.name, description: categoryData.description || null })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async updateCategory(id, categoryData) {
    const { data, error } = await supabase
      .from('client_categories')
      .update({ name: categoryData.name, description: categoryData.description || null })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async deleteCategory(id) {
    const { error } = await supabase.from('client_categories').delete().eq('id', id);
    if (error) throw error;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Billing Models CRUD
// ─────────────────────────────────────────────────────────────────────────────

export const billingModelService = {
  async getBillingModels() {
    const { data, error } = await supabase
      .from('client_billing_models')  // ← correct table name
      .select('*')
      .order('name', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async addBillingModel(modelData) {
    const { data, error } = await supabase
      .from('client_billing_models')  // ← correct table name
      .insert({ name: modelData.name, description: modelData.description || null })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async updateBillingModel(id, modelData) {
    const { data, error } = await supabase
      .from('client_billing_models')  // ← correct table name
      .update({ name: modelData.name, description: modelData.description || null })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async deleteBillingModel(id) {
    const { error } = await supabase.from('client_billing_models').delete().eq('id', id);
    if (error) throw error;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Client Services CRUD
// ─────────────────────────────────────────────────────────────────────────────

export const clientServiceManager = {
  async getServices() {
    const { data, error } = await supabase
      .from('client_services')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async addService(serviceData) {
    const { data, error } = await supabase
      .from('client_services')
      .insert({ name: serviceData.name, description: serviceData.description || null })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async updateService(id, serviceData) {
    const { data, error } = await supabase
      .from('client_services')
      .update({ name: serviceData.name, description: serviceData.description || null })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async deleteService(id) {
    const { error } = await supabase.from('client_services').delete().eq('id', id);
    if (error) throw error;
  },
};
```

---

## Step 3 — Update Client Management components

For each component that currently calls `supabase.from('clients')` directly:

### Pattern to apply:

**BEFORE** (raw Supabase call in component):
```js
const { data, error } = await supabase
  .from('clients')
  .select('*, client_categories(id, name)')
  .order('name');
if (error) console.error(error);
setClients(data || []);
```

**AFTER** (using service):
```js
import { clientService } from '../../../services/clients/clientService';
// ...
const clients = await clientService.getClients();
setClients(clients);
```

### For `ClientManagement.jsx`:
Replace fetch calls with `clientService.getClients()`.
Replace create calls with `clientService.addClient(data)`.
Replace update calls with `clientService.updateClient(id, data)`.
Replace delete calls with `clientService.deleteClient(id)`.

### For `ClientCategoryManagement.jsx`:
Replace with `clientCategoryService.getCategories()`, `.addCategory()`, etc.

### For `ClientBillingModelManagement.jsx`:
Replace with `billingModelService.getBillingModels()`, `.addBillingModel()`, etc.

### For `ClientServiceManagement.jsx`:
Replace with `clientServiceManager.getServices()`, `.addService()`, etc.

---

## Step 4 — Update `src/hooks/useClients.js` (MANDATORY)

> ⚠️ `useClients.js` currently calls Supabase directly. `ClientManagement.jsx` uses
> this hook. This step is NOT optional.

Open `src/hooks/useClients.js` and read its current content:
```powershell
Get-Content "src/hooks/useClients.js"
```

The hook likely has a `fetchClients` function that calls `supabase.from('clients')`.
Update it to call `clientService.getClients()` instead:

```js
import { clientService } from '../services/clients/clientService';

// In fetchClients:
const clients = await clientService.getClients();
setClients(clients);
```

For category and billing model fetches inside `useClients.js`, similarly delegate to
`clientCategoryService.getCategories()` and `billingModelService.getBillingModels()`.

After updating `useClients.js`, remove the direct `supabase` import from it if it
is no longer needed:
```powershell
Get-ChildItem "src/hooks" -Filter "useClients.js" | Select-String -Pattern "supabase"
# Should return ZERO results after the update
```

---

## Step 5 — Verify table names exist in DB

The service uses these Supabase tables. Verify they match the actual codebase:
```powershell
Get-ChildItem -Recurse "src" -Include "*.jsx","*.js" | Select-String -Pattern "from\('client" | Select-Object Line | Sort-Object -Unique
```

Map the table names found to the service methods. If a table name in the codebase
differs from what's in the service template, update the service to match.

---

## Step 6 — Verification

```powershell
npm run build:staging
```

### Functional tests
1. Open **Client Management** → clients load from the service ✓
2. Add a new client → appears in the list ✓
3. Edit a client → updates correctly ✓
4. Delete a client → removed from list ✓
5. Open **Category Manager** → categories load ✓
6. Open **Service Manager** → services load ✓
7. Open **Billing Model Manager** → billing models load ✓

### Code quality check
```powershell
Get-ChildItem -Recurse "src/verticals/Clients" -Include "*.jsx" | Select-String -Pattern "supabase\.from" | Select-Object Filename, Line
# Should return ZERO results from management components
# (CSV tools and TaskForm may still use direct supabase — that is acceptable for now)
```

---

## Step 7 — Export from barrel

Add to `src/verticals/Clients/index.js` (created in RB-08) if clientService
is needed by components importing from the barrel:

Actually, services go in `src/services/`, not in the vertical barrel.
The barrel is only for components. No change to the barrel needed.

---

## Final Runbook Complete Checklist

After RB-12, verify the full refactor goals are met:

```powershell
# App.jsx should be under 300 lines:
(Get-Content "src/App.jsx").Count

# taskService.js should be under 400 lines:
(Get-Content "src/services/tasks/taskService.js").Count

# TaskListView.jsx should be under 250 lines (after ListViewRow extraction in RB-06):
(Get-Content "src/components/TaskListView.jsx").Count

# No raw supabase calls in client vertical:
Select-String -Recurse -Path "src/verticals/Clients" -Pattern "supabase\.from"

# No vertical ternary chains in App.jsx:
Select-String "src/App.jsx" -Pattern "HubSubSidebar|EmployeeSubSidebar"

# Build passes:
npm run build:staging
```

---

## Rollback

```powershell
# Remove the new service file
Remove-Item -Recurse src/services/clients/

# Restore client components from git
git checkout src/verticals/Clients/ClientManagement.jsx
git checkout src/verticals/Clients/ClientCategoryManagement.jsx
git checkout src/verticals/Clients/ClientBillingModelManagement.jsx
git checkout src/verticals/Clients/ClientServiceManagement.jsx
git checkout src/hooks/useClients.js
```

## Commit Checkpoint

```powershell
git add -A
git commit -m "refactor: RB-12 add clientService.js, migrate Clients vertical"
```
