// user-admin/index.ts
// Edge Function: Privileged user lifecycle management for Master Admins
//
// ─────────────────────────────────────────────────────────────────────────
// WHY AN EDGE FUNCTION?
// ─────────────────────────────────────────────────────────────────────────
// auth.users is owned by GoTrue (Supabase Auth). Regular PostgreSQL functions
// cannot INSERT/DELETE/UPDATE it safely — it requires the service-role key via
// the Auth Admin API. This Edge Function is the secure bridge:
//   • Runs with the service-role key (never exposed to the client)
//   • Verifies the CALLER is a master_admin before any privileged operation
//   • Delegates public.* cleanup to SQL RPCs (purge_user, rename_preset)
//
// ─────────────────────────────────────────────────────────────────────────
// SUPPORTED ACTIONS
// ─────────────────────────────────────────────────────────────────────────
//   create_preset   — Creates a dummy @preset.local user for permission templates
//   invite_user     — Sends a Supabase magic-link invite to a real employee email
//   delete_user     — Hard-deletes a user from auth + public (purge_user RPC)
//   reset_password  — Sends a password reset email (for real user accounts)
//   ban_user        — Supabase-layer hard ban (complements our is_active soft-lock)
//   unban_user      — Lifts a Supabase-layer hard ban
//   rename_preset   — Renames a preset profile's display name
//
// ─────────────────────────────────────────────────────────────────────────
// REQUEST FORMAT
// ─────────────────────────────────────────────────────────────────────────
//   POST /user-admin
//   Authorization: Bearer <caller_jwt>
//   Content-Type: application/json
//   { "action": "<action>", ...action_params }
//
// ─────────────────────────────────────────────────────────────────────────
// RESPONSE FORMAT
// ─────────────────────────────────────────────────────────────────────────
//   Success: { "success": true, "data": { ... } }
//   Error:   { "success": false, "error": "<message>", "code": "<CODE>" }
//
// =========================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Clients ─────────────────────────────────────────────────────────────────
// Service-role client — has full access to auth.users Admin API and bypasses RLS.
// Created once at module level; reused across warm starts.
const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ── Helpers ──────────────────────────────────────────────────────────────────
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const err = (message: string, code: string, status = 400) =>
  json({ success: false, error: message, code }, status);

