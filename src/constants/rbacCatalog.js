/**
 * src/constants/rbacCatalog.js
 *
 * SINGLE SOURCE OF TRUTH for all RBAC tooltip descriptions, Master role
 * capabilities, Scope/Level card explanations, and BoardRBACModal label
 * normalization across PowerProject.
 *
 * GOVERNANCE RULE (.agent/rules/rbac-and-security.md §6 & rbac-documentation-sync skill):
 * Whenever ANY RBAC flag, RLS policy, RPC authorization check, Sphere of Influence
 * rule, Maker-Checker rule, or role-specific override changes anywhere in the
 * codebase, THIS FILE MUST BE UPDATED IN THE SAME CHANGE to prevent drift
 * between actual permissions and what Master Admins see in tooltips.
 */

/* --------------------------------------------------------------------------
   Base badge metadata per permission level / scope
   -------------------------------------------------------------------------- */
export const ROLE_BASE = {
  none:        { headline: 'No Access',            color: 'var(--text-color)' },
  viewer:      { headline: 'Read-Only Access',     color: 'var(--brand-blue)' },
  contributor: { headline: 'Read + Create',        color: 'var(--brand-emerald)' },
  editor:      { headline: 'Read + Create + Edit', color: 'var(--brand-amber)' },
  admin:       { headline: 'Full Access',          color: 'var(--priority-urgent)' },
  // inherit: used for the I button in feature-level modals — clears any explicit override
  inherit:     { headline: 'Inherited Access',     color: 'var(--brand-blue)' },
  // Scope badges for Step 1 of UserEditorModal
  master:      { headline: 'Global Access Scope',  color: 'var(--brand-amber)' },
  vertical:    { headline: 'Assigned Scope Only',  color: 'var(--brand-blue)' },
};

/* --------------------------------------------------------------------------
   Step 1: Scope Card Descriptions (UserEditorModal)
   -------------------------------------------------------------------------- */
export const SCOPE_ACCESS = {
  master: {
    can: [
      'Automatic access to all unlocked verticals & features at the chosen Capability Level',
      'Bypasses Sphere of Influence (Seniority ≤ 6) on task & remark visibility',
      'Master Admin also unlocks System Configuration, User/Role Management & overrides',
    ],
    cannot: [
      'Cannot restrict individual verticals or features (all unlocked boards inherit the global level)',
    ],
    summary: 'Best for executives, org-wide auditors, or system administrators who need uniform access across every vertical.',
  },
  vertical: {
    can: [
      'Granular per-vertical and per-feature access configured in Step 3',
      'Capability Level in Step 2 acts as the maximum ceiling for all verticals & features',
      'Feature overrides are capped by their parent vertical level (intersection)',
    ],
    cannot: [
      'Cannot manage Users/Roles (Master Admin only)',
      'Junior staff (Seniority ≤ 6) remain subject to Sphere of Influence on task boards',
    ],
    summary: 'Standard scope for department staff, supervisors, and vertical managers.',
  },
};

/* --------------------------------------------------------------------------
   Step 2 (when Scope = Vertical): Capability Level Ceiling Descriptions
   -------------------------------------------------------------------------- */
export const LEVEL_CARD_ACCESS = {
  viewer: {
    can: [
      'Caps all assigned verticals & features at Viewer (Read-Only)',
      'Allows self-service attendance check-in/out & self-only bank update requests (if Employees assigned)',
      'Allows raising Escalations (if Hubs assigned)',
    ],
    cannot: [
      'Cannot be granted Contributor, Editor, or Admin on any vertical or feature',
      'Cannot access System Configuration or User/Role Management',
    ],
    summary: 'Strict read-only ceiling for field staff or read-only stakeholders.',
  },
  contributor: {
    can: [
      'Allows verticals & features to be set up to Contributor (Read + Create)',
      'Unlocks Live Attendance monitoring & Attendance Edit Maker for downward reportees (Employees)',
      'Allows creating tasks, remarks, and onboarding new employees',
    ],
    cannot: [
      'Cannot be granted Editor or Admin on any vertical or feature',
      'Cannot edit existing records (except field-restricted edits on own/assigned tasks) or approve requests',
    ],
    summary: 'Ceiling for team leads and field staff who log new records without editing/approving.',
  },
  editor: {
    can: [
      'Allows verticals & features to be set up to Editor (Read + Create + Update)',
      'Unlocks Approval / Checker rights on Employees (bank/PAN, deactivation, attendance edits & closure tasks)',
      'Allows upward-manager Maker action on Unmarked Attendance / Week-Off closure tasks',
    ],
    cannot: [
      'Cannot be granted Admin (no Delete rights, no System Configuration)',
      'Cannot bypass Master Admin-only overrides (direct bank edits, immediate deactivation, Force Checkout)',
    ],
    summary: 'Ceiling for HR managers, operations supervisors, and senior leads.',
  },
  admin: {
    can: [
      'Allows verticals & features to be set up to Admin (Full CRUD)',
      'Unlocks System Configuration tiles for assigned Admin verticals (Hubs, Functions, QR, Depts, Roles, Rules)',
    ],
    cannot: [
      'Cannot manage Users/Roles, Presets, or Board RBAC (Master Admin only)',
      'Cannot bypass Master Admin-only overrides (document delete, Force Checkout, orphan attendance tasks, Sphere bypass)',
    ],
    summary: 'Highest vertical ceiling. Grant only to vertical heads who manage configuration & deletions.',
  },
};

