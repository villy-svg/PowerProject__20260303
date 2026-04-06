# Phase 2: Edge Function — Create Entity — Execution Guide

> **Prerequisite**: Phase 1 (all sub-phases) must be complete.  
> **Runbook**: `.agent/runbooks/hot-cold-storage-runbook.md`  
> **Sub-phases**: 2A, 2B, 2C

---

## Overview

Create a Deno Edge Function that atomically creates an entity record + its domain-specific record in a single transaction. This function is the **write entry point** for all entity-tracked data.

---

## Phase 2A: Edge Function Scaffold + Basic Entity Insert

### What to Create

**File**: `supabase/functions/entity-create/index.ts`

```typescript
// entity-create/index.ts
// Edge Function: Creates an entity + domain record atomically
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json();
    const { entity_type, metadata = {}, domain_data = {} } = body;

    // Validate required fields
    if (!entity_type) {
      return new Response(
        JSON.stringify({ error: "entity_type is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate entity_type exists in registry
    const { data: registry, error: regError } = await supabase
      .from("entity_type_registry")
      .select("*")
      .eq("entity_type", entity_type)
      .single();

    if (regError || !registry) {
      return new Response(
        JSON.stringify({ error: `Unknown entity_type: ${entity_type}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Phase 2A: Insert entity record
    const { data: entity, error: entityError } = await supabase
      .from("entities")
      .insert({
        entity_type,
        storage_tier: "hot",
        metadata,
      })
      .select()
      .single();

    if (entityError) {
      throw new Error(`Entity insert failed: ${entityError.message}`);
    }

    // Phase 2B: Domain dispatch will be added here

    return new Response(
      JSON.stringify({
        success: true,
        entity,
        domain_data: null, // Phase 2B
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
```

### Validation

```bash
# Deploy the function
npx supabase functions deploy entity-create

# Test it
curl -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/entity-create" \
  -H "Authorization: Bearer <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"entity_type": "proof_of_work", "metadata": {"source": "test"}}'
```

Expected response:
```json
{
  "success": true,
  "entity": {
    "id": "uuid-here",
    "entity_type": "proof_of_work",
    "storage_tier": "hot",
    "metadata": {"source": "test"},
    "created_at": "..."
  },
  "domain_data": null
}
```

---

## Phase 2B: Domain Table Dispatching

Extend the function to insert into the correct domain table based on `entity_type`.

### Domain Dispatch Strategy

Add a dispatcher module that maps `entity_type` → insert logic:

**File**: `supabase/functions/_shared/domain/dispatcher.ts`

```typescript
// _shared/domain/dispatcher.ts
// Maps entity_type to domain-specific insert logic
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

type DomainInsertResult = {
  data: Record<string, unknown> | null;
  error: string | null;
};

type DomainHandler = (
  supabase: SupabaseClient,
  entityId: string,
  domainData: Record<string, unknown>
) => Promise<DomainInsertResult>;

// Registry of domain handlers
const handlers: Record<string, DomainHandler> = {
  proof_of_work: async (supabase, entityId, domainData) => {
    const { task_id, submitted_by, comment, links = [] } = domainData;

    if (!task_id || !submitted_by) {
      return { data: null, error: "task_id and submitted_by are required for proof_of_work" };
    }

    const { data, error } = await supabase
      .from("submissions")
      .insert({
        task_id,
        submitted_by,
        comment: comment || null,
        links,
        entity_id: entityId,
        status: "pending",
      })
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  },
  // Future: add more handlers here
  // daily_task_log: async (supabase, entityId, domainData) => { ... },
};

export async function dispatchDomainInsert(
  supabase: SupabaseClient,
  entityType: string,
  entityId: string,
  domainData: Record<string, unknown>
): Promise<DomainInsertResult> {
  const handler = handlers[entityType];
  if (!handler) {
    return { data: null, error: `No domain handler for entity_type: ${entityType}` };
  }
  return handler(supabase, entityId, domainData);
}
```

### Update `entity-create/index.ts`

Replace the `// Phase 2B` placeholder with:

```typescript
// Phase 2B: Dispatch to domain table
const domainResult = await dispatchDomainInsert(
  supabase,
  entity_type,
  entity.id,
  domain_data
);

if (domainResult.error) {
  // Rollback: delete the entity if domain insert fails
  await supabase.from("entities").delete().eq("id", entity.id);
  throw new Error(`Domain insert failed: ${domainResult.error}`);
}
```

And update the import:
```typescript
import { dispatchDomainInsert } from "../_shared/domain/dispatcher.ts";
```

### Validation

```bash
curl -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/entity-create" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "entity_type": "proof_of_work",
    "domain_data": {
      "task_id": "<VALID_TASK_UUID>",
      "submitted_by": "<VALID_USER_UUID>",
      "comment": "Test submission via entity system"
    }
  }'
```

Verify:
1. Entity record in `entities` table
2. Submission record in `submissions` table  
3. `submissions.entity_id` matches `entities.id`
4. If `domain_data` is invalid → entity should NOT exist (rollback worked)

---

## Phase 2C: Response Normalization + Error Handling

### Normalized Response Shape

All responses should follow this structure:

```typescript
interface EntityResponse {
  success: boolean;
  entity: {
    id: string;
    entity_type: string;
    storage_tier: "hot" | "cold";
    created_at: string;
    metadata: Record<string, unknown>;
  };
  domain: {
    table: string;        // 'submissions'
    record_id: string;    // the domain table PK
    data: Record<string, unknown>;
  } | null;
  error?: string;
}
```

### Error Response Shape

```typescript
interface ErrorResponse {
  success: false;
  error: string;
  code: string;  // 'INVALID_ENTITY_TYPE' | 'DOMAIN_INSERT_FAILED' | 'INTERNAL_ERROR'
}
```

### Validation

Test all error paths:
1. Missing `entity_type` → 400 + proper error code
2. Invalid `entity_type` → 400 + `INVALID_ENTITY_TYPE`
3. Missing required domain fields → 400 + `DOMAIN_INSERT_FAILED`
4. Valid request → 201 + normalized response

---

## Frontend Service (Optional — can be deferred)

**File**: `src/services/storage/entityService.js`

```javascript
import { supabase } from '../core/supabaseClient';

/**
 * Creates an entity via the Edge Function.
 * This is the standard way to create entity-tracked records.
 */
export const createEntity = async ({ entityType, domainData = {}, metadata = {} }) => {
  const { data, error } = await supabase.functions.invoke('entity-create', {
    body: { entity_type: entityType, domain_data: domainData, metadata },
  });

  if (error) throw new Error(`Entity creation failed: ${error.message}`);
  return data;
};
```

---

## After Completion

Update the runbook:
1. Set Phase 2A/2B/2C status to `[x] DONE`
2. Note the Edge Function URL
3. Record test results
4. Update File Registry
