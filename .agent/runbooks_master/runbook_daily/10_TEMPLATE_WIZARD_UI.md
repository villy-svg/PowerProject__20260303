# Runbook 5.1 — Template Wizard Sub-Task Configuration

## Phase 5: Frontend UI/UX Implementation
## Subphase 5.1: Update the template creation/edit wizard

---

## Objective

Update `DailyTasksManagement.jsx` to add:
1. A **Senior Manager** selector field.
2. A **Has Sub-Assignees** toggle.
3. A **Sub-Task Blueprints** inline editor (add/edit/remove sub-task rows) that appears when the toggle is ON.
4. All changes persisted via the updated `dailyTaskTemplateService`.

---

## Prerequisites

- [ ] [Runbook 4.1](./07_TEMPLATE_SERVICE.md) complete (service layer ready).
- [ ] Read [UI Design System](file:///c:/Users/villy/OneDrive/Documents/PowerPod%20New/Coding%20Practice/PowerProject/.agent/skills/ui-design-system/SKILL.md).
- [ ] Read [Master Page Header System](file:///c:/Users/villy/OneDrive/Documents/PowerPod%20New/Coding%20Practice/PowerProject/.agent/skills/master-header-system/SKILL.md).

---

## Files Affected

| File | Action |
|---|---|
| `src/verticals/ChargingHubs/DailyTasksManagement.jsx` | MODIFY |
| `src/verticals/ChargingHubs/DailyTasksManagement.css` | MODIFY |

---

## Step 5.1.1: Extend Form State

### Current formData (line 28-38):
Add these fields to the initial state:

```javascript
const [formData, setFormData] = useState({
  // ... existing fields ...
  seniorManagerId: '',       // NEW
  hasSubAssignees: false,    // NEW
});

// NEW: Sub-blueprint local state (managed separately from template form)
const [subBlueprints, setSubBlueprints] = useState([]);
const [newSubTitle, setNewSubTitle] = useState('');
const [newSubAssignee, setNewSubAssignee] = useState('');
const [newSubPriority, setNewSubPriority] = useState('Medium');
```

---

## Step 5.1.2: Load Sub-Blueprints on Edit

### In `handleOpenModal` (line 75), when editing:

```javascript
if (template) {
  // ... existing setFormData ...
  setFormData({
    // ... existing fields ...
    seniorManagerId: template.seniorManagerId || '',
    hasSubAssignees: template.hasSubAssignees || false,
  });

  // Load sub-blueprints from the template's embedded data
  setSubBlueprints(template.subTaskBlueprints || []);
} else {
  // ... existing reset ...
  setSubBlueprints([]);
}
```

---

## Step 5.1.3: Add UI Elements to the Modal Form

### After the "Template Status" checkbox (around line 404), add:

```jsx
{/* ── Senior Manager & Sub-Task Section ── */}
<div className="form-row-grid hierarchy-section">
  <div className="form-group">
    <label>Senior Manager (Overseer)</label>
    <AssigneeSelector
      value={formData.seniorManagerId}
      onChange={(val) => setFormData({...formData, seniorManagerId: val})}
      currentUser={currentUser}
      placeholder="Select senior manager..."
    />
  </div>

  <div className="form-group">
    <label>Enable Sub-Task Hierarchy</label>
    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
      <label
        style={{display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer'}}
        onClick={() => setFormData({...formData, hasSubAssignees: !formData.hasSubAssignees})}
      >
        <div className={`selection-checkbox ${formData.hasSubAssignees ? 'checked' : ''}`}>
          {formData.hasSubAssignees && '✓'}
        </div>
        <span style={{ fontSize: '0.9rem', opacity: 0.9 }}>
          {formData.hasSubAssignees ? 'Sub-Tasks Enabled' : 'No Sub-Tasks'}
        </span>
      </label>
    </div>
  </div>
</div>

{/* ── Sub-Task Blueprints Editor ── */}
{formData.hasSubAssignees && (
  <div className="sub-blueprints-section">
    <h4>Sub-Task Blueprints</h4>
    <p className="section-hint">
      These will be auto-generated as child tasks whenever this template fires.
    </p>

    {/* Existing blueprints list */}
    {subBlueprints.map((sub, idx) => (
      <div key={sub.id || idx} className="sub-blueprint-row">
        <span className="sub-order">{idx + 1}</span>
        <span className="sub-title">{sub.title}</span>
        <span className="sub-priority v-tag">{sub.priority}</span>
        <span className="sub-assignee">
          {sub.assigneeName || 'Unassigned'}
        </span>
        <button
          type="button"
          className="icon-btn delete"
          onClick={() => {
            setSubBlueprints(prev => prev.filter((_, i) => i !== idx));
          }}
        >×</button>
      </div>
    ))}

    {/* Add new sub-blueprint inline */}
    <div className="sub-blueprint-add-row">
      <input
        type="text"
        placeholder="Sub-task title..."
        value={newSubTitle}
        onChange={(e) => setNewSubTitle(e.target.value)}
      />
      <select
        className="master-dropdown"
        value={newSubPriority}
        onChange={(e) => setNewSubPriority(e.target.value)}
      >
        <option value="Low">Low</option>
        <option value="Medium">Medium</option>
        <option value="High">High</option>
        <option value="Urgent">Urgent</option>
      </select>
      <AssigneeSelector
        value={newSubAssignee}
        onChange={setNewSubAssignee}
        currentUser={currentUser}
      />
      <button
        type="button"
        className="halo-button"
        disabled={!newSubTitle.trim()}
        onClick={() => {
          setSubBlueprints(prev => [...prev, {
            title: newSubTitle.trim(),
            assignedTo: newSubAssignee || null,
            priority: newSubPriority,
            sortOrder: prev.length,
            isActive: true,
          }]);
          setNewSubTitle('');
          setNewSubAssignee('');
          setNewSubPriority('Medium');
        }}
      >+ Add</button>
    </div>
  </div>
)}
```

---

## Step 5.1.4: Update `handleSubmit` to Save Sub-Blueprints

### After the template save succeeds:

```javascript
const handleSubmit = async (e) => {
  e.preventDefault();
  setLoading(true);
  try {
    const { data: { user } } = await supabase.auth.getUser();

    let savedTemplate;
    if (ui.editingItem) {
      savedTemplate = await dailyTaskTemplateService.updateTemplate(
        { ...formData, id: ui.editingItem.id }, user.id
      );
    } else {
      savedTemplate = await dailyTaskTemplateService.addTemplate(formData, user.id);
    }

    // ── Save sub-blueprints ──────────────────────────────────
    if (formData.hasSubAssignees && savedTemplate) {
      // Strategy: Delete existing, re-insert all (simple, atomic)
      if (ui.editingItem) {
        // Fetch existing blueprints to get their IDs for deletion
        const existing = await dailyTaskTemplateService.getSubBlueprints(savedTemplate.id);
        for (const bp of existing) {
          await dailyTaskTemplateService.deleteSubBlueprint(bp.id);
        }
      }
      // Insert all current blueprints
      for (let i = 0; i < subBlueprints.length; i++) {
        await dailyTaskTemplateService.addSubBlueprint({
          parentTemplateId: savedTemplate.id,
          title: subBlueprints[i].title,
          description: subBlueprints[i].description || null,
          assignedTo: subBlueprints[i].assignedTo || null,
          priority: subBlueprints[i].priority || 'Medium',
          sortOrder: i,
          isActive: subBlueprints[i].isActive !== false,
        }, user.id);
      }
    }

    setStatusMsg({ type: 'success', text: ui.editingItem ? 'Template updated!' : 'Template created!' });
    setTimeout(() => { ui.closeModal(); fetchTemplates(); }, 1000);
  } catch (err) {
    // ... existing error handling ...
  } finally {
    setLoading(false);
  }
};
```

---

## Step 5.1.5: Update Grid/List Cards to Show Hierarchy Info

### In the grid card (around line 241), add after the template-meta div:

```jsx
{template.hasSubAssignees && (
  <div className="template-hierarchy-badge">
    <span className="v-tag hierarchy">
      👥 {template.subTaskBlueprints?.length || 0} Sub-Tasks
    </span>
    {template.seniorManagerName && (
      <span className="senior-mgr-label">
        Manager: {template.seniorManagerName}
      </span>
    )}
  </div>
)}
```

### In the list view, add a new column header "Hierarchy" and cell:
```jsx
<td>
  {template.hasSubAssignees
    ? `👥 ${template.subTaskBlueprints?.length || 0} subs`
    : '—'}
</td>
```

---

## Step 5.1.6: CSS for Sub-Blueprint Editor

Add to `DailyTasksManagement.css`:

```css
.sub-blueprints-section {
  border-top: 1px solid var(--border-color);
  padding-top: 1rem;
  margin-top: 1rem;
}
.sub-blueprints-section h4 {
  margin: 0 0 4px 0;
  font-size: 0.85rem;
  color: var(--brand-green);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.section-hint {
  font-size: 0.75rem;
  opacity: 0.6;
  margin-bottom: 0.75rem;
}
.sub-blueprint-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem;
  border-radius: 6px;
  background: var(--card-bg);
  margin-bottom: 0.5rem;
}
.sub-order {
  font-size: 0.7rem;
  opacity: 0.5;
  min-width: 20px;
}
.sub-title { flex: 1; font-size: 0.85rem; }
.sub-assignee { font-size: 0.8rem; opacity: 0.7; }
.sub-blueprint-add-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-top: 0.5rem;
}
.sub-blueprint-add-row input { flex: 1; }
.template-hierarchy-badge {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-top: 0.5rem;
}
.senior-mgr-label {
  font-size: 0.75rem;
  opacity: 0.7;
}
.hierarchy-section { border-top: 1px dashed var(--border-color); padding-top: 1rem; }
```

---

## Validation

### V5.1.1: Modal renders new fields
1. Open the template creation modal.
2. Verify Senior Manager selector appears.
3. Verify Has Sub-Assignees toggle appears and defaults to OFF.

### V5.1.2: Toggle reveals sub-task editor
1. Turn ON the Has Sub-Assignees toggle.
2. Verify the sub-task blueprints section appears.
3. Add 2-3 sub-tasks with different priorities and assignees.

### V5.1.3: Save and reload
1. Create a template with sub-tasks.
2. Close the modal.
3. Re-open the template for editing.
4. Verify sub-tasks are loaded and displayed correctly.

### V5.1.4: Grid/list show hierarchy badge
1. View templates in grid mode.
2. Verify the hierarchy badge shows "👥 N Sub-Tasks" for templates with sub-tasks.
3. Switch to list view and verify the Hierarchy column.

---

## Next → [Runbook 5.2: Board Nesting UI](./11_BOARD_NESTING_UI.md)
