# Runbook 4.1 — Template Service Extension

## Phase 4: Frontend API & State Management Updates
## Subphase 4.1: Extend `dailyTaskTemplateService.js`

---

## Objective

Update the frontend template service to:
1. Expose the new `senior_manager_id` and `has_sub_assignees` fields.
2. Add CRUD operations for `daily_task_template_subtasks` (sub-blueprints).
3. Include senior manager employee name in the normalized output.

---

## Prerequisites

- [ ] All Phase 1-3 runbooks complete and validated.
- [ ] Read [Development Best Practices](file:///c:/Users/villy/OneDrive/Documents/PowerPod%20New/Coding%20Practice/PowerProject/.agent/skills/development-best-practices/SKILL.md).

---

## Files Affected

| File | Action |
|---|---|
| `src/services/tasks/dailyTaskTemplateService.js` | MODIFY |

---

## Step 4.1.1: Update `normalizeTemplate`

### Current (lines 9-33):
```javascript
const normalizeTemplate = (row) => ({
  // ... existing fields
});
```

### Add these fields to the return object:
```javascript
seniorManagerId: row.senior_manager_id,
seniorManagerName: row.senior_manager?.full_name || null,
hasSubAssignees: row.has_sub_assignees || false,
subTaskBlueprints: (row.daily_task_template_subtasks || []).map(sub => ({
  id: sub.id,
  title: sub.title,
  description: sub.description,
  assignedTo: sub.assigned_to,
  assigneeName: sub.sub_assignee?.full_name || null,
  priority: sub.priority,
  sortOrder: sub.sort_order,
  isActive: sub.is_active,
})),
```

---

## Step 4.1.2: Update `mapTemplateToRow`

### Add to the returned `row` object:
```javascript
senior_manager_id: template.seniorManagerId || null,
has_sub_assignees: !!template.hasSubAssignees,
```

---

## Step 4.1.3: Update `TEMPLATE_SELECT`

### Current (line 63):
```javascript
const TEMPLATE_SELECT = '*, employees:assigned_to (full_name)';
```

### Change to:
```javascript
const TEMPLATE_SELECT = `
  *,
  employees:assigned_to (full_name),
  senior_manager:senior_manager_id (full_name),
  daily_task_template_subtasks (
    id, title, description, assigned_to, priority, sort_order, is_active,
    sub_assignee:assigned_to (full_name)
  )
`;
```

This uses Supabase's PostgREST embedded resource syntax:
- `senior_manager:senior_manager_id` joins `employees` via `senior_manager_id` FK.
- `daily_task_template_subtasks` auto-joins via the `parent_template_id` FK.
- `sub_assignee:assigned_to` inside the subtasks joins employees for each sub-blueprint.

---

## Step 4.1.4: Add Sub-Blueprint CRUD Methods

Add these methods to the `dailyTaskTemplateService` export object:

```javascript
// ── Sub-Task Blueprint CRUD ──────────────────────────────────

async getSubBlueprints(templateId) {
  const { data, error } = await supabase
    .from('daily_task_template_subtasks')
    .select('*, sub_assignee:assigned_to (full_name)')
    .eq('parent_template_id', templateId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data || []).map(sub => ({
    id: sub.id,
    parentTemplateId: sub.parent_template_id,
    title: sub.title,
    description: sub.description,
    assignedTo: sub.assigned_to,
    assigneeName: sub.sub_assignee?.full_name || null,
    priority: sub.priority,
    sortOrder: sub.sort_order,
    isActive: sub.is_active,
  }));
},

async addSubBlueprint(blueprintData, userId) {
  const row = {
    parent_template_id: blueprintData.parentTemplateId,
    title: blueprintData.title || 'Untitled Sub-Task',
    description: blueprintData.description || null,
    assigned_to: blueprintData.assignedTo || null,
    priority: blueprintData.priority || 'Medium',
    sort_order: blueprintData.sortOrder || 0,
    is_active: blueprintData.isActive !== undefined ? blueprintData.isActive : true,
    created_by: userId,
  };
  const { data, error } = await supabase
    .from('daily_task_template_subtasks')
    .insert([row])
    .select('*, sub_assignee:assigned_to (full_name)');
  if (error) throw error;
  return data[0];
},

async updateSubBlueprint(blueprintData) {
  const row = {
    title: blueprintData.title,
    description: blueprintData.description || null,
    assigned_to: blueprintData.assignedTo || null,
    priority: blueprintData.priority || 'Medium',
    sort_order: blueprintData.sortOrder || 0,
    is_active: blueprintData.isActive,
  };
  const { data, error } = await supabase
    .from('daily_task_template_subtasks')
    .update(row)
    .eq('id', blueprintData.id)
    .select('*, sub_assignee:assigned_to (full_name)');
  if (error) throw error;
  return data[0];
},

async deleteSubBlueprint(blueprintId) {
  const { error } = await supabase
    .from('daily_task_template_subtasks')
    .delete()
    .eq('id', blueprintId);
  if (error) throw error;
},
```

---

## Validation

### V4.1.1: Template fetch includes new fields
In browser console or a test component:
```javascript
const templates = await dailyTaskTemplateService.getTemplates();
console.log(templates[0]);
// Should include: seniorManagerId, seniorManagerName, hasSubAssignees, subTaskBlueprints
```

### V4.1.2: Sub-blueprint CRUD works
```javascript
// Create
const sub = await dailyTaskTemplateService.addSubBlueprint({
  parentTemplateId: 'SOME_TEMPLATE_ID',
  title: 'Test Sub-Blueprint',
}, userId);
console.log(sub); // Should have id

// Update
await dailyTaskTemplateService.updateSubBlueprint({ id: sub.id, title: 'Updated' });

// Delete
await dailyTaskTemplateService.deleteSubBlueprint(sub.id);
```

### V4.1.3: PostgREST join works
Verify the Supabase select string doesn't cause a 406 error. Common issues:
- Missing FK relationship → 406. Fix: ensure FKs exist and `NOTIFY pgrst` was run.
- Ambiguous FK → 406. Fix: use explicit `table:column` syntax (which we do).

---

## Next → [Runbook 4.2: Daily Task Service Extension](./08_DAILY_TASK_SERVICE.md)
