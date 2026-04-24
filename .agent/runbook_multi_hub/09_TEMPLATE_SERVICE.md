# Runbook 5.2 — Update Template Service for Multi-Hub Dispatching

## Phase 5: Frontend Services
## Subphase 5.2: Hardening `dailyTaskTemplateService.js` for Fan-Out Logic

---

## 1. Objective & Deep Architectural Logic

This runbook transforms the `dailyTaskTemplateService` into a **Metadata-Driven Dispatcher**. In the new Multi-Hub architecture, a template is not just a row; it is a "Control Hub" that manages how tasks are projected across the organization.

### 1.1 The "Why": Solving the N+1 Template Problem
In the legacy system, if a manager wanted a "Cleaning Check" for 10 hubs, they had to create 10 identical templates. This made maintenance impossible.
The new model allows **1 Template -> N Hubs**.

### 1.2 The "How": Junction Links with Payload
We leverage `task_context_links` (TCL) to link templates to hubs. However, simply linking isn't enough. Different hubs might have different staff. 
**The Solution**: We use the `metadata` column in the junction table to store **per-hub assignee overrides**.

### 1.3 Logical Data Flow
```mermaid
graph TD
    UI[Template Form] -->|Saves Hub UUIDs + Assignee UUIDs| Service[dailyTaskTemplateService]
    Service -->|Update Scalar Columns| Tbl_T[daily_task_templates]
    Service -->|Sync Links with Metadata| Tbl_TCL[task_context_links]
    Tbl_TCL -->|Stores| Meta[JSONB Metadata: {assignee_ids: []}]
    Generator[Fan-Out Generator] -->|Reads Template + Links| TaskSpawn[Task Creation]
```

---

## 2. Prerequisites & Safety Checks

> [!IMPORTANT]
> This runbook is strictly dependent on Phase 4 (Database Layer). The `task_context_links` table MUST have the `metadata` (jsonb) and `is_active` (boolean) columns.

### V5.2.0: Deep Schema Validation
Execute this in the Supabase SQL Editor to ensure the frontend has a stable target:
```sql
DO $$ 
BEGIN
    ASSERT (SELECT count(*) FROM information_schema.columns WHERE table_name = 'daily_task_templates' AND column_name = 'senior_manager_id') = 1, 'Missing senior_manager_id';
    ASSERT (SELECT count(*) FROM information_schema.columns WHERE table_name = 'task_context_links' AND column_name = 'metadata') = 1, 'Missing metadata in TCL';
END $$;
```

---

## 3. Implementation Step-by-Step

### Step 3.1: Update Global Constants & Select String
**File**: `src/services/tasks/dailyTaskTemplateService.js` (Around Line 63)

We must expand the `TEMPLATE_SELECT` to include the computed `hubs()` relationship and the `senior_manager` join. This allows the UI to show "Linked Hubs" and "Manager Name" without extra API calls.

```javascript
// FIND:
const TEMPLATE_SELECT = '*, employees:assigned_to (full_name)';

// REPLACE WITH:
/**
 * Standard select string for templates.
 * - hubs: Uses the computed PostgREST relationship from Runbook 1.1.
 * - senior_manager: Join to user_profiles for governance visibility.
 */
const TEMPLATE_SELECT = `
  *,
  employees:assigned_to (full_name),
  hubs(id, name, hub_code, city),
  senior_manager:senior_manager_id (id, full_name)
`;
```

---

### Step 3.2: Deep Refactor of `normalizeTemplate`
**File**: `src/services/tasks/dailyTaskTemplateService.js` (Lines 9-33)

This function transforms the flat database row into a rich, camelCased JavaScript object.

#### Logic to Implement:
1.  **Hub Resolution**: Convert the `row.hubs` array into UI-ready fields (`hub_ids`, `hubNames`).
2.  **Seniority Mapping**: Map the `senior_manager` join data.
3.  **Fallback Logic**: Maintain `subjectId` for backward compatibility with older UI components.