/* --------------------------------------------------------------------------
   Step 2 (when Scope = Master) & Master Scope Notice Banner
   -------------------------------------------------------------------------- */
export const MASTER_ROLE_ACCESS = {
  viewer: {
    headline: 'Master Viewer (Global Read-Only)',
    can: [
      'Read-only access across all unlocked verticals & boards (Hubs, Employees)',
      'Bypasses Sphere of Influence (sees all tasks & remarks regardless of seniority)',
      'Submit self-service attendance check-in/out & self-only bank/PAN update requests',
      'Raise Escalation tasks & make field-restricted edits on own/assigned tasks',
    ],
    cannot: [
      'Create, edit, or delete general records',
      'Approve employee bank/deactivation requests or attendance edits',
      'Access System Configuration or User/Role Management',
    ],
    summary: 'Global read-only visibility across all verticals without modification or configuration rights.',
  },
  contributor: {
    headline: 'Master Contributor (Global Read + Create)',
    can: [
      'Read + Create access across all unlocked verticals & boards',
      'Bypasses Sphere of Influence (sees all tasks, remarks, and org-wide Attendance Board)',
      'Monitor Live Attendance tab & submit attendance edit requests (Maker)',
      'Onboard new employees & add initial bank details; create tasks & remarks',
    ],
    cannot: [
      'Edit or delete existing records (except field-restricted edits on own/assigned tasks)',
      'Approve employee requests or attendance edits (Checker)',
      'Access System Configuration or User/Role Management',
    ],
    summary: 'Global data entry and org-wide visibility without edit, delete, or approval authority.',
  },
  editor: {
    headline: 'Master Editor (Global Read + Create + Edit)',
    can: [
      'Read + Create + Edit across all unlocked verticals & boards',
      'Bypasses Sphere of Influence across all boards',
      'Approve/reject Employee Bank/PAN updates & Deactivation requests',
      'Approve/reject Attendance Edit Requests & Closure tasks (Checker — no self-approval)',
      'Act as upward-manager Maker on Unmarked Attendance / Week-Off closure tasks',
    ],
    cannot: [
      'Permanently delete records or employee documents',
      'Deactivate employees immediately (must raise an approval request)',
      'Access System Configuration, User/Role Management, or Force Checkout',
    ],
    summary: 'Global operations & HR authority with approval rights, but no delete or system configuration access.',
  },
  admin: {
    headline: 'Master Admin (Unrestricted System Control)',
    can: [
      'Full CRUD across all verticals, boards, and System Configuration',
      'Manage Users, Roles, Presets, Mass Sync, and Board RBAC',
      'Bypasses all Sphere of Influence & Maker-Checker self-approval restrictions',
      'Direct bank/PAN updates & immediate employee deactivation (no approval needed)',
      'Permanently delete employee documents & Force Checkout on Live Attendance',
      'View & resolve Orphan Attendance tasks; access Sandbox Mode & Dev Tools',
    ],
    cannot: [],
    summary: 'Complete system authority. Grant only to top-level administrators.',
  },
};

/* --------------------------------------------------------------------------
   Contextual Descriptions — Verticals & Features
   Unlocked verticals/features are audited 1:1 against actual guards & RLS.
   Locked verticals/features are retained for legacy compatibility only.
   -------------------------------------------------------------------------- */
