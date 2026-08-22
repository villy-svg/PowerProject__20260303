// attendanceDateUtils.js

/**
 * Returns a week string (e.g., '2024-W05') for a given date.
 */
export function getWeekStringFromDate(dateInput) {
  const now = new Date(dateInput.valueOf());
  const day = now.getDay() || 7;
  now.setDate(now.getDate() - day + 1);
  const year = now.getFullYear();
  const target = new Date(now.valueOf());
  const dayNr = (now.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  const weekNumber = 1 + Math.ceil((firstThursday - target) / 604800000);
  return `${year}-W${weekNumber.toString().padStart(2, '0')}`;
}

/**
 * Returns the current week string.
 */
export function getCurrentWeekString() {
  return getWeekStringFromDate(new Date());
}

/**
 * Returns the from and to dates (YYYY-MM-DD) for a given week string.
 */
export function getDatesFromWeekString(weekStr) {
  if (!weekStr) return { from: '', to: '' };
  const [year, week] = weekStr.split('-W');
  const date = new Date(year, 0, 1);
  const days = (week - 1) * 7;
  const dayOffset = date.getDay() <= 4 && date.getDay() !== 0 ? date.getDay() - 1 : date.getDay() + 6;
  date.setDate(date.getDate() - dayOffset + days);
  
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const fromDateIST = new Date(date.getTime() + IST_OFFSET_MS);
  const fromStr = fromDateIST.toISOString().slice(0, 10);
  
  const toDate = new Date(date);
  toDate.setDate(toDate.getDate() + 6);
  const toDateIST = new Date(toDate.getTime() + IST_OFFSET_MS);
  const toStr = toDateIST.toISOString().slice(0, 10);
  
  return { from: fromStr, to: toStr };
}
