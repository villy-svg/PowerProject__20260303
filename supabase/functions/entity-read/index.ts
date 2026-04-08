// entity-read/index.ts
// Edge Function: Reads an entity + domain data (hot path only — cold path in Phase 7)
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
    // 1. Validate Caller Authentication (Strict Security)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing Authorization header", code: "UNAUTHORIZED" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify token validity
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    
    const { data: { user }, error: authError } = await callerClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid or expired token", code: "UNAUTHORIZED" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Initialize Service Role Client for Internal Lookup
    const supabase = createClient(
      supabaseUrl,
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

    // 3. Fetch entity record
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

    // 4. Route based on storage tier
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
      // Fetch submission joined with profile
      // Alignment: Using the explicit FK path as defined in schemas
      const { data, error } = await supabase
        .from("submissions")
        .select("*, submitted_by_profile:user_profiles!submissions_submitted_by_fkey(name, email)")
        .eq("entity_id", entity.id)
        .single();

      if (error || !data) return { table: "submissions", record_id: null, data: null };
      return { table: "submissions", record_id: data.id, data };
    },
    // Future entity types (checklists, logs, etc.) added here
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
    updated_at: entity.updated_at,
    archived_at: entity.archived_at,
    metadata: entity.metadata || {},
  };
}
