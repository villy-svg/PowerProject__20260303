/**
 * devSanitizer.js
 * Developer-only data sanitization utility to clean up session and database
 * dumps before injecting them into local development caches.
 *
 * Prevents: PII leakage (names, emails, phone numbers, client locations) and active auth tokens.
 */

export const devSanitizeDump = (dump) => {
  if (!dump) return null;
  
  let parsed;
  try {
    parsed = typeof dump === 'string' ? JSON.parse(dump) : dump;
  } catch (e) {
    console.error('[devSanitizer] Failed to parse input dump JSON:', e);
    throw new Error('Invalid JSON format. Please paste a valid JSON string.');
  }

  // Deep clone to avoid mutating parameters
  const clean = JSON.parse(JSON.stringify(parsed));

  // 1. Sanitize User Profile
  if (clean.userProfile) {
    const prof = clean.userProfile;
    
    // Hard purge sensitive tokens
    delete prof.accessToken;
    delete prof.access_token;
    delete prof.refresh_token;
    delete prof.token;
    
    // Mask identity metadata
    const mockNamesByRole = {
      master_admin: 'Lead Developer (Offline)',
      vertical_admin: 'Mock Vertical Admin',
      vertical_viewer: 'Mock Vertical Viewer',
    };
    
    const roleKey = prof.roleId || prof.role || 'user';
    prof.name = mockNamesByRole[roleKey] || 'Mock Team Member';
    prof.email = `${roleKey.toLowerCase()}@mockpowerpod.in`;
  }

  // 2. Sanitize Task Data (Cleans tasks, assignees, client names)
  if (Array.isArray(clean.tasks)) {
    clean.tasks = clean.tasks.map((task, idx) => {
      // Copy core task structure while sanitizing PII
      const cleanTask = { ...task };
      
      // Anonymize text containing sensitive descriptions or customer names
      if (cleanTask.text) {
        // Scrub email addresses
        cleanTask.text = cleanTask.text.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, 'user@example.com');
        // Scrub telephone numbers (digits of length 10 or more)
        cleanTask.text = cleanTask.text.replace(/\b\d{10,12}\b/g, '[PHONE_NUMBER]');
      } else {
        cleanTask.text = `Simulated Task #${100 + idx}`;
      }

      if (cleanTask.description) {
        cleanTask.description = 'Offline simulated task description. Sensitive operational parameters have been scrubbed.';
      }

      // Anonymize assignee descriptive strings
      if (cleanTask.assigneeName) {
        const count = Array.isArray(cleanTask.assigned_to) ? cleanTask.assigned_to.length : 1;
        cleanTask.assigneeName = Array.from({ length: count }, (_, i) => `Mock Operator ${i + 1}`).join(', ');
      }

      // Anonymize detailed relational metadata
      if (Array.isArray(cleanTask.assigneeMeta)) {
        cleanTask.assigneeMeta = cleanTask.assigneeMeta.map((meta, i) => ({
          ...meta,
          full_name: `Mock Operator ${i + 1}`,
          badge_id: meta.badge_id ? `BADGE-${1000 + i}` : undefined
        }));
      }

      if (Array.isArray(cleanTask.hubNames)) {
        cleanTask.hubNames = cleanTask.hubNames.map((_, i) => `Mock Hub ${String.fromCharCode(65 + i)}`);
      }

      if (Array.isArray(cleanTask.hubData)) {
        cleanTask.hubData = cleanTask.hubData.map((h, i) => ({
          ...h,
          name: `Mock Hub ${String.fromCharCode(65 + i)}`,
          hub_code: h.hub_code ? `HUB-${100 + i}` : undefined
        }));
      }

      if (Array.isArray(cleanTask.clients)) {
        cleanTask.clients = cleanTask.clients.map((c, i) => ({
          ...c,
          name: `Mock Client ${i + 1}`
        }));
      }

      // Clean metadata logs
      if (cleanTask.metadata) {
        cleanTask.metadata = {
          ...cleanTask.metadata,
          notes: cleanTask.metadata.notes ? 'Scrubbed offline note.' : undefined
        };
      }

      return cleanTask;
    });
  }

  return clean;
};
