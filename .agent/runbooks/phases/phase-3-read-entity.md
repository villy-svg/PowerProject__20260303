# Phase 3: Edge Function — Read Entity (Hot Only) — Execution Guide

> **Prerequisite**: Phase 2 (all sub-phases) must be complete.  
> **Runbook**: `.agent/runbooks/hot-cold-storage-runbook.md`  
> **Sub-phases**: 3A, 3B

---

## Overview

Create an Edge Function that fetches an entity by ID, joins the corresponding hot table data, and returns a normalized response. Phase 7 will extend this to handle cold storage reads.

---

## Phase 3A: Basic Entity Lookup + Hot Join

### What to Create

**File**: `supabase/functions/entity-read/index.ts`

```typescript
// entity-read/index.ts
// Edge Function: Reads an entity + domain data (hot path only — cold path in Phase 7)
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const url = new URL(req.url);
    const entityId = url.searchParams.get("id");

    if (!entityId) {
      return new Response(
        JSON.stringify({ success: false, error: "id parameter is required", code: "MISSING_ID" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Fetch entity record
    const { data: entity, error: entityError } = await supabase
      .from("entities")
      .select("*")
      .eq("id", entityId)
      .single();

    if (entityError || !entity) {
      return new Response(
        JSON.stringify({ success: false, error: "Entity not found", code: "NOT_FOUND" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Route based on storage tier
    if (entity.storage_tier === "hot") {
      const domainData = await fetchHotData(supabase, entity);
      return new Response(
        JSON.stringify({
          success: true,
          entity: normalizeEntity(entity),
          domain: domainData,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Phase 7: Cold path will be added here
    if (entity.storage_tier === "cold") {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Cold storage reads not yet implemented",
          code: "COLD_NOT_IMPLEMENTED",
        }),
        { status: 501, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Unknown storage tier", code: "UNKNOWN_TIER" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message, code: "INTERNAL_ERROR" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ─── Hot Data Fetchers ──────────────────────────────────────────────────────

interface DomainResult {
  table: string;
  record_id: string | null;
  data: Record<string, unknown> | null;
}

async function fetchHotData(supabase: any, entity: any): Promise<DomainResult> {
  const fetchers: Record<string, () => Promise<DomainResult>> = {
    proof_of_work: async () => {
      const { data, error } = await supabase
        .from("submissions")
        .select("*, submitted_by_profile:user_profiles!submissions_submitted_by_fkey(name, email)")
        .eq("entity_id", entity.id)
        .single();

      if (error || !data) return { table: "submissions", record_id: null, data: null };
      return { table: "submissions", record_id: data.id, data };
    },
    // Future entity types added here
  };

  const fetcher = fetchers[entity.entity_type];
  if (!fetcher) {
    return { table: "unknown", record_id: null, data: null };
  }

  return fetcher();
}

// ─── Response Normalization ──────────────────────────────────────────────────

function normalizeEntity(entity: any) {
  return {
    id: entity.id,
    entity_type: entity.entity_type,
    storage_tier: entity.storage_tier,
    created_at: entity.created_at,
    archived_at: entity.archived_at,
    metadata: entity.metadata || {},
  };
}
```

### Validation

```bash
# Deploy
npx supabase functions deploy entity-read

# Test with a known entity ID (created in Phase 2)
curl "https://<PROJECT_REF>.supabase.co/functions/v1/entity-read?id=<ENTITY_UUID>" \
  -H "Authorization: Bearer <ANON_KEY>"

# Test 404
curl "https://<PROJECT_REF>.supabase.co/functions/v1/entity-read?id=00000000-0000-0000-0000-000000000000" \
  -H "Authorization: Bearer <ANON_KEY>"

# Test missing ID
curl "https://<PROJECT_REF>.supabase.co/functions/v1/entity-read" \
  -H "Authorization: Bearer <ANON_KEY>"
```

---

## Phase 3B: Response Normalization

Ensure the response shape is identical regardless of entity type:

```json
{
  "success": true,
  "entity": {
    "id": "uuid",
    "entity_type": "proof_of_work",
    "storage_tier": "hot",
    "created_at": "2026-04-06T...",
    "archived_at": null,
    "metadata": {}
  },
  "domain": {
    "table": "submissions",
    "record_id": "uuid",
    "data": {
      "id": "uuid",
      "task_id": "uuid",
      "submitted_by": "uuid",
      "comment": "...",
      "links": [...],
      "status": "pending"
    }
  }
}
```

Verify that the shape is consistent across:
- Different entity types (when more are added)
- Missing domain data (entity exists but domain record was deleted)
- Error cases

---

## Frontend Service Extension

Add to `src/services/storage/entityService.js`:

```javascript
/**
 * Fetches an entity by ID via the Edge Function.
 * Transparently handles hot/cold routing.
 */
export const getEntity = async (entityId) => {
  const { data, error } = await supabase.functions.invoke('entity-read', {
    body: null,
    // Edge Functions use query params via URL, so we use the method option
  });

  // Alternative: direct fetch
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/entity-read?id=${entityId}`,
    {
      headers: {
        'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
      },
    }
  );

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to fetch entity');
  }

  return response.json();
};
```

---

## After Completion

Update the runbook:
1. Set Phase 3A/3B status to `[x] DONE`
2. Record response shape validation results
3. Note any edge cases discovered
