/**
 * verticalRegistry.js
 * Single source of truth for mapping activeVertical IDs → vertical-specific
 * React components and derived labels.
 *
 * RULE: When adding a new vertical, ONLY update this file.
 * No other file should contain vertical-routing ternaries.
 */
import {
  HubSubSidebar, HubTaskForm, HubTaskTile,
} from '../verticals/ChargingHubs';

import {
  EmployeeSubSidebar, EmployeeRemarkForm, EmployeeTaskTile,
} from '../verticals/Employees';

import {
  ClientSubSidebar, ClientTaskForm, ClientTaskTile,
} from '../verticals/Clients';

import {
  DataManagerSubSidebar
} from '../verticals/DataManager';

import { REMARK_GRADE_MAP } from '../verticals/Employees/remarksMapping';

/** All activeVertical values belonging to ChargingHubs vertical */
export const HUB_VIEWS = [
  'hub_tasks',
  'daily_hub_tasks',
  'daily_task_templates',
  'escalation_tasks',
];

/** All activeVertical values belonging to Employees vertical */
export const EMPLOYEE_VIEWS = [
  'employee_tasks',
  'employee_rules_board',
  'employee_attendance_board',
  'employee_leave_wallet',
  'attendance_self_service',
];

/** All activeVertical values belonging to Clients vertical */
export const CLIENT_VIEWS = ['client_tasks', 'leads_funnel'];

/**
 * resolveVerticalComponents(activeVertical, verticals)
 * Returns { SidebarComponent, TaskFormComponent, TaskTileComponent }
 */
export function resolveVerticalComponents(activeVertical, verticals = {}) {
  const hubId    = verticals?.CHARGING_HUBS?.id;
  const empId    = verticals?.EMPLOYEES?.id;
  const clientId = verticals?.CLIENTS?.id;
  const dataManagerId = verticals?.DATA_MANAGER?.id;

  const isHub    = activeVertical === hubId    || HUB_VIEWS.includes(activeVertical);
  const isEmp    = activeVertical === empId    || EMPLOYEE_VIEWS.includes(activeVertical);
  const isClient = activeVertical === clientId || CLIENT_VIEWS.includes(activeVertical);
  const isDataManager = activeVertical === dataManagerId || activeVertical === 'model_verification_board';

  if (isHub)    return { SidebarComponent: HubSubSidebar,      TaskFormComponent: HubTaskForm,      TaskTileComponent: HubTaskTile };
  if (isEmp)    return { SidebarComponent: EmployeeSubSidebar, TaskFormComponent: EmployeeRemarkForm, TaskTileComponent: EmployeeTaskTile };
  if (isClient) return { SidebarComponent: ClientSubSidebar,   TaskFormComponent: ClientTaskForm,   TaskTileComponent: ClientTaskTile };
  if (isDataManager) return { SidebarComponent: DataManagerSubSidebar, TaskFormComponent: null, TaskTileComponent: null };
  return { SidebarComponent: null, TaskFormComponent: null, TaskTileComponent: null };
}

/**
 * resolveVerticalRootId(activeVertical, verticals)
 * Returns the canonical root vertical ID for RBAC and task filtering.
 */
export function resolveVerticalRootId(activeVertical, verticals = {}) {
  const hubId    = verticals?.CHARGING_HUBS?.id;
  const empId    = verticals?.EMPLOYEES?.id;
  const clientId = verticals?.CLIENTS?.id;
  const dataManagerId = verticals?.DATA_MANAGER?.id;

  if (activeVertical === hubId    || HUB_VIEWS.includes(activeVertical))    return hubId;
  if (activeVertical === empId    || EMPLOYEE_VIEWS.includes(activeVertical)) return empId;
  if (activeVertical === clientId || CLIENT_VIEWS.includes(activeVertical))  return clientId;
  if (activeVertical === dataManagerId || activeVertical === 'model_verification_board') return dataManagerId || 'DATA_MANAGER';
  return (activeVertical || '').toUpperCase();
}

/**
 * resolveVerticalLabels(activeVertical, verticals)
 * Returns { label, boardLabel } for workspace header display.
 */