export const RAW_CONTEXT = {
  /* ── UNLOCKED VERTICALS ── */
  'Hubs': {
    none: {
      can: [],
      cannot: ['View any Hubs boards or Hub Configuration'],
      summary: 'Completely blocked from the Hubs vertical — no boards will be visible.',
    },
    viewer: {
      can: [
        'View hub task boards & escalations (Tasks limited by Sphere of Influence if Seniority ≤ 6)',
        'Raise and submit new Escalation tasks (granted to anyone with Hubs access)',
        'Make field-restricted edits on tasks you created or are assigned to',
      ],
      cannot: [
        'Create Hub tasks, edit others\' tasks, or delete records',
        'Access Hub Configuration (Hubs, Functions, Cleaning QR)',
      ],
      summary: 'For oversight roles and general staff who view assigned work and raise escalations.',
    },
    contributor: {
      can: [
        'View Hubs boards (Tasks limited by Sphere of Influence if Seniority ≤ 6)',
        'Create new Hub tasks, Escalation tasks, and subtasks/clones on own or assigned tasks',
        'Make field-restricted edits on tasks you created or are assigned to',
      ],
      cannot: [
        'Edit others\' tasks, delete records, or access Hub Configuration',
      ],
      summary: 'For field staff who log new hub tasks and escalations without modifying others\' records.',
    },
    editor: {
      can: [
        'View, create, reassign, and update Hub tasks & Escalation records (Tasks limited by Sphere if Seniority ≤ 6)',
      ],
      cannot: [
        'Delete tasks or access Hub Configuration (Hubs, Functions, Cleaning QR)',
      ],
      summary: 'For hub supervisors who actively manage task flow and escalation resolution.',
    },
    admin: {
      can: [
        'Full CRUD across all unlocked Hubs boards (create, edit, reassign, delete)',
        'Access Hub Configuration (Hub Administration, Hub Functions, Cleaning QR Generator)',
      ],
      cannot: [
        'Vertical Admins with Seniority ≤ 6 still follow Sphere of Influence (only Master Scope bypasses Sphere)',
      ],
      summary: 'Full operational and configuration authority over the Hubs vertical.',
    },
  },

  'Employees': {
    none: {
      can: [],
      cannot: ['View any Employees boards or Employee Configuration'],
      summary: 'Completely blocked from the Employees vertical.',
    },
    viewer: {
      can: [
        'View YOUR OWN profile only on Employees List & YOUR OWN history on Attendance Board',
        'Submit self-service attendance check-in/out (Current Attendance) & self-only bank/PAN update requests',
        'Read published Rules & Regulations; view Remarks (limited by Sphere if Seniority ≤ 6)',
      ],
      cannot: [
        'Browse other employees, view Live Attendance tab, or edit/delete records',
      ],
      summary: 'Standard self-service access for general employees.',
    },
    contributor: {
      can: [
        'Browse employee directory, onboard new employees, and add initial bank details',
        'View Attendance Board for self + downward reporting tree (reportees) & suggest attendance edits (Maker)',
        'Access Live Attendance tab on Current Attendance; submit new Remarks (Sphere applies if Seniority ≤ 6)',
        'Read published Rules & Regulations',
      ],
      cannot: [
        'Edit existing employee profiles, approve bank/deactivation/attendance requests, or delete records',
      ],
      summary: 'For team leads who monitor their reportees\' attendance, log remarks, and onboard staff.',
    },
    editor: {
      can: [
        'Create & update employee profiles (including bulk updates); submit deactivation & bank/PAN requests',
        'Approve/reject pending Employee Bank/PAN updates & Deactivation requests',
        'Org-wide Attendance Board: approve/reject edits & closure tasks (Checker), directly correct attendance, and act as upward-manager Maker on Unmarked Attendance / Week-Off closure tasks',
        'Create & edit Remarks (Sphere applies if Seniority ≤ 6); read Rules & Regulations',
      ],
      cannot: [
        'Delete employee/attendance/remark records or access Employee Configuration',
        'Bypass approval for bank updates or deactivation (Master Admin only)',
      ],
      summary: 'For HR managers who maintain employee data and approve attendance & HR requests.',
    },
    admin: {
      can: [
        'Full CRUD over Employees List, Attendance Board, and Remarks Manager',
        'Approve/reject bank/PAN & deactivation requests; act as Maker/Checker on attendance closure tasks',
        'Access Employee Configuration (Departments, Employee Roles, Rule Management)',
      ],
      cannot: [
        'Direct bank edits without approval, immediate deactivation, document deletion, Force Checkout, and Orphan attendance tasks remain Master Admin only',
      ],
      summary: 'Complete vertical authority over Employees and Employee Configuration.',
    },
  },

  /* ── UNLOCKED EMPLOYEES FEATURES ── */
  'Employees List': {
    none: {
      can: [],
      cannot: ['View or access the Employees List'],
      summary: 'Blocked from the Employees List.',
    },
    viewer: {
      can: [
        'View YOUR OWN employee profile only (other employees are hidden)',
        'Submit self-only bank/PAN detail update requests (requires approval)',
      ],
      cannot: [
        'Browse other employees, onboard staff, edit profiles, or deactivate/delete records',
      ],
      summary: 'Self-only profile view for standard employees.',
    },
    contributor: {
      can: [
        'Browse all employee profiles, roles, and department assignments',
        'Onboard and register new employee records',
        'Add initial bank/PAN details during onboarding',
      ],
      cannot: [
        'Edit existing profiles, request deactivation, approve requests, or delete records',
      ],
      summary: 'For HR staff who onboard new employees without editing existing profiles.',
    },
    editor: {
      can: [
        'Browse, onboard, and update employee profiles (including bulk updates)',
        'Submit bank/PAN update & employee deactivation requests (require approval; reactivation is immediate)',
        'Approve/reject pending Bank/PAN & Deactivation requests (when Employees vertical is Editor+)',
      ],
      cannot: [
        'Permanently delete employee records or employee documents (Master Admin only)',
        'Apply bank updates or deactivations without approval (Master Admin only)',
      ],
      summary: 'For HR managers who maintain the directory and review employee change requests.',
    },
    admin: {
      can: [
        'Full CRUD — add, edit, bulk-update, and permanently remove employee records',
        'Approve/reject pending Bank/PAN & Deactivation requests',
      ],
      cannot: [
        'Direct bank updates without approval, immediate deactivation, and deleting employee documents remain Master Admin only',
      ],
      summary: 'Full directory authority (Master Admin still holds direct bank/deactivation/document-delete overrides).',
    },
  },

  'Remarks Manager': {
    none: {
      can: [],
      cannot: ['View or submit employee remarks'],
      summary: 'Blocked from the Remarks Manager.',
    },
    viewer: {
      can: [
        'View remarks and their history (Limited by Sphere of Influence if Seniority ≤ 6)',
        'Make field-restricted edits on remarks you created or are assigned to',
      ],
      cannot: [
        'Create new remarks, edit others\' remarks, or delete remarks',
      ],
      summary: 'Read-only oversight. Junior staff (Seniority ≤ 6) only see remarks tied to them or their reportees.',
    },
    contributor: {
      can: [
        'View remarks (Limited by Sphere of Influence if Seniority ≤ 6)',
        'Submit new remarks and add subtasks/clones on own or assigned remarks',
        'Make field-restricted edits on remarks you created or are assigned to',
      ],
      cannot: [
        'Edit others\' remarks or delete remark entries',
      ],
      summary: 'For team leads logging remarks. Visibility restricted by Sphere of Influence for Seniority ≤ 6.',
    },
    editor: {
      can: [
        'View remarks (Limited by Sphere of Influence if Seniority ≤ 6)',
        'Submit new remarks and edit existing remark entries',
      ],
      cannot: [
        'Delete remark entries',
      ],
      summary: 'For managers maintaining remarks. Visibility restricted by Sphere of Influence for Seniority ≤ 6.',
    },
    admin: {
      can: [
        'Full CRUD — add, edit, and permanently delete remark entries',
      ],
      cannot: [
        'Vertical Admins with Seniority ≤ 6 still follow Sphere of Influence (only Master Scope bypasses Sphere)',
      ],
      summary: 'Complete authority over the Remarks Manager.',
    },
  },

  'Attendance Board': {
    none: {
      can: [],
      cannot: ['View or interact with the Attendance Board'],
      summary: 'Blocked from the Attendance Board.',
    },
    viewer: {
      can: [
        'View YOUR OWN historical attendance records only',
        'See personal attendance status breakdown',
        'Direct reporting managers can still act as Maker on their own assigned Unmarked Attendance / Week-Off closure tasks',
      ],
      cannot: [
        'View other employees\' attendance, suggest edits for others, or approve edits',
      ],
      summary: 'Self-only historical attendance view for standard employees.',
    },
    contributor: {
      can: [
        'View attendance records for YOURSELF + YOUR DOWNWARD REPORTING TREE (reportees) only',
        'Suggest edits to attendance records for your team (Maker — requires Checker approval)',
      ],
      cannot: [
        'View employees outside your reporting tree, approve edits (Checker), or act as upward-manager Maker on closure tasks',
      ],
      summary: 'For team leads viewing their own downward team and suggesting attendance corrections.',
    },
    editor: {
      can: [
        'View attendance records ORG-WIDE (all active employees)',
        'Review & approve/reject pending attendance edits & closure tasks (Checker — no self-approval)',
        'Directly correct attendance records',
        'Act as upward reporting manager Maker on Unmarked Attendance / Week-Off closure tasks',
      ],
      cannot: [
        'Delete attendance records, self-approve own requests, or view Orphan attendance tasks (Master Admin only)',
      ],
      summary: 'For HR managers & senior upward managers who approve, correct, and close attendance records.',
    },
    admin: {
      can: [
        'Full CRUD org-wide — view, directly correct, approve/reject, and delete attendance entries',
        'Act as Maker or Checker on Unmarked Attendance / Week-Off closure tasks',
      ],
      cannot: [
        'Orphan attendance tasks & self-approval bypass remain Master Admin only',
      ],
      summary: 'Complete vertical authority over the Attendance Board.',
    },
  },

  'Rules & Regulations': {
    none: {
      can: [],
      cannot: ['View company rules and policy documents'],
      summary: 'Blocked from Rules & Regulations.',
    },
    viewer: {
      can: ['Read and search all published company rules and policy documents'],
      cannot: ['Create, edit, or delete rules'],
      summary: 'Read-only access to the HR policy library.',
    },
    contributor: {
      can: ['Read and search all published company rules and policy documents'],
      cannot: ['This board is read-only for all roles — rules are managed under Configuration → Rule Management'],
      summary: 'Read-only on this board (creating/editing rules requires Configuration access).',
    },
    editor: {
      can: ['Read and search all published company rules and policy documents'],
      cannot: ['This board is read-only for all roles — rules are managed under Configuration → Rule Management'],
      summary: 'Read-only on this board (creating/editing rules requires Configuration access).',
    },
    admin: {
      can: [
        'Read and search all published company rules and policy documents',
        'Manage rules via Configuration → Rule Management (requires Vertical Admin / Master Admin canAccessConfig)',
      ],
      cannot: [],
      summary: 'Board is read-only; publishing, editing, and deleting rules happens in Configuration → Rule Management.',
    },
  },

  'Current Attendance': {
    none: {
      can: [],
      cannot: ['Check in/out or view Live Attendance'],
      summary: 'Blocked from Current Attendance.',
    },
    viewer: {
      can: [
        'Submit self-service attendance check-in / check-out & Week-Off prompts for yourself only',
      ],
      cannot: [
        'View the Live Attendance tab or Force Checkout other employees',
      ],
      summary: 'Single-tab self-service check-in/out for field employees.',
    },
    contributor: {
      can: [
        'Submit self-service attendance check-in / check-out',
        'Unlocks the Live Attendance tab to monitor today\'s active hub sessions',
      ],
      cannot: [
        'Force Checkout other employees (Master Admin only)',
      ],
      summary: 'For supervisors who log their own attendance and monitor live hub check-ins.',
    },
    editor: {
      can: [
        'Submit self-service attendance check-in / check-out',
        'Monitor today\'s active hub sessions on the Live Attendance tab',
      ],
      cannot: [
        'Force Checkout other employees (Master Admin only); attendance corrections happen on Attendance Board',
      ],
      summary: 'Same live monitoring as Contributor; use Attendance Board for corrections.',
    },
    admin: {
      can: [
        'Submit self-service attendance check-in / check-out',
        'Monitor today\'s active hub sessions on the Live Attendance tab',
      ],
      cannot: [
        'Force Checkout on Live Attendance is strictly Master Admin only',
      ],
      summary: 'Live check-in monitoring (Force Checkout remains Master Admin only).',
    },
  },

  /* ── UNLOCKED CHARGING HUBS FEATURES ── */
  'Hub Tasks Board': {
    none: {
      can: [],
      cannot: ['View or interact with Hub Tasks'],
      summary: 'Blocked from the Hub Tasks Board.',
    },
    viewer: {
      can: [
        'View hub tasks, priorities, and statuses (Limited by Sphere of Influence if Seniority ≤ 6)',
        'Make field-restricted edits on tasks you created or are assigned to',
      ],
      cannot: [
        'Create new tasks, add subtasks/clones, edit others\' tasks, or delete tasks',
      ],
      summary: 'Read-only oversight. Junior staff (Seniority ≤ 6) only see tasks tied to them or their reportees.',
    },
    contributor: {
      can: [
        'View hub tasks (Limited by Sphere of Influence if Seniority ≤ 6)',
        'Create new hub tasks; add subtasks & clone own or assigned tasks',
        'Make field-restricted edits on tasks you created or are assigned to',
      ],
      cannot: [
        'Edit others\' tasks, drag-and-drop hierarchy for others\' tasks (unless Seniority > 6), or delete tasks',
      ],
      summary: 'For field staff raising tasks. Visibility restricted by Sphere of Influence for Seniority ≤ 6.',
    },
    editor: {
      can: [
        'View hub tasks (Limited by Sphere of Influence if Seniority ≤ 6)',
        'Create, reassign, and update hub task records and statuses',
      ],
      cannot: [
        'Delete hub tasks',
      ],
      summary: 'For hub supervisors managing task execution. Visibility restricted by Sphere of Influence for Seniority ≤ 6.',
    },
    admin: {
      can: [
        'Full CRUD — create, edit, reassign, and permanently delete hub tasks',
      ],
      cannot: [
        'Vertical Admins with Seniority ≤ 6 still follow Sphere of Influence (only Master Scope bypasses Sphere)',
      ],
      summary: 'Complete authority over the Hub Tasks Board.',
    },
  },

  'Escalation Task Board': {
    none: {
      can: [],
      cannot: ['View or raise Escalation tasks'],
      summary: 'Blocked from the Escalation Task Board.',
    },
    viewer: {
      can: [
        'View escalations (Limited by Sphere of Influence if Seniority ≤ 6)',
        'Raise and submit new escalation entries (enabled for all users with Escalation/Hubs access)',
        'Make field-restricted edits on escalations you created or are assigned to',
      ],
      cannot: [
        'Update/resolve others\' escalations or delete escalation records',
      ],
      summary: 'Allows general staff to request support and track their own/team escalations.',
    },
    contributor: {
      can: [
        'View escalations (Limited by Sphere of Influence if Seniority ≤ 6)',
        'Raise and submit new escalation entries; make field-restricted edits on own/assigned escalations',
      ],
      cannot: [
        'Update/resolve others\' escalations or delete escalation records',
      ],
      summary: 'For field staff flagging issues. Visibility restricted by Sphere of Influence for Seniority ≤ 6.',
    },
    editor: {
      can: [
        'View escalations (Limited by Sphere of Influence if Seniority ≤ 6)',
        'Raise new entries and update/resolve escalation records and statuses',
      ],
      cannot: [
        'Delete escalation records',
      ],
      summary: 'For supervisors managing escalation resolution. Sphere of Influence applies if Seniority ≤ 6.',
    },
    admin: {
      can: [
        'Full CRUD — raise, update, resolve, and permanently delete escalation tasks',
      ],
      cannot: [
        'Vertical Admins with Seniority ≤ 6 still follow Sphere of Influence (only Master Scope bypasses Sphere)',
      ],
      summary: 'Complete authority over the Escalation Task Board.',
    },
  },

  /* ── LOCKED VERTICALS & FEATURES (Retained for legacy compatibility — do not actively modify) ── */
  'Clients': {
    none:        { can: [], summary: 'Completely blocked from the Clients vertical.' },
    viewer:      { can: ['Browse client profiles and service contracts', 'View active tasks and leads funnel (Tasks limited by Sphere of Influence if Seniority ≤ 6)'], summary: 'For senior stakeholders. Note: Junior staff only see client tasks tied to them or their reportees.' },
    contributor: { can: ['View Client data (Tasks limited if Seniority ≤ 6)', 'Add new clients, raise client tasks, and add leads to the funnel'], summary: 'Suited for business development staff who capture new clients and leads. Task visibility is restricted by Sphere of Influence for Junior staff.' },
    editor:      { can: ['View Client data (Tasks limited if Seniority ≤ 6)', 'Create and update client profiles, tasks, and leads funnel entries'], summary: 'For account managers who maintain and update ongoing client relationships. Task visibility is restricted by Sphere of Influence for Junior staff.' },
    admin:       { can: ['Full control over all Clients features', 'Create, edit, and delete clients, tasks, and leads'], summary: 'Grants complete authority over the Clients vertical. Master Admins bypass all Sphere limitations.' },
  },
  'Partners': {
    viewer:      { can: ['View partner profiles and associated data (read-only)'], summary: 'Read-only visibility into partner relationships.' },
    contributor: { can: ['View all partner data', 'Add new partner records'], summary: 'Can register new partners but cannot modify existing ones.' },
    editor:      { can: ['View, add, and modify partner profiles and records'], summary: 'For partner managers who maintain and update partner relationships.' },
    admin:       { can: ['Full CRUD over all Partners data'], summary: 'Complete authority over Partners.' },
  },
  'Vendors': {
    viewer:      { can: ['View vendor profiles and associated data (read-only)'], summary: 'Read-only visibility into vendor relationships.' },
    contributor: { can: ['View all vendor data', 'Add new vendor records'], summary: 'Can register new vendors but cannot modify existing ones.' },
    editor:      { can: ['View, add, and modify vendor profiles and records'], summary: 'For vendor managers who maintain and update vendor relationships.' },
    admin:       { can: ['Full CRUD over all Vendors data'], summary: 'Complete authority over Vendors.' },
  },
  'Data': {
    viewer:      { can: ['View data sheets and model verification records (Limited by Sphere if Seniority ≤ 6)'], summary: 'For stakeholders. Note: Junior staff only see records tied to them or their reportees.' },
    contributor: { can: ['View data records (Limited if Seniority ≤ 6)', 'Submit new data sheet entries and model verification requests'], summary: 'For analysts. Record visibility is restricted by Sphere of Influence for Junior staff.' },
    editor:      { can: ['View data records (Limited if Seniority ≤ 6)', 'Submit and update data sheets and verification records'], summary: 'For data managers. Record visibility is restricted by Sphere of Influence for Junior staff.' },
    admin:       { can: ['Full control over all Data Manager features', 'Create, edit, and delete data and verification records'], summary: 'Complete authority over the Data vertical. Master Admins bypass all Sphere limitations.' },
  },
  'Clients List': {
    viewer:      { can: ['Browse all client profiles and contact details', 'View service history and billing model info'], summary: 'For read-only stakeholders who review the client roster.' },
    contributor: { can: ['Browse all client profiles', 'Register new client profiles'], summary: 'For staff who onboard new clients but should not edit existing ones.' },
    editor:      { can: ['Browse all client profiles', 'Register new clients and update existing profiles'], summary: 'For account managers who maintain the client roster.' },
    admin:       { can: ['Full CRUD — add, edit, and permanently remove client profiles'], summary: 'Complete authority over the Clients List.' },
  },
  'Client Tasks Board': {
    viewer:      { can: ['View client tasks, priorities, and completion statuses (Limited by Sphere of Influence if Seniority ≤ 6)'], summary: 'For oversight roles. Note: Junior staff only see tasks assigned to/created by them or their reportees.' },
    contributor: { can: ['View client tasks (Limited if Seniority ≤ 6)', 'Create new client task assignments'], summary: 'For staff who raise tasks. Visibility restricted by Sphere of Influence for Junior staff.' },
    editor:      { can: ['View client tasks (Limited if Seniority ≤ 6)', 'Create, reassign, and update task records and statuses'], summary: 'For task managers. Visibility restricted by Sphere of Influence for Junior staff.' },
    admin:       { can: ['Full CRUD — create, edit, reassign, and delete client tasks'], summary: 'Complete authority over the Client Tasks Board. Master Admins bypass all Sphere limitations.' },
  },
  'Leads Funnel': {
    viewer:      { can: ['View all leads and their current funnel stage (Limited by Sphere of Influence if Seniority ≤ 6)'], summary: 'For stakeholders. Note: Junior staff only see leads assigned to/created by them or their reportees.' },
    contributor: { can: ['View leads (Limited if Seniority ≤ 6)', 'Add new leads into the funnel'], summary: 'For BDEs capturing leads. Visibility restricted by Sphere of Influence for Junior staff.' },
    editor:      { can: ['View leads (Limited if Seniority ≤ 6)', 'Add new leads and move them through funnel stages', 'Update lead details and status'], summary: 'For sales managers. Visibility restricted by Sphere of Influence for Junior staff.' },
    admin:       { can: ['Full CRUD — add, update, progress, and delete leads from the funnel'], summary: 'Complete authority over the Leads Funnel. Master Admins bypass all Sphere limitations.' },
  },
  'Daily Task Board': {
    viewer:      { can: ['View all daily task assignments, checklists, and completion logs (Limited by Sphere of Influence if Seniority ≤ 6)'], summary: 'For oversight roles. Note: Junior staff only see tasks assigned to/created by them or their reportees.' },
    contributor: { can: ['View daily tasks (Limited if Seniority ≤ 6)', 'Submit task completion entries'], summary: 'For field agents logging completions. Visibility restricted by Sphere of Influence for Junior staff.' },
    editor:      { can: ['View daily tasks (Limited if Seniority ≤ 6)', 'Submit and update daily task records and completion statuses'], summary: 'For team leads correcting logs. Visibility restricted by Sphere of Influence for Junior staff.' },
    admin:       { can: ['Full CRUD — manage all daily tasks and completion records'], summary: 'Complete authority over the Daily Task Board. Master Admins bypass all Sphere limitations.' },
  },
  'Daily Task Template': {
    viewer:      { can: ['Browse all configured daily task templates and their task items'], summary: 'For staff who reference templates without modifying them.' },
    contributor: { can: ['Browse all templates', 'Submit new template proposals'], summary: 'For staff who can suggest new templates but cannot publish or edit.' },
    editor:      { can: ['Browse templates', 'Create new templates and modify existing ones'], summary: 'For operations leads who maintain and configure the task template library.' },
    admin:       { can: ['Full CRUD — add, edit, and delete daily task templates'], summary: 'Complete authority over task templates.' },
  },
  'Data Sheet Board': {
    viewer:      { can: ['View and browse data sheets and their entries (Limited by Sphere if Seniority ≤ 6)'], summary: 'For stakeholders. Note: Junior staff only see records tied to them or their reportees.' },
    contributor: { can: ['View data sheets (Limited if Seniority ≤ 6)', 'Submit new data entries to existing sheets'], summary: 'For analysts. Record visibility is restricted by Sphere of Influence for Junior staff.' },
    editor:      { can: ['View data sheets (Limited if Seniority ≤ 6)', 'Submit new entries and modify existing data records'], summary: 'For data managers. Record visibility is restricted by Sphere of Influence for Junior staff.' },
    admin:       { can: ['Full CRUD — add, edit, and delete data sheet records'], summary: 'Complete authority over the Data Sheet Board. Master Admins bypass all Sphere limitations.' },
  },
  'Model Verification Board': {
    viewer:      { can: ['View model verification requests and their current verification status (Limited by Sphere if Seniority ≤ 6)'], summary: 'For auditors. Note: Junior staff only see requests tied to them or their reportees.' },
    contributor: { can: ['View verification records (Limited if Seniority ≤ 6)', 'Submit new model verification requests'], summary: 'For analysts. Record visibility is restricted by Sphere of Influence for Junior staff.' },
    editor:      { can: ['View verification records (Limited if Seniority ≤ 6)', 'Submit requests and update verification findings'], summary: 'For QA leads. Record visibility is restricted by Sphere of Influence for Junior staff.' },
    admin:       { can: ['Full CRUD — manage, process, and delete model verification records'], summary: 'Complete authority over the Model Verification Board. Master Admins bypass all Sphere limitations.' },
  },
};

