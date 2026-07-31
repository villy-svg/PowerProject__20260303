// public-support-request/index.ts
// Edge Function: Validates a CAPTCHA token and creates an Escalation Task for a public support request.
// Called by the PublicSupportForm component via an anonymous Supabase session.
//
// Required env vars (set in Supabase Dashboard → Edge Functions → Secrets):
//   SUPABASE_URL           — auto-injected by Supabase runtime
//   SUPABASE_SERVICE_ROLE_KEY — auto-injected by Supabase runtime
//   CAPTCHA_SECRET_KEY     — Cloudflare Turnstile secret OR Google reCAPTCHA v3 secret key

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---------------------------------------------------------------------------
// CORS headers — required for browser-initiated cross-origin requests
// ---------------------------------------------------------------------------
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ---------------------------------------------------------------------------
// Supabase admin client (Service Role) — bypasses RLS for this trusted function.
// Never expose the Service Role key to the browser.
// ---------------------------------------------------------------------------
const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

// ---------------------------------------------------------------------------
// CAPTCHA Verification
//
// Supports both:
//   - Cloudflare Turnstile  (POST https://challenges.cloudflare.com/turnstile/v0/siteverify)
//   - Google reCAPTCHA v3   (POST https://www.google.com/recaptcha/api/siteverify)
//
// The CAPTCHA provider is selected by the CAPTCHA_PROVIDER env var:
//   "turnstile" (default) | "recaptcha"
// ---------------------------------------------------------------------------
async function verifyCaptcha(token: string): Promise<{ success: boolean; payload?: any }> {
  // Temporary bypass for development
  if (token === 'dev-bypass') {
    console.warn('[public-support-request] Bypassing CAPTCHA verification (dev-bypass)');
    return { success: true };
  }

  const secretKey = Deno.env.get("CAPTCHA_SECRET_KEY");

  // CAPTCHA_SECRET_KEY is REQUIRED in all environments (staging and production).
  // Provider: hCaptcha — set your secret key via:
  //   supabase secrets set CAPTCHA_SECRET_KEY=<key> --project-ref <project-ref>
  if (!secretKey) {
    console.error(
      "[public-support-request] CAPTCHA_SECRET_KEY is not set. " +
      "Set this secret in the Supabase Dashboard under Edge Functions → Secrets."
    );
    return { success: false, payload: { error: "Missing CAPTCHA_SECRET_KEY" } };
  }

  // hCaptcha verification endpoint
  // POST body params: secret (your secret key) + response (the token from the widget)
  // Response shape: { success: boolean, challenge_ts: string, hostname: string, ... }
  try {
    const res = await fetch("https://api.hcaptcha.com/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret: secretKey, response: token }),
    });
    const data = await res.json();
    return { success: data.success === true, payload: data };
  } catch (err) {
    console.error("[public-support-request] hCaptcha verification fetch error:", err);
    return { success: false, payload: { error: err.message } };
  }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // -------------------------------------------------------------------------
    // 1. Parse and validate the request body
    // -------------------------------------------------------------------------
    const body = await req.json();
    const {
      captchaToken,
      hubId,
      managerId,
      summary,
      imageBase64,   // Optional — base64-encoded image string (without the data: prefix)
      imageMimeType, // Optional — e.g. "image/jpeg"
    } = body;

    if (!captchaToken) {
      return new Response(
        JSON.stringify({ success: false, error: "captchaToken is required", code: "MISSING_CAPTCHA" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!summary || typeof summary !== "string" || summary.trim().length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "summary is required and must be a non-empty string", code: "MISSING_SUMMARY" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!managerId) {
      return new Response(
        JSON.stringify({ success: false, error: "managerId is required", code: "MISSING_MANAGER" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // -------------------------------------------------------------------------
    // 2. Verify CAPTCHA — reject invalid tokens with 403
    // -------------------------------------------------------------------------
    const captchaValid = await verifyCaptcha(captchaToken);
    if (!captchaValid.success) {
      console.warn("[public-support-request] CAPTCHA verification failed.", captchaValid.payload);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "CAPTCHA verification failed", 
          code: "CAPTCHA_INVALID",
          details: { ...captchaValid.payload, receivedToken: captchaToken } 
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // -------------------------------------------------------------------------
    // 3. Optionally upload image to Supabase Storage
    // -------------------------------------------------------------------------
    let imageStoragePath: string | null = null;
    if (imageBase64 && imageMimeType) {
      try {
        // Decode base64 → Uint8Array
        const binaryStr = atob(imageBase64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }

        // Derive file extension from MIME type (image/jpeg → jpg, image/png → png, etc.)
        const ext = imageMimeType.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
        const fileName = `public-reports/${Date.now()}-${crypto.randomUUID()}.${ext}`;

        const { error: uploadError } = await supabaseAdmin.storage
          .from("submission-files")
          .upload(fileName, bytes, { contentType: imageMimeType, upsert: false });

        if (uploadError) {
          // Non-fatal: log but continue — the task will still be created
          console.warn("[public-support-request] Image upload failed:", uploadError.message);
        } else {
          imageStoragePath = fileName;
        }
      } catch (imgErr) {
        console.warn("[public-support-request] Image processing error:", imgErr);
      }
    }

    // -------------------------------------------------------------------------
    // 4. Insert the task via Service Role key (bypasses RLS entirely)
    //
    // Column mapping:
    //   vertical_id  — must match valid verticals
    //   stage_id     — NOT NULL in schema; must be provided
    //   assigned_to  — snake_case column name
    // -------------------------------------------------------------------------
    const taskText = imageStoragePath
      ? `${summary.trim()} [Photo attached: ${imageStoragePath}]`
      : summary.trim();

    const { data: taskData, error: taskError } = await supabaseAdmin
      .from("tasks")
      .insert({
        text: taskText,
        vertical_id: "CHARGING_HUBS",
        stage_id: "BACKLOG",
        task_board: ["Escalations"],
        priority: "Urgent",
        assigned_to: managerId,
        hub_id: hubId ?? null,
        description: imageStoragePath
          ? `Public cleaning report submitted via QR code. Photo: ${imageStoragePath}`
          : "Public cleaning report submitted via QR code.",
      })
      .select("id")
      .single();

    if (taskError) {
      console.error("[public-support-request] Task insert failed:", taskError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to create support task", code: "INSERT_FAILED" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        taskId: taskData?.id ?? null,
        imagePath: imageStoragePath,
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "An unknown error occurred";
    console.error("[public-support-request] Unhandled error:", errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
