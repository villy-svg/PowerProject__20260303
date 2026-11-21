// attendanceDateUtils.js

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // Asia/Kolkata (UTC+5:30)

/**
 * Returns a 'YYYY-MM-DD' string in Asia/Kolkata (IST, UTC+5:30).
 *
 * Uses a fixed UTC+5:30 offset instead of Intl.DateTimeFormat('en-CA')
 * because Android 8 (Chrome 64 WebView) has incomplete Intl locale data.
 */
export function toISTDateString(date) {
  const istDate = new Date(date.getTime() + IST_OFFSET_MS);
  return istDate.toISOString().slice(0, 10);
}

/**
 * Builds an inclusive array of 'YYYY-MM-DD' strings between startDate and endDate.
 */
export function buildDateRange(startDate, endDate) {
  if (!startDate || !endDate) return [];
  const dates = [];
  const current = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);

  while (current <= end) {
    dates.push(toISTDateString(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

/**
 * Returns the default Mon–Sun week range around today in IST.
 */
export function getDefaultWeekRange() {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    startDate: toISTDateString(monday),
    endDate: toISTDateString(sunday),
  };
}

/**
 * Shifts a 'YYYY-MM-DD' date string by `deltaDays` days in IST.
 */
export function shiftDateString(dateStr, deltaDays) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + deltaDays);
  return toISTDateString(d);
}

/**
 * Resolves quick preset keys ('this-week' | 'last-14' | 'this-month' | 'last-month')
 * into an IST { startDate, endDate } pair.
 */
export function getPresetDateRange(preset) {
  const today = new Date();
  if (preset === 'this-week') {
    return getDefaultWeekRange();
  }
  if (preset === 'last-14') {
    const start = new Date(today);
    start.setDate(today.getDate() - 13);
    return { startDate: toISTDateString(start), endDate: toISTDateString(today) };
  }
  if (preset === 'this-month') {
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return { startDate: toISTDateString(first), endDate: toISTDateString(last) };
  }
  if (preset === 'last-month') {
    const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const last = new Date(today.getFullYear(), today.getMonth(), 0);
    return { startDate: toISTDateString(first), endDate: toISTDateString(last) };
  }
  return { startDate: '', endDate: '' };
}

/**
 * Computes default IST login/logout timestamps for 'present' edit requests.
 */
export function buildDefaultShiftTimes(date, status, shiftType) {
  if (status !== 'present') {
    return { loginTime: null, logoutTime: null };
  }
  if (shiftType === 'day') {
    return {
      loginTime: `${date}T10:00:00+05:30`,
      logoutTime: `${date}T20:00:00+05:30`,
    };
  }
  if (shiftType === 'night') {
    const nextDateStr = shiftDateString(date, 1);
    return {
      loginTime: `${date}T22:00:00+05:30`,
      logoutTime: `${nextDateStr}T08:00:00+05:30`,
    };
  }
  return { loginTime: null, logoutTime: null };
}

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