```javascript
const normalizeTemplate = (row) => {
  if (!row) return null;

  // PostgREST returns an array for the computed 'hubs' relationship
  const hubData = Array.isArray(row.hubs) ? row.hubs : (row.hubs ? [row.hubs] : []);

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    verticalId: row.vertical_id,
    
    // --- MULTI-HUB SUPPORT ---
    hub_id: row.hub_id,                           // Scalar primary (legacy)
    hub_ids: hubData.map(h => h.id),              // Array of UUIDs for multi-select
    hubNames: hubData.map(h => h.name),           // Array of Names for display
    hubData: hubData,                             // Full objects for detailed views
    
    // --- BACKWARD COMPATIBILITY ---
    client_id: row.client_id,
    employee_id: row.employee_id,
    subjectId: row.hub_id || row.client_id || row.employee_id || row.partner_id || row.vendor_id,
    
    city: row.city,
    functionName: row.function_name,
    frequency: row.frequency,
    frequencyDetails: row.frequency_details,
    timeOfDay: row.time_of_day,
    
    // --- ASSIGNEES & GOVERNANCE ---
    assignedTo: row.assigned_to || [],            // Default assignees (scalar fallback)
    assigneeName: row.employees?.full_name,
    seniorManagerId: row.senior_manager_id,       // The "Umbrella" owner
    seniorManagerName: row.senior_manager?.full_name || null,
    
    // --- LOGIC FLAGS ---
    isActive: row.is_active,
    priority: row.priority || 'Medium',
    hasSubAssignees: row.has_sub_assignees || false, // Mode 2: Multi-Assignee
    
    // --- AUDIT ---
    uploadLink: row.upload_link,
    lastRunAt: row.last_run_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    lastUpdatedBy: row.last_updated_by,
  };
};
```

---

### Step 3.3: Extend `mapTemplateToRow` for Persistence
**File**: `src/services/tasks/dailyTaskTemplateService.js` (Lines 35-61)

This function prepares the data for the `INSERT` or `UPDATE` call. We must add the new structural columns.

```javascript
const mapTemplateToRow = (template) => {
  // ... existing vertical/subject mapping logic ...

  return {
    title: template.title || 'Untitled Template',
    description: template.description || null,
    vertical_id: template.verticalId,
    frequency: template.frequency || 'DAILY',
    frequency_details: template.frequencyDetails || null,
    time_of_day: template.timeOfDay || '08:00:00',
    assigned_to: Array.isArray(template.assignedTo) ? template.assignedTo : (template.assignedTo ? [template.assignedTo] : []),
    is_active: template.isActive !== undefined ? template.isActive : true,
    
    // NEW COLUMNS
    senior_manager_id: template.seniorManagerId || null,
    priority: template.priority || 'Medium',
    has_sub_assignees: !!template.hasSubAssignees,
    
    // LEGACY MAPPING (Keep existing if-else for client/employee/hub)
    city: template.city || null,
    function_name: template.functionName || null,
  };
};
```

---

### Step 3.4: Implement the "Sync Brain" (Internal Helpers)
Add these two functions **OUTSIDE** the main export object (after `mapTemplateToRow`) to handle the complex junction table logic.

#### A. `syncTemplateHubs` (The Multi-Hub Linker)
This handles the **Delete-then-Insert** strategy for all hub links, including the JSONB assignee overrides.

```javascript
/**
 * Synchronizes multi-hub links with per-hub assignee metadata.
 * @param {string} templateId 
 * @param {Array} hubConfigs - [{ hubId: string, assigneeIds: string[] }]
 */
const syncTemplateHubs = async (templateId, hubConfigs) => {
  if (!templateId) return;

  // 1. Purge existing Hub links for this template
  const { error: delError } = await supabase
    .from('task_context_links')
    .delete()
    .match({ source_id: templateId, source_type: 'template', entity_type: 'hub' });

  if (delError) throw delError;

  // 2. Insert new configurations with metadata
  if (hubConfigs && hubConfigs.length > 0) {
    const rows = hubConfigs.map(hc => ({
      source_id: templateId,
      source_type: 'template',
      entity_type: 'hub',
      entity_id: hc.hubId,
      is_active: true,
      metadata: { 
        assignee_ids: hc.assigneeIds || [] // CRITICAL: This is used by the PL/pgSQL generator
      }
    }));

    const { error: insError } = await supabase
      .from('task_context_links')
      .insert(rows);
    if (insError) throw insError;
  }
};
```