/* --------------------------------------------------------------------------
   Generic Fallback Descriptions
   -------------------------------------------------------------------------- */
export const GENERIC_ACCESS = {
  none:        { can: [], cannot: ['View any records', 'Create, edit, or delete anything'], summary: 'This user will be completely blocked from this area.' },
  viewer:      { can: ['View & browse records', 'Search & filter data'], cannot: ['Create new records', 'Edit existing data', 'Delete records'], summary: 'For stakeholders who need read-only visibility.' },
  contributor: { can: ['View & browse records', 'Create new entries'], cannot: ['Edit existing records', 'Delete records'], summary: 'For staff who submit new data but should not modify past entries.' },
  editor:      { can: ['View & browse records', 'Create new entries', 'Edit & update existing records'], cannot: ['Delete records'], summary: 'For trusted members who fully manage day-to-day data.' },
  admin:       { can: ['View, create, edit, and delete all records'], cannot: [], summary: 'Full CRUD. Grant only to trusted administrators for this area.' },
  inherit:     { can: ['Access determined by the parent vertical permission'], cannot: [], summary: 'Removes any feature-level override. The user\'s access level reverts to whatever is set at the vertical level.' },
};

/* --------------------------------------------------------------------------
   Canonical Label Normalization
   Ensures labels from DB verticals, DesktopSidebar, MobileSidebar,
   HubManagement, TaskController, and UserEditorModal ALL resolve to the
   exact canonical key in RAW_CONTEXT (preventing silent generic fallbacks).
   -------------------------------------------------------------------------- */
