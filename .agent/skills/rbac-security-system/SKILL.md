---
name: RBAC Security System
description: Core rules for enforcing Role-Based Access Control (RBAC). Standardizes database RLS policies and frontend UI guards across all verticals and management modules. 
---

# RBAC Security System

All features and verticals in PowerProject MUST adhere to this Role-Based Access Control (RBAC) system to ensure data integrity and security.

## 1. Role Definitions & Permissions
We use four standard capability levels, mapped to both global (Master) and vertical (Assigned) scopes.

| Level | Capability | canCreate | canRead | canUpdate | canDelete |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Admin** | Full CRUD | ✅ | ✅ | ✅ | ✅ |
| **Editor** | Read + Create + Update | ✅ | ✅ | ✅ | ❌ |
| **Contributor** | Read + Create (CR Only) | ✅ | ✅ | ❌ | ❌ |
| **Viewer** | Read Only | ❌ | ✅ | ❌ | ❌ |

---

## 2. Frontend Implementation (UI Guards)
Every management component and data-entry interface MUST use the `permissions` object derived in `App.jsx`.

### Guarding Action Buttons
Buttons that trigger data modification MUST be conditionally rendered.

// 1. Vertical-Level Guard (Deprecated for specific features)
{permissions.canCreate && (
  <button onClick={handleAdd}>+ Add New</button>
)}

// 2. Feature-Level Guard (RECOMMENDED)
// Use specific flags computed in App.jsx (e.g., canCreateClients, canCreateEmployees)
{permissions.canCreateClients && (
  <button onClick={handleAddClient}>+ Add Client</button>
)}
```

### Effective Permission Logic
Effective permissions for a feature are the **intersection** (minimum) of the Vertical-Level access and the Feature-Level access.
- If Vertical = **Viewer**, all features in that vertical are restricted to Read-Only.
- If Vertical = **Admin**, but Feature = **Viewer**, that specific feature is restricted to Read-Only.

```javascript
// App.jsx Logic
const effectiveCanCreate = verticalCaps.canCreate && featureCaps.canCreate;
```

### Prop Drilling Standard
Pass the `permissions` object from `App.jsx` down to all management views, cards, and list rows.
- **Management View**: Receives `{ permissions }`.
- **Card/Row Component**: Receives `{ permissions }`.
    - **Note**: When passing to shallow components (Cards/Rows), you can override the generic `canUpdate` with the feature-specific one for legacy compatibility:
    ```jsx
    <EmployeeCard 
      permissions={{ ...permissions, canUpdate: permissions.canUpdateEmployees }} 
    />
    ```

---

## 3. Granular Feature-Level RBAC
PowerProject supports overrides for individual features within a vertical (e.g., "Clients List", "Client Tasks").

### Feature Flags in App.jsx
The `permissions` object includes:
1.  **Visibility Flag**: `canAccessClients` (boolean) - Gating the sidebar/navigation.
2.  **CRUD Flags**: `canCreateClients`, `canReadClients`, `canUpdateClients`, `canDeleteClients`.

### Guarding Management Views
At the top of each management component, implement a hard guard:
```jsx
const ClientManagement = ({ permissions }) => {
  if (!permissions.canAccessClients) return <NoAccessMessage />;
  // ...
}
```

## 3. Database Implementation (RLS Policies)
Row Level Security (RLS) MUST be enabled on every table. Policies MUST use the `public.get_user_permission_level(vertical_id)` helper function.

### Standard RLS Pattern
Use this SQL template for all new tables:

```sql
-- 1. Enable RLS
ALTER TABLE public.your_table_name ENABLE ROW LEVEL SECURITY;

-- 2. Define Policies
-- SELECT: All roles
CREATE POLICY "Permit SELECT based on role" ON public.your_table_name 
FOR SELECT USING (public.get_user_permission_level('VERTICAL_ID') IN ('viewer', 'contributor', 'editor', 'admin'));

-- INSERT: Contributor and above
CREATE POLICY "Permit INSERT based on role" ON public.your_table_name 
FOR INSERT WITH CHECK (public.get_user_permission_level('VERTICAL_ID') IN ('contributor', 'editor', 'admin'));

-- UPDATE: Editor and above
CREATE POLICY "Permit UPDATE based on role" ON public.your_table_name 
FOR UPDATE USING (public.get_user_permission_level('VERTICAL_ID') IN ('editor', 'admin'))
WITH CHECK (public.get_user_permission_level('VERTICAL_ID') IN ('editor', 'admin'));

-- DELETE: Admin only
CREATE POLICY "Permit DELETE based on role" ON public.your_table_name 
FOR DELETE USING (public.get_user_permission_level('VERTICAL_ID') = 'admin');
```

---

## 4. Configuration Guarding
The System Configuration panel and its management tiles MUST be restricted.
- **General Management Tiles**: Require `permissions.canAccessConfig`.
- **User/Role Management**: Require `permissions.canManageRoles`.

---

## 5. Deployment Checklist
When building a new vertical or feature:
1. [ ] Enable RLS on the new table(s).
2. [ ] Apply the 4 standard policies (SELECT, INSERT, UPDATE, DELETE).
3. [ ] Update `App.jsx` to pass `permissions` to the new view.
4. [ ] Implement UI guards in the new view (Buttons, Imports, Modals).
5. [ ] Verify as both 'Viewer' and 'Admin'.
