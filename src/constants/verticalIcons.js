import {
  IconHubs,
  IconPeople,
  IconDatabase,
  IconFile,
} from '../components/ui/Icons';

/**
 * Shared vertical ID -> Icon component resolver.
 * Single source of truth used by both DesktopSidebar (expanded & icon rail)
 * and MobileSidebar (app drawer).
 */
export const getIconForVertical = (id) => {
  if (id === 'CHARGING_HUBS') return IconHubs;
  if (id === 'CLIENTS') return IconDatabase;
  if (id === 'EMPLOYEES') return IconPeople;
  if (id === 'DATA_MANAGER') return IconDatabase;
  return IconFile;
};
