/**
 * Employees vertical barrel export.
 */

// Core vertical components
export { default as EmployeeSubSidebar } from './EmployeeSubSidebar';
export { default as EmployeeManagement } from './EmployeeManagement';
export { default as DepartmentManagement } from './DepartmentManagement';
export { default as EmployeeRoleManagement } from './EmployeeRoleManagement';
export { default as EmployeeRulesBoard } from './EmployeeRulesBoard';
export { default as RuleManagement } from './RuleManagement';

// Remark form + tile
export { default as EmployeeRemarkForm } from './EmployeeRemarkForm';
export { default as EmployeeTaskTile } from './EmployeeTaskTile';

// Sub-components (exported for potential re-use)
export { default as EmployeeCard } from './EmployeeCard';
export { default as EmployeeListRow } from './EmployeeListRow';
export { default as EmployeeForm } from './EmployeeForm';
export { default as EmployeeTree } from './EmployeeTree';
export { default as EmployeeTreeCard } from './EmployeeTreeCard';
export { default as EmployeeBulkUpdateModal } from './EmployeeBulkUpdateModal';

// CSV tools
export { default as EmployeeCSVDownload } from './EmployeeCSVDownload';
export { default as EmployeeCSVImport } from './EmployeeCSVImport';
export { default as DepartmentCSVDownload } from './DepartmentCSVDownload';
export { default as DepartmentCSVImport } from './DepartmentCSVImport';
export { default as EmployeeRoleCSVDownload } from './EmployeeRoleCSVDownload';
export { default as EmployeeRoleCSVImport } from './EmployeeRoleCSVImport';

// Centralized Remarks mappings
export * from './remarksMapping';

// Attendance Board sub-components (Phase 4+)
export { default as EmployeeAttendanceBoard } from './EmployeeAttendanceBoard';
export { default as AttendanceSelfService } from './attendance/AttendanceSelfService';
