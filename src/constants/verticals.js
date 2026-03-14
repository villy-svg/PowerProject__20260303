export const VERTICALS = {
  CHARGING_HUBS: { id: 'CHARGING_HUBS', label: 'Hub Manager'},
  CLIENTS: { id: 'CLIENTS', label: 'Client Manager', locked: true },
  EMPLOYEES: { id: 'EMPLOYEES', label: 'Employee Manager' },
  PARTNERS: { id: 'PARTNERS', label: 'Partner Manager', locked: true },
  VENDORS: { id: 'VENDORS', label: 'Vendor Manager', locked: true }//,
  //VEHICLE: { id: 'VEHICLE', label: 'Vehicle Model Manager'}
};

export const VERTICAL_LIST = Object.values(VERTICALS);