// public-support-request/index.ts
// Edge Function: Validates a CAPTCHA token and creates an Escalation Task for a public support request.
// Called by the PublicSupportForm component via an anonymous Supabase session.
//
// Required env vars (set in Supabase Dashboard → Edge Functions → Secrets):
//   SUPABASE_URL           — auto-injected by Supabase runtime
//   SUPABASE_SERVICE_ROLE_KEY — auto-injected by Supabase runtime
//   CAPTCHA_SECRET_KEY     — hCaptcha secret key

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
// CAPTCHA Verification (hCaptcha)
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
      images, // Optional — Array of { base64: string, mimeType: string }
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
    if (!images || !Array.isArray(images) || images.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "At least one image must be attached", code: "MISSING_IMAGE" }),
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
    // 3. Look up the user_profiles.id for this manager employee (for submitted_by).
    //    managerId = employees.id, but submissions.submitted_by → user_profiles.id.
    //    This is a best-effort lookup; falls back to null if the manager has no
    //    linked auth account (e.g. employee added manually, never logged in).
    // -------------------------------------------------------------------------
    let managerUserProfileId: string | null = null;
    try {
      const { data: profileData } = await supabaseAdmin
        .from("user_profiles")
        .select("id")
        .eq("employee_id", managerId)
        .maybeSingle();
      managerUserProfileId = profileData?.id ?? null;
    } catch (profileErr) {
      // Non-fatal — submission will be created with submitted_by = null
      console.warn("[public-support-request] Could not resolve manager user profile:", profileErr);
    }

    // -------------------------------------------------------------------------
    // 4. Optionally upload images to Supabase Storage
    // -------------------------------------------------------------------------
    const submissionLinks: any[] = [];

    if (Array.isArray(images) && images.length > 0) {
      for (const img of images) {
        if (!img.base64 || !img.mimeType) continue;
        
        try {
          // Decode base64 → Uint8Array
          const binaryStr = atob(img.base64);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }

          // Derive file extension from MIME type
          const ext = img.mimeType.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
          const fileName = `public-reports/${Date.now()}-${crypto.randomUUID()}.${ext}`;

          const { error: uploadError } = await supabaseAdmin.storage
            .from("field-submissions")
            .upload(fileName, bytes, { contentType: img.mimeType, upsert: false });

          if (uploadError) {
            console.warn("[public-support-request] Image upload failed:", uploadError.message);
          } else {
            // Resolve the public URL
            const { data: urlData } = supabaseAdmin.storage
              .from("field-submissions")
              .getPublicUrl(fileName);
              
            if (urlData?.publicUrl) {
              submissionLinks.push({
                file_name: `public_report_${submissionLinks.length + 1}.${ext}`,
                url: urlData.publicUrl,
                provider: "supabase",
                tier: "hot",
                mime_type: img.mimeType,
              });
            }
          }
        } catch (imgErr) {
          console.warn("[public-support-request] Image processing error:", imgErr);
        }
      }
    }

    // -------------------------------------------------------------------------
    // 5. Insert the task via Service Role key (bypasses RLS entirely)
    //
    // NOTE: task text and description are kept clean — no raw file paths.
    // The image is instead stored via a submissions record (step 7).
    // -------------------------------------------------------------------------
    const { data: taskData, error: taskError } = await supabaseAdmin
      .from("tasks")
      .insert({
        text: summary.trim(),
        vertical_id: "CHARGING_HUBS",
        stage_id: "BACKLOG",
        task_board: ["Escalations"],
        priority: "Urgent",
        assigned_to: managerId,
        hub_id: hubId ?? null,
        description: "Public cleaning report submitted via QR code.",
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

    // -------------------------------------------------------------------------
    // 6. Insert context links for polymorphic multi-hub/assignee support
    // -------------------------------------------------------------------------
    if (taskData?.id) {
      const contextLinks = [];
      if (hubId) {
        contextLinks.push({
          source_id: taskData.id,
          source_type: "task",
          entity_type: "hub",
          entity_id: hubId,
          is_active: true,
        });
      }
      if (managerId) {
        contextLinks.push({
          source_id: taskData.id,
          source_type: "task",
          entity_type: "assignee",
          entity_id: managerId,
          is_active: true,
        });
      }
      if (contextLinks.length > 0) {
        const { error: linksError } = await supabaseAdmin
          .from("task_context_links")
          .insert(contextLinks);

        if (linksError) {
          console.warn("[public-support-request] Failed to insert context links:", linksError);
        }
      }
    }

    // -------------------------------------------------------------------------
    // 7. If an image was uploaded, create a submission record so the photo
    //    renders as a clickable camera badge (📷) in the Kanban UI and is
    //    visible in the Submission History timeline.
    //
    //    Key decisions:
    //    - status = 'approved'  → skips the manager's Approve/Reject queue
    //    - comment matches the exact string the UI checks so it renders as
    //      "📎 Creation Attachments" instead of a submitter name
    //    - submitted_by = managerUserProfileId (nullable — OK after migration)
    // -------------------------------------------------------------------------
    if (taskData?.id && submissionLinks.length > 0) {

      const { error: submissionError } = await supabaseAdmin
        .from("submissions")
        .insert({
          task_id: taskData.id,
          submitted_by: managerUserProfileId, // null if manager has no auth account
          status: "approved",
          comment: "Attached photos during task creation.",
          links: submissionLinks,
        });

      if (submissionError) {
        // Non-fatal: task is already created. Log and continue.
        console.warn("[public-support-request] Failed to insert submission record:", submissionError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        taskId: taskData?.id ?? null
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
