// entity-create/index.ts
// Edge Function: Creates an entity + domain record atomically
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Validate caller is authenticated
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

    // 2. Strict Service Role Security
    // This is an internal ingestion endpoint. We verify the token role is 'service_role'.
    try {
      const tokenParts = authHeader.split(' ')[1].split('.');
      // Use Deno-safe base64 decoding
      const payload = JSON.parse(atob(tokenParts[1]));
      
      if (payload.role !== 'service_role') {
        throw new Error('Forbidden: Requires service_role key');
      }
    } catch (_err) {
      return new Response(
        JSON.stringify({ success: false, error: "Service Role authorization required", code: "FORBIDDEN" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
    // See: supabase/migrations/20260406000006_rpc_create_entity_atomic.sql for the function definition.
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
    const errorMessage = err instanceof Error ? err.message : "An unknown error occurred";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