export function resolveVerticalLabels(activeVertical, verticals = {}) {
  const hubId    = verticals?.CHARGING_HUBS?.id;
  const empId    = verticals?.EMPLOYEES?.id;
  const clientId = verticals?.CLIENTS?.id;

  const map = {
    hub_tasks:            { label: 'Hubs List', boardLabel: 'Hub Task Board' },
    daily_hub_tasks:      { label: 'Hubs List', boardLabel: 'Daily Task Board' },
    daily_task_templates: { label: 'Hubs List', boardLabel: 'Daily Task Templates' },
    escalation_tasks:     { label: 'Hubs List', boardLabel: 'Escalation Task Board' },
    employee_tasks:         { label: 'Employees', boardLabel: 'Remarks Manager' },
    employee_rules_board:   { label: 'Employees', boardLabel: 'Rules & Regulations' },
    employee_attendance_board: { label: 'Employees', boardLabel: 'Attendance Board' },
    attendance_self_service:    { label: 'Employees', boardLabel: 'Current Attendance' },
    client_tasks:           { label: 'Clients',   boardLabel: 'Client Task Board' },
    leads_funnel:           { label: 'Clients',   boardLabel: 'Client Task Board' },
  };
  if (hubId)    map[hubId]    = { label: 'Hubs List', boardLabel: 'Hubs Task Board' };
  if (empId)    map[empId]    = { label: 'Employees', boardLabel: 'Remarks Manager' };
  if (clientId) map[clientId] = { label: 'Clients',   boardLabel: 'Client Task Board' };
  const dataManagerId = verticals?.DATA_MANAGER?.id;
  if (dataManagerId) {
    map[dataManagerId] = { label: 'Data Manager', boardLabel: 'Data Sheet Board' };
    map['model_verification_board'] = { label: 'Data Manager', boardLabel: 'Model Verification Board' };
  }

  return map[activeVertical] || { label: verticals[activeVertical]?.label || '', boardLabel: 'Board' };
}

/**
 * resolveHeaderClickTarget(activeVertical, verticals, permissions)
 * Returns the navigation target when sub-sidebar header is clicked, or null.
 */
export function resolveHeaderClickTarget(activeVertical, verticals = {}, permissions = {}) {
  const hubId    = verticals?.CHARGING_HUBS?.id;
  const empId    = verticals?.EMPLOYEES?.id;
  const clientId = verticals?.CLIENTS?.id;

  if (activeVertical === 'employee_tasks') return empId || null;
  if (CLIENT_VIEWS.includes(activeVertical)) return clientId || null;

  const isHubConfigView = (
    activeVertical === hubId ||
    activeVertical === 'hub_tasks' ||
    activeVertical === 'daily_hub_tasks' ||
    activeVertical === 'daily_task_templates'
  );
  if (isHubConfigView && permissions?.canAccessConfig) return 'hub_management';
  return null;
}

/**
 * Returns the title of the priority field (e.g., 'Remark Grade' or 'Priority')
 */
export function resolvePriorityTitle(verticalId) {
  if (verticalId === 'EMPLOYEES' || verticalId === 'employee_tasks') {
    return 'Remark Grade';
  }
  return 'Priority';
}

/**
 * Returns the mapped priority display value (e.g., 'Level 0' instead of 'Low')
 */
export function resolvePriorityLabel(priority, verticalId) {
  if (!priority) return '';
  if (verticalId === 'EMPLOYEES' || verticalId === 'employee_tasks') {
    return REMARK_GRADE_MAP[priority] || priority;
  }
  return priority;
}

/**
 * Returns the modal title based on the active vertical and operation type
 */
export function resolveModalTitle(activeVertical, isEditing) {
  if (isEditing) {
    if (activeVertical === 'EMPLOYEES' || activeVertical === 'employee_tasks') {
      return 'Edit Remark';
    }
    return 'Edit Task';
  }

  if (activeVertical === 'EMPLOYEES' || activeVertical === 'employee_tasks') {
    return 'Add Remark';
  }
  if (activeVertical === 'escalation_tasks') {
    return 'Request Support';
  }
  return `Add New ${activeVertical?.replace('_', ' ')} Task`;
}

/**
 * Returns the label for the add button based on the vertical
 */
export function resolveAddButtonLabel(verticalId) {
  if (verticalId === 'EMPLOYEES' || verticalId === 'employee_tasks') {
    return 'Add Remark';
  }
  return 'Add Task';
}