/* Non-identical aliases only; case-insensitive matches for RAW_CONTEXT keys are derived automatically */
const CONTEXT_ALIASES = {
  'hub': 'Hubs',
  'hub manager': 'Hubs',
  'charging hubs': 'Hubs',
  'charging_hubs': 'Hubs',
  'employee': 'Employees',
  'employee manager': 'Employees',
  'client': 'Clients',
  'client manager': 'Clients',
  'partner': 'Partners',
  'partner manager': 'Partners',
  'vendor': 'Vendors',
  'vendor manager': 'Vendors',
  'data manager': 'Data',
  'data_manager': 'Data',
  'client task board': 'Client Tasks Board',
  'hub task board': 'Hub Tasks Board',
  'hubs task board': 'Hub Tasks Board',
  'escalation board': 'Escalation Task Board',
  'daily task templates': 'Daily Task Template',
  'employee list': 'Employees List',
};

const CANONICAL_LOWER_MAP = Object.keys(RAW_CONTEXT).reduce((acc, key) => {
  acc[key.toLowerCase()] = key;
  return acc;
}, {});

/**
 * Resolves any vertical or feature display label to its canonical RAW_CONTEXT key.
 * @param {string} label
 * @returns {string}
 */
export const normalizeContextName = (label) => {
  if (!label || typeof label !== 'string') return '';
  const trimmed = label.trim();
  if (RAW_CONTEXT[trimmed]) return trimmed;
  const lower = trimmed.toLowerCase();
  return CANONICAL_LOWER_MAP[lower] || CONTEXT_ALIASES[lower] || trimmed;
};

