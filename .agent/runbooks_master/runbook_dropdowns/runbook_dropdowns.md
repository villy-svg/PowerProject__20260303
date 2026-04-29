# Multi-Select Dropdown Centralization Runbook

This runbook outlines our step-by-step blueprint for upgrading existing dropdown instances to the standardized, high-density `<CustomMultiSelect>` interface.

---

## 1. The Master Implementation Plan

### Component Architecture
`<CustomMultiSelect>` consolidates overlapping dropdown behavior safely:
* Dynamic search triggers
* Array-based value hooks
* "Select All" toggles

### Component API Specs
| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `id` | `string` | `undefined` | Target ID selector |
| `value` | `any[]` | `[]` | Selected indices |
| `onChange` | `(values) => void` | `required` | State triggers |
| `options` | `object[]` | `[]` | Option definitions |
| `enableSelectAll` | `boolean` | `false` | Controls utility layout |
| `renderOption` | `function` | `null` | Bespoke badge overrides |
| `customLabelFormatter`| `function` | `null` | Dynamic descriptions |
| `filterOption` | `function` | `null` | Search criteria logic |
| `isLoading` | `boolean` | `false` | Visual buffers |
| `emptyState` | `ReactNode` | `null` | Default fallbacks |

---

## 2. Migration Checklist

Execute refactorings sequentially to verify visual consistency:

### Phase 1: Multi-Select Controls
- [ ] [HubSelector.jsx](file:///c:/Users/villy/OneDrive/Documents/PowerPod%20New/Coding%20Practice/PowerProject/src/verticals/ChargingHubs/HubSelector.jsx)
- [ ] [AssigneeSelector.jsx](file:///c:/Users/villy/OneDrive/Documents/PowerPod%20New/Coding%20Practice/PowerProject/src/components/AssigneeSelector.jsx)

### Consumer Validation
- [ ] [HubTaskForm.jsx](file:///c:/Users/villy/OneDrive/Documents/PowerPod%20New/Coding%20Practice/PowerProject/src/verticals/ChargingHubs/HubTaskForm.jsx)
- [ ] [EmployeeTaskForm.jsx](file:///c:/Users/villy/OneDrive/Documents/PowerPod%20New/Coding%20Practice/PowerProject/src/verticals/Employees/EmployeeTaskForm.jsx)
- [ ] [ClientTaskForm.jsx](file:///c:/Users/villy/OneDrive/Documents/PowerPod%20New/Coding%20Practice/PowerProject/src/verticals/Clients/ClientTaskForm.jsx)
- [ ] [DailyTasksManagement.jsx](file:///c:/Users/villy/OneDrive/Documents/PowerPod%20New/Coding%20Practice/PowerProject/src/verticals/ChargingHubs/DailyTasksManagement.jsx)

### Phase 2: Single-Select Overhauls (Secondary Targets)
- [ ] [TaskHierarchySelector.jsx](file:///c:/Users/villy/OneDrive/Documents/PowerPod%20New/Coding%20Practice/PowerProject/src/components/TaskHierarchySelector.jsx)
- [ ] [EmployeeFormSections.jsx](file:///c:/Users/villy/OneDrive/Documents/PowerPod%20New/Coding%20Practice/PowerProject/src/verticals/Employees/EmployeeFormSections.jsx)
- [ ] [HubManagement.jsx](file:///c:/Users/villy/OneDrive/Documents/PowerPod%20New/Coding%20Practice/PowerProject/src/verticals/ChargingHubs/HubManagement.jsx)
- [ ] [ClientForm.jsx](file:///c:/Users/villy/OneDrive/Documents/PowerPod%20New/Coding%20Practice/PowerProject/src/verticals/Clients/ClientForm.jsx)