// ── Main Handler ─────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ── Step 1: Authenticate caller via their JWT ──────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return err("Missing Authorization header", "UNAUTHORIZED", 401);

    const callerClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user: caller }, error: authError } = await callerClient.auth.getUser();
    if (authError || !caller) return err("Invalid or expired token", "UNAUTHORIZED", 401);

    // ── Step 2: Verify caller is master_admin ──────────────────────────────
    // We query via the service-role client (bypasses RLS) for a reliable check.
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .select("role_id, name")
      .eq("id", caller.id)
      .single();

    if (profileError || profile?.role_id !== "master_admin") {
      return err("Forbidden: Master Admin access required", "FORBIDDEN", 403);
    }

    // ── Step 3: Parse body ─────────────────────────────────────────────────
    const body = await req.json();
    const { action, ...params } = body;
    if (!action) return err("Missing required field: action", "MISSING_ACTION");

    // ── Step 4: Route to action handler ───────────────────────────────────
    switch (action) {

      // ────────────────────────────────────────────────────────────────────
      // create_preset
      // Creates a dummy auth user with a @preset.local email that can never
      // be used to log in. The handle_new_user() trigger fires automatically
      // and creates the user_profiles row.
      //
      // Params: { name: string }
      // ────────────────────────────────────────────────────────────────────
      case "create_preset": {
        const { name } = params;
        if (!name?.trim()) return err("Missing or empty param: name", "MISSING_PARAM");

        const slug = name.toLowerCase().replace(/[^a-z0-9]/g, "_");
        const fakeEmail = `${slug}_${Date.now()}@preset.local`;

        const { data, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email: fakeEmail,
          // Random non-guessable password — preset accounts CANNOT log in
          password: crypto.randomUUID() + crypto.randomUUID(),
          email_confirm: true,  // No confirmation email sent
          user_metadata: { name: name.trim(), is_preset: true },
        });

        if (createErr) return err(createErr.message, "CREATE_FAILED");

        return json({
          success: true,
          data: { userId: data.user.id, email: fakeEmail, name: name.trim() },
        }, 201);
      }

      // ────────────────────────────────────────────────────────────────────
      // invite_user
      // Sends a Supabase magic-link invite email to a real employee.
      // The user must click the link to activate their account.
      // handle_new_user() fires on their first login and creates user_profiles.
      //
      // Params: { email: string, name?: string }
      // ────────────────────────────────────────────────────────────────────
      case "invite_user": {
        const { email, name } = params;
        if (!email?.trim()) return err("Missing or empty param: email", "MISSING_PARAM");

        const { data, error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(
          email.trim(),
          { data: { name: name?.trim() || email.split("@")[0] } }
        );

        if (inviteErr) return err(inviteErr.message, "INVITE_FAILED");

        return json({
          success: true,
          data: { userId: data.user.id, email: data.user.email },
        });
      }

      // ────────────────────────────────────────────────────────────────────
      // delete_user
      // Hard-deletes a user: purges all public.* data first (via RPC),
      // then removes the auth.users entry.
      //
      // Use for: preset profiles, and permanent account removals.
      // NOT for deactivation — use deactivate_user() RPC for that.
      //
      // Params: { userId: string }
      // ────────────────────────────────────────────────────────────────────
      case "delete_user": {
        const { userId } = params;
        if (!userId) return err("Missing param: userId", "MISSING_PARAM");

        // Step 1: Wipe all public-schema data (audit log written inside RPC)
        const { error: purgeErr } = await supabaseAdmin.rpc("purge_user", {
          p_target_id: userId,
        });
        if (purgeErr) return err(`Purge failed: ${purgeErr.message}`, "PURGE_FAILED");

        // Step 2: Delete from auth.users
        const { error: deleteErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (deleteErr) return err(`Auth delete failed: ${deleteErr.message}`, "DELETE_FAILED");

        return json({ success: true, data: { deletedUserId: userId } });
      }

      // ────────────────────────────────────────────────────────────────────
      // reset_password
      // Generates a password reset link and sends it via Supabase email.
      // Works on real user accounts only (preset @preset.local accounts
      // should never need this since they can't log in).
      //
      // Params: { email: string }
      // ────────────────────────────────────────────────────────────────────
      case "reset_password": {
        const { email } = params;
        if (!email?.trim()) return err("Missing or empty param: email", "MISSING_PARAM");
        if (email.endsWith("@preset.local")) {
          return err("Preset profiles do not have passwords.", "INVALID_TARGET");
        }

        const { data, error: resetErr } = await supabaseAdmin.auth.admin.generateLink({
          type: "recovery",
          email: email.trim(),
        });

        if (resetErr) return err(resetErr.message, "RESET_FAILED");

        // We don't expose the raw link in the response for security —
        // Supabase sends the email directly.
        return json({ success: true, data: { email: data.user.email } });
      }

      // ────────────────────────────────────────────────────────────────────
      // ban_user
      // Applies a Supabase-layer hard ban. This is a complement to our
      // is_active soft-lock. Use when you need to invalidate all active
      // sessions immediately (e.g. security incident).
      //
      // Our is_active=false RLS policies are the first layer of enforcement.
      // Supabase ban is the second layer — prevents new token issuance even
      // if RLS were somehow bypassed.
      //
      // Params: { userId: string }
      // ────────────────────────────────────────────────────────────────────
      case "ban_user": {
        const { userId } = params;
        if (!userId) return err("Missing param: userId", "MISSING_PARAM");

        // 876600h ≈ 100 years — effectively permanent
        const { error: banErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          ban_duration: "876600h",
        });
        if (banErr) return err(banErr.message, "BAN_FAILED");

        return json({ success: true, data: { bannedUserId: userId } });
      }

      // ────────────────────────────────────────────────────────────────────
      // unban_user
      // Lifts a Supabase-layer hard ban. Does NOT restore is_active or
      // permissions — use reactivate_user() RPC and the Permission Editor
      // for that.
      //
      // Params: { userId: string }
      // ────────────────────────────────────────────────────────────────────
      case "unban_user": {
        const { userId } = params;
        if (!userId) return err("Missing param: userId", "MISSING_PARAM");

        const { error: unbanErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          ban_duration: "none",
        });
        if (unbanErr) return err(unbanErr.message, "UNBAN_FAILED");

        return json({ success: true, data: { unbannedUserId: userId } });
      }

      // ────────────────────────────────────────────────────────────────────
      // rename_preset
      // Renames a preset profile's display name (user_profiles.name).
      // Delegates to the rename_preset() SQL RPC.
      //
      // Params: { userId: string, newName: string }
      // ────────────────────────────────────────────────────────────────────
      case "rename_preset": {
        const { userId, newName } = params;
        if (!userId) return err("Missing param: userId", "MISSING_PARAM");
        if (!newName?.trim()) return err("Missing or empty param: newName", "MISSING_PARAM");

        const { error: renameErr } = await supabaseAdmin.rpc("rename_preset", {
          p_target_id: userId,
          p_new_name: newName.trim(),
        });
        if (renameErr) return err(renameErr.message, "RENAME_FAILED");

        return json({ success: true, data: { userId, newName: newName.trim() } });
      }

      // ────────────────────────────────────────────────────────────────────
      // Unknown action
      // ────────────────────────────────────────────────────────────────────
      default:
        return err(
          `Unknown action: "${action}". Valid actions: create_preset, invite_user, delete_user, reset_password, ban_user, unban_user, rename_preset`,
          "UNKNOWN_ACTION"
        );
    }

  } catch (e) {
    const message = e instanceof Error ? e.message : "An unknown error occurred";
    return err(message, "INTERNAL_ERROR", 500);
  }
});