/**
 * Resolves tooltip content ({ can, cannot, summary, headline }) for any tooltipType + level + contextName.
 * @param {{ tooltipType?: 'role'|'scope'|'level'|'master', level: string, contextName?: string }} params
 */
export const resolveTooltipContent = ({ tooltipType = 'role', level, contextName }) => {
  const base = ROLE_BASE[level] || ROLE_BASE.none;

  if (tooltipType === 'scope') {
    const entry = SCOPE_ACCESS[level] || GENERIC_ACCESS.none;
    return {
      badge: level?.toUpperCase() || 'SCOPE',
      headline: base.headline,
      color: base.color,
      can: entry.can || [],
      cannot: entry.cannot || [],
      summary: entry.summary || '',
    };
  }

  if (tooltipType === 'level') {
    const entry = LEVEL_CARD_ACCESS[level] || GENERIC_ACCESS[level] || GENERIC_ACCESS.none;
    return {
      badge: level?.toUpperCase() || 'LEVEL',
      headline: `${base.headline} (Max Ceiling)`,
      color: base.color,
      can: entry.can || [],
      cannot: entry.cannot || [],
      summary: entry.summary || '',
    };
  }

  if (tooltipType === 'master') {
    const entry = MASTER_ROLE_ACCESS[level] || GENERIC_ACCESS[level] || GENERIC_ACCESS.none;
    return {
      badge: `MASTER ${level?.toUpperCase() || ''}`.trim(),
      headline: entry.headline || base.headline,
      color: base.color,
      can: entry.can || [],
      cannot: entry.cannot || [],
      summary: entry.summary || '',
    };
  }

  // Default: 'role' (vertical or feature permission button)
  const canonicalName = normalizeContextName(contextName);
  const ctx     = RAW_CONTEXT[canonicalName]?.[level];
  const ctxNone = RAW_CONTEXT[canonicalName]?.['none'];
  const generic = GENERIC_ACCESS[level] || GENERIC_ACCESS.none;

  return {
    badge: level?.toUpperCase() || 'NONE',
    headline: base.headline,
    color: base.color,
    canonicalContextName: canonicalName || contextName,
    can: ctx?.can ?? generic.can,
    cannot: ctx
      ? (ctx.cannot || [])
      : (level === 'none' && ctxNone ? (ctxNone.cannot || []) : generic.cannot),
    summary: ctx?.summary ?? (level === 'none' && ctxNone ? ctxNone.summary : generic.summary),
  };
};
