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
    // Validate caller is authenticated (not just service role)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing Authorization header", code: "UNAUTHORIZED" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Verify the caller's JWT is valid (not just present)
    const callerClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await callerClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid or expired token", code: "UNAUTHORIZED" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    // Phase 2A: Insert entity record + domain record atomically via RPC
    // NOTE: We use an RPC function instead of sequential JS inserts to guarantee atomicity.
    // If the domain insert fails inside the RPC, Postgres rolls back the entity insert too.
    // See: supabase/migrations/_rpc_create_entity_atomic.sql for the function definition.
    const { data: rpcResult, error: rpcError } = await supabase.rpc("create_entity_atomic", {
      p_entity_type: entity_type,
      p_metadata: metadata,
      p_domain_data: domain_data,
    });

    if (rpcError) {
      // Classify error type for client
      const code = rpcError.message.includes("Unknown entity_type")
        ? "INVALID_ENTITY_TYPE"
        : rpcError.message.includes("domain insert")
        ? "DOMAIN_INSERT_FAILED"
        : "INTERNAL_ERROR";
      return new Response(
        JSON.stringify({ success: false, error: rpcError.message, code }),
        { status: code === "INTERNAL_ERROR" ? 500 : 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, entity: rpcResult.entity, domain: rpcResult.domain }),
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

> [!NOTE]
> **Expected response for valid request (HTTP 201):**
> ```json
> {
>   "success": true,
>   "entity": {
>     "id": "<uuid>",
>     "entity_type": "proof_of_work",
>     "storage_tier": "hot",
>     "created_at": "2026-...",
>     "metadata": {"source": "test"}
>   },
>   "domain": {
>     "id": "<uuid>",
>     "task_id": null,
>     "entity_id": "<same uuid as entity.id>",
>     ...
>   }
> }
> ```
> The `entity.id` and `domain.entity_id` must match — this confirms atomic insertion worked.

---

## Phase 2B: The Atomic RPC Migration (MUST run before deploying the function)

> [!IMPORTANT]
> **The `entity-create/index.ts` from Phase 2A is COMPLETE. Do NOT modify it further.**
> Phase 2B is ONLY about applying the database migration for the `create_entity_atomic` RPC function.
> There is NO dispatcher.ts file to create — all domain insert logic lives inside the Postgres RPC.

### What to Create

**File**: `supabase/migrations/20260406000006_rpc_create_entity_atomic.sql`

```sql
-- =========================================================================
-- HOT/COLD STORAGE: ATOMIC ENTITY CREATION RPC
-- Creates entity + domain record in one transaction.
-- If ANY insert fails, BOTH are rolled back. No orphan entities.
-- Idempotent: CREATE OR REPLACE is safe to re-run.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.create_entity_atomic(
  p_entity_type text,
  p_metadata    jsonb DEFAULT '{}',
  p_domain_data jsonb DEFAULT '{}'
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_entity   public.entities%ROWTYPE;
  v_domain   jsonb;
  v_task_id  uuid;
  v_user_id  uuid;
BEGIN
  -- Step 1: Validate entity_type is in the registry (fail fast before any inserts)
  IF NOT EXISTS (
    SELECT 1 FROM public.entity_type_registry WHERE entity_type = p_entity_type
  ) THEN
    RAISE EXCEPTION 'Unknown entity_type: %', p_entity_type;
  END IF;

  -- Step 2: Insert entity record (storage_tier defaults to 'hot' via column default)
  INSERT INTO public.entities (entity_type, metadata)
  VALUES (p_entity_type, COALESCE(p_metadata, '{}'))
  RETURNING * INTO v_entity;

  -- Step 3: Dispatch to the correct domain table based on entity_type
  -- Add a new WHEN block here for each new entity type.
  CASE p_entity_type
    WHEN 'proof_of_work' THEN
      -- Validate required domain fields
      v_task_id := (p_domain_data->>'task_id')::uuid;
      v_user_id := (p_domain_data->>'submitted_by')::uuid;

      IF v_task_id IS NULL THEN
        RAISE EXCEPTION 'proof_of_work domain insert requires task_id';
      END IF;
      IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'proof_of_work domain insert requires submitted_by';
      END IF;

      -- Insert the submission record linked to the entity
      -- NOTE: status is intentionally omitted — the DB column default ('pending') applies.
      INSERT INTO public.submissions (
        task_id,
        submitted_by,
        comment,
        links,
        entity_id
      ) VALUES (
        v_task_id,
        v_user_id,
        p_domain_data->>'comment',
        COALESCE(p_domain_data->'links', '[]'::jsonb),
        v_entity.id
      );

      -- Fetch the newly created submission back as JSON
      SELECT to_jsonb(s) INTO v_domain
      FROM public.submissions s
      WHERE s.entity_id = v_entity.id
      LIMIT 1;

    ELSE
      -- This should never be reached due to the registry check above,
      -- but is kept as a safety net.
      RAISE EXCEPTION 'Unknown entity_type: %', p_entity_type;
  END CASE;

  -- Step 4: Return both the entity and domain records
  RETURN jsonb_build_object(
    'entity', to_jsonb(v_entity),
    'domain', v_domain
  );
END;
$$;

-- Grant execute to service_role (Edge Functions use service role)
GRANT EXECUTE ON FUNCTION public.create_entity_atomic TO service_role;

NOTIFY pgrst, 'reload schema';
```

### How to Apply This Migration

```bash
# Option A: Push via CLI (recommended)
npx supabase db push --linked

# Option B: Run directly in SQL Editor
# Copy-paste the full SQL above into Supabase Dashboard → SQL Editor → Run
```

### Verify the RPC Was Created

```sql
SELECT routine_name, routine_type, security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'create_entity_atomic';
```

**Expected:**
| routine_name          | routine_type | security_type |
|-----------------------|--------------|---------------|
| create_entity_atomic  | FUNCTION     | DEFINER       |

### Test the RPC Directly in SQL Editor

This is the most direct way to verify atomicity works:

```sql
-- Test 1: Valid call (should succeed)
SELECT public.create_entity_atomic(
  'proof_of_work',
  '{"source": "rpc_direct_test"}',
  '{"task_id": "<VALID_TASK_UUID>", "submitted_by": "<VALID_USER_UUID>", "comment": "Direct RPC test"}'
);
-- Expected: JSON with entity and domain keys

-- Test 2: Invalid entity type (should FAIL with EXCEPTION)
SELECT public.create_entity_atomic('does_not_exist', '{}', '{}');
-- Expected: ERROR: Unknown entity_type: does_not_exist

-- Test 3: Missing required domain field (should FAIL and NOT create orphan entity)
SELECT public.create_entity_atomic('proof_of_work', '{}', '{"comment": "no task_id here"}');
-- Expected: ERROR: proof_of_work domain insert requires task_id
-- Then verify no orphan was created:
SELECT COUNT(*) FROM public.entities WHERE metadata = '{}'::jsonb;
-- Expected: 0 (the entity insert was rolled back too)

-- Cleanup
DELETE FROM public.submissions WHERE entity_id IN (
  SELECT id FROM public.entities WHERE metadata->>'source' = 'rpc_direct_test'
);
DELETE FROM public.entities WHERE metadata->>'source' = 'rpc_direct_test';
```

---

## Phase 2C: Response Normalization + Error Handling

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