#### B. `syncTemplateAssignees` (Mode 2 Support)
This handles the "Standard" assignees linked to the template (for Mode 2: Multi-Assignee fan-out).

```javascript
/**
 * Synchronizes template-level assignee links.
 * @param {string} templateId 
 * @param {string[]} assigneeIds 
 */
const syncTemplateAssignees = async (templateId, assigneeIds) => {
  if (!templateId) return;

  await supabase
    .from('task_context_links')
    .delete()
    .match({ source_id: templateId, source_type: 'template', entity_type: 'assignee' });

  if (assigneeIds && assigneeIds.length > 0) {
    const rows = assigneeIds.map(aid => ({
      source_id: templateId,
      source_type: 'template',
      entity_type: 'assignee',
      entity_id: aid,
      is_active: true
    }));
    const { error } = await supabase.from('task_context_links').insert(rows);
    if (error) throw error;
  }
};
```

---

### Step 3.5: Update the `dailyTaskTemplateService` Export Object
Add these methods to the exported service object.

```javascript
export const dailyTaskTemplateService = {
  // ... existing getTemplates ...

  /**
   * Fetches the hub-assignee configuration matrix for a template.
   * Returns: [{ hubId, assigneeIds }]
   */
  async getTemplateHubConfigs(templateId) {
    const { data, error } = await supabase
      .from('task_context_links')
      .select('entity_id, metadata')
      .eq('source_id', templateId)
      .eq('source_type', 'template')
      .eq('entity_type', 'hub');

    if (error) throw error;
    return (data || []).map(d => ({
      hubId: d.entity_id,
      assigneeIds: d.metadata?.assignee_ids || []
    }));
  },

  async addTemplate(templateData, userId) {
    // 1. Insert base template
    const row = { ...mapTemplateToRow(templateData), created_by: userId, last_updated_by: userId };
    const { data, error } = await supabase.from('daily_task_templates').insert([row]).select(TEMPLATE_SELECT);
    if (error) throw error;
    const saved = normalizeTemplate(data[0]);

    // 2. Sync Hub Links (Mode 3)
    if (templateData.hubConfigs) {
      await syncTemplateHubs(saved.id, templateData.hubConfigs);
    }
    // 3. Sync Template Assignees (Mode 2)
    if (templateData.assigneeIds) {
      await syncTemplateAssignees(saved.id, templateData.assigneeIds);
    }

    return saved;
  },

  async updateTemplate(templateData, userId) {
     // ... same pattern as addTemplate (Sync Hubs & Assignees after update) ...
  },
  
  // ... existing toggleStatus, deleteTemplate ...
};
```

---

## 4. Deep-Level Verification & Integration Tests

### V5.2.1: Data Persistence Test (Console)
Execute this snippet in the browser console. It simulates a **Mode 3 (Multi-Hub)** save with overrides.

```javascript
// Test Payload
const testTemplate = {
  title: 'Test Fan-Out Template',
  verticalId: 'CHARGING_HUBS',
  hubConfigs: [
    { hubId: 'HUB_1_UUID', assigneeIds: ['USER_A_UUID'] },
    { hubId: 'HUB_2_UUID', assigneeIds: ['USER_B_UUID', 'USER_C_UUID'] }
  ]
};

const result = await dailyTaskTemplateService.addTemplate(testTemplate, 'MY_USER_ID');
console.log('Saved Template:', result);

// Verify Links
const links = await dailyTaskTemplateService.getTemplateHubConfigs(result.id);
console.log('Saved Hub Matrix:', links);
```

**Expected Result**:
- `result.hub_ids` contains both Hub UUIDs.
- `links` array has 2 objects, each with their respective `assigneeIds`.

---

## 5. Next Step → [Runbook 5.3: Retire Daily Task Service](./10_RETIRE_DAILY_SERVICE.md)
