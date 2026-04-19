---
name: Hot-Cold Archival Engine
description: Rules for the Hot-Cold Storage archival system. Covers the entity-archive Edge Function, cursor-walk pagination, GitHub Actions cron triggers, staging vs production separation, and service worker cache exclusions. Must be read before touching any archival, storage, or Edge Function code.
---

# Hot-Cold Archival Engine

PowerProject implements a **Hot-Cold Storage** architecture to keep the active Supabase database lean. Old, completed entities are moved from "hot" (live Postgres tables) to "cold" (Supabase Storage, as JSON blobs) by a Deno Edge Function, triggered daily via GitHub Actions.

---

## 1. Architecture Overview

```
GitHub Actions (cron: daily)
  ├── archive-staging  → POST /functions/v1/entity-archive  (staging Supabase)
  └── archive-production → POST /functions/v1/entity-archive  (production Supabase)
          ↓
  entity-archive (Deno Edge Function)
    └── Cursor-Walk Pattern: keyset pagination over eligible records
          ↓
  Supabase Storage (cold bucket)
    └── JSON blobs: {entity}/{year-month}/{id}.json
```

---

## 2. The entity-archive Edge Function

**Location**: `supabase/functions/entity-archive/index.ts`

### Key Design Rules

- **Cursor-Walk Pattern**: Always use keyset pagination (`WHERE id > last_cursor ORDER BY id`) — never OFFSET. OFFSET degrades linearly with table size.
- **Partial Success (HTTP 206)**: If the function hits the execution time limit mid-batch, it MUST return HTTP `206 Partial Content` with `{ "cursor": lastProcessedId, "archived": count, "partial": true }`. The GitHub Actions workflow treats both `200` and `206` as success.
- **Idempotent**: Running the function twice on the same data must be safe. Check cold storage before archiving to avoid duplicate writes.
- **Dry Run Mode**: Accept `{ "dry_run": true }` in the request body. When true, report eligible records but do NOT move them.

### Archival Eligibility Rules
- **Age**: Record `created_at` must be older than the configured threshold (e.g., 90 days for tasks).
- **Status**: Only "terminal" statuses are eligible (e.g., `completed`, `cancelled`). Active, in-progress, or pending records MUST NOT be archived.
- **No Dependents**: Records with active child references (sub-tasks, linked assets) must be excluded.

### Response Contract
```json
// HTTP 200 — Full batch processed
{ "archived": 45, "partial": false, "cursor": null }

// HTTP 206 — Partial (time limit hit)
{ "archived": 20, "partial": true, "cursor": "uuid-of-last-record" }

// HTTP 400 — Bad request (invalid payload)
{ "error": "Invalid request body" }
```

---

## 3. GitHub Actions Workflow Rules

**Location**: `.github/workflows/archive-cron.yml`

### Trigger
- **Schedule**: Daily at 08:00 UTC (`cron: '0 8 * * *'`).
- **Manual**: `workflow_dispatch` with `dry_run: boolean` input.

### Environment Separation
The cron runs **two independent jobs** — `archive-staging` and `archive-production` — each using their own secrets:

| Job | URL Secret | Auth Secret |
|-----|------------|-------------|
| `archive-staging` | `SUPABASE_STAGING_URL` | `SUPABASE_STAGING_SERVICE_ROLE_KEY` |
| `archive-production` | `SUPABASE_URL` | `SUPABASE_SERVICE_ROLE_KEY` |

### Guard Clause
Both jobs are gated by `if: vars.ARCHIVAL_CRON_ENABLED == 'true'` repository variable. **Set this to `'false'` to disable archival without touching code.**

### Exit Code Logic
```bash
# Both 200 (full success) and 206 (partial) are acceptable
if [ "$HTTP_STATUS" -ne 200 ] && [ "$HTTP_STATUS" -ne 206 ]; then
  exit 1  # Only fail on unexpected status codes
fi
```

---

## 4. Cold Storage Format

**Bucket**: `cold-storage` (configured in Supabase)

**Path Convention**: `{entity_type}/{YYYY-MM}/{record_id}.json`

Example: `tasks/2026-01/uuid-here.json`

**Contents**: Full record snapshot as JSON, including all columns at time of archival. Include an `_archived_at` metadata field.

---

## 5. The entityService (Frontend Read Layer)

**Location**: `src/services/storage/entityService.js`

This service provides a **unified read API** that transparently queries both hot (Supabase DB) and cold (Storage) layers.

### Rules
- **Hot-first**: Always query the live DB first. Fall back to cold storage only for records not found in hot.
- **Never cache cold results in Service Worker**: Cold storage blobs contain per-user historical data — caching them would violate RBAC (a different user might see cached data from another user's session).
- **Error transparency**: If cold storage is unavailable, return the hot result with a warning flag — do NOT throw. Cold storage being down must not break the app.

---

## 6. Deno Edge Function Best Practices

> [!IMPORTANT]
> These rules apply to ALL code inside `supabase/functions/`.

- **Every async function MUST have `try/catch`** — unhandled rejections in Deno Edge Functions return `500` with no useful error message to the caller.
- **Use `createClient` with the `service_role` key** only inside Edge Functions (it bypasses RLS). Never expose the service role key to the frontend.
- **Authorization**: All Edge Functions called from the cron use the `service_role` key in `Authorization: Bearer` header. Functions called from the frontend must validate the user's JWT.
- **CORS**: Edge Functions called from the browser must include proper CORS headers.
- **Shared code**: Common utilities (CORS headers, Supabase client factory) live in `supabase/functions/_shared/`.

---

## 7. Service Worker Exclusions (CRITICAL — Security)

> [!CAUTION]
> **NEVER** cache any response from the cold storage bucket or archival endpoints.

Cold storage blobs are RBAC-sensitive: each user's view of archived data is filtered by their permissions. If a service worker caches a cold storage response, a subsequent user on the same device could see another person's archived records.

**Mandatory NetworkOnly patterns in `vite.config.js` PWA config:**
```javascript
// These paths MUST be NetworkOnly in workbox config
runtimeCaching: [
  { urlPattern: /\.supabase\.co/, handler: 'NetworkOnly' },  // all Supabase
  { urlPattern: /storage\/v1\/object/, handler: 'NetworkOnly' }, // cold storage blobs
]
```

---

## 8. Deployment Checklist

When modifying the archival system:
1. [ ] Test with `dry_run: true` via `workflow_dispatch` before enabling live archival.
2. [ ] Verify both staging and production jobs succeed independently.
3. [ ] Confirm HTTP 206 partial responses do NOT trigger false-positive alerts in `archive-failure-alert.yml`.
4. [ ] Check that `ARCHIVAL_CRON_ENABLED` is `'false'` on staging until schema is validated.
5. [ ] Cold storage bucket permissions: read requires authenticated user, write requires service_role only.
