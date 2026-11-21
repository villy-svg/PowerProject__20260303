/**
 * attendanceHubUtils.js
 *
 * Pure helpers for resolving non-native & multi-hub shift badges on the
 * Attendance Board (shared across Desktop AttendanceGrid and Mobile AttendanceMobileList).
 */

/**
 * Extracts distinct non-null hub IDs worked during a shift record.
 * Supports pre-extracted `worked_hub_ids`, raw `session_logs_data` (array or JSON string),
 * and scheduled-only `hub_id` fallback.
 *
 * @param {object|null} record
 * @returns {string[]}
 */
export function extractWorkedHubIds(record) {
  if (!record) return [];

  if (Array.isArray(record.worked_hub_ids) && record.worked_hub_ids.length > 0) {
    return record.worked_hub_ids;
  }

  let sessions = record.session_logs_data;
  if (typeof sessions === 'string') {
    try {
      sessions = JSON.parse(sessions);
    } catch {
      sessions = [];
    }
  }

  const seen = new Set();
  const ids = [];

  if (Array.isArray(sessions)) {
    sessions.forEach((session) => {
      if (session?.hub_id) {
        const idStr = String(session.hub_id);
        if (!seen.has(idStr)) {
          seen.add(idStr);
          ids.push(idStr);
        }
      }
    });
  }

  if (ids.length === 0 && record.hub_id) {
    ids.push(String(record.hub_id));
  }

  return ids;
}

/**
 * Resolves the city-aware multi-hub code (e.g. "MULTI-BLR") when all worked hubs
 * belong to a single city, preferring the canonical MULTI hub_code from hubMap.
 *
 * @param {Array<object>} resolvedHubs
 * @param {Map<string, object>} hubMap
 * @returns {string}
 */
function resolveCityMultiCode(resolvedHubs, hubMap) {
  const cities = new Set(
    resolvedHubs
      .map((h) => (h?.city || '').trim())
      .filter((c) => c.length > 0 && c.toLowerCase() !== 'system')
  );

  if (cities.size !== 1) return 'MULTI';

  const [sharedCity] = Array.from(cities);

  // Prefer an existing canonical MULTI hub in the hubs table for this city (e.g. MULTI-BLR)
  if (hubMap instanceof Map) {
    for (const hub of hubMap.values()) {
      if (
        hub?.name === 'MULTI' &&
        (hub?.city || '').trim().toLowerCase() === sharedCity.toLowerCase() &&
        hub?.hub_code
      ) {
        return hub.hub_code;
      }
    }
  }

  const slug = sharedCity.toUpperCase().replace(/\s+/g, '_');
  return `MULTI-${slug}`;
}

/**
 * Determines whether a shift cell should display a non-native or multi-hub badge.
 * Returns null if the shift was at the employee's native/self hub or has no hub data.
 *
 * @param {object|null} record    - Attendance or scheduled cell record
 * @param {object|null} employee  - Employee object (with hub_id / hubs)
 * @param {Map<string, object>} hubMap - Lookup Map<hubId, { id, name, hub_code, city }>
 * @param {object} [options]
 * @param {boolean} [options.preferCityMulti=true] - Use MULTI-<CITY> on desktop; 'MULTI' on mobile
 * @returns {{ code: string, isMulti: boolean, hubCodes: string[], tooltip: string } | null}
 */
export function resolveNonNativeShiftHub(record, employee, hubMap, options = {}) {
  const { preferCityMulti = true } = options;

  if (!record || record.attendance_status !== 'present') return null;

  const workedHubIds = extractWorkedHubIds(record);
  if (workedHubIds.length === 0) return null;

  // Multiple distinct hubs worked in the same shift/day
  if (workedHubIds.length > 1) {
    const resolvedHubs = workedHubIds.map((id) => hubMap?.get(id)).filter(Boolean);
    const hubCodes = resolvedHubs.map((h) => h.hub_code).filter(Boolean);
    const code = preferCityMulti ? resolveCityMultiCode(resolvedHubs, hubMap) : 'MULTI';

    return {
      code,
      isMulti: true,
      hubCodes,
      tooltip: hubCodes.length > 0
        ? `Multiple hubs: ${hubCodes.join(', ')}`
        : 'Multiple hubs',
    };
  }

  // Single worked hub — compare against employee's native/self hub
  const workedHubId = workedHubIds[0];
  const nativeHubId = employee?.hub_id
    ? String(employee.hub_id)
    : (employee?.hubs?.id ? String(employee.hubs.id) : null);

  if (nativeHubId && workedHubId === nativeHubId) {
    return null;
  }

  const hub = hubMap?.get(workedHubId);
  if (!hub?.hub_code) return null;

  return {
    code: hub.hub_code,
    isMulti: false,
    hubCodes: [hub.hub_code],
    tooltip: `Worked at ${hub.hub_code}${hub.name ? ` (${hub.name})` : ''} (Non-native hub)`,
  };
}
