export const VERTICALS = {
  CHARGING_HUBS: { id: 'CHARGING_HUBS', label: 'Hub Manager' },
  CLIENTS: { id: 'CLIENTS', label: 'Client Manager' },
  EMPLOYEES: { id: 'EMPLOYEES', label: 'Employee Manager' },
  PARTNERS: { id: 'PARTNERS', label: 'Partner Manager', locked: true },
  VENDORS: { id: 'VENDORS', label: 'Vendor Manager', locked: true },
  DATA_MANAGER: { id: 'DATA_MANAGER', label: 'Data Manager', locked: true }
};

export const VERTICAL_LIST = Object.values(VERTICALS);