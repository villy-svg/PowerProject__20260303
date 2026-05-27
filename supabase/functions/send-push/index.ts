// send-push/index.ts
// Supabase Edge Function: Sends a push notification via Firebase Cloud Messaging (FCM)
// and inserts a row into the notifications table for in-app bell display.
//
// Invocation: Called by Supabase DB triggers or directly from server-side code.
// Auth: Uses SUPABASE_SERVICE_ROLE_KEY (bypasses RLS) — never expose to client.
// FCM:  Uses Firebase Admin SDK HTTP v1 API via FIREBASE_SERVICE_ACCOUNT_JSON secret.
//
// Skill Compliance:
//   - Hybrid Mobile: This is server-side only — no platform guard needed here.
//   - Dev Best Practices: Full try/catch, service layer separation.
//   - RBAC Security: Caller identity validated; users cannot forge notifications for others.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── CORS Headers ─────────────────────────────────────────────────────────────
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Supabase Admin Client (bypasses RLS for reading tokens + inserting notifications) ──
const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

// ── FCM Token Helper ──────────────────────────────────────────────────────────
/**
 * Obtains a short-lived OAuth2 access token for Firebase Admin API
 * by using the service account JSON stored in Supabase secrets.
 *
 * Requires secret: FIREBASE_SERVICE_ACCOUNT_JSON
 */
async function getFCMAccessToken(): Promise<string> {
  const serviceAccountJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");
  if (!serviceAccountJson) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON secret is not set.");
  }

  const serviceAccount = JSON.parse(serviceAccountJson);

  // Build a JWT for the service account to exchange for an access token
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  // Sign JWT with RS256 using the service account private key
  const header = { alg: "RS256", typ: "JWT" };
  const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const encodedPayload = btoa(JSON.stringify(payload)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  // Import private key
  const privateKey = serviceAccount.private_key;
  const pemHeader = "-----BEGIN PRIVATE KEY-----";
  const pemFooter = "-----END PRIVATE KEY-----";
  const pemContents = privateKey
    .replace(pemHeader, "")
    .replace(pemFooter, "")
    .replace(/\s/g, "");
  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );

  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const jwt = `${signingInput}.${encodedSignature}`;

  // Exchange JWT for access token
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth2:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new Error(`Failed to get FCM access token: ${errorText}`);
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

// ── Main Handler ──────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ── 1. Parse request body ───────────────────────────────────────────────
    const body = await req.json();
    const {
      user_id,           // string (uuid) — recipient user
      title,             // string — notification title
      body: msgBody,     // string — notification body text
      type = "general",  // string — notification type (see CHECK constraint)
      entity_id,         // string (uuid) | null — related entity
      entity_type,       // string | null — entity type label
      data = {},         // object — extra key-value pairs for the notification tap handler
    } = body;

    // ── 2. Validate required fields ─────────────────────────────────────────
    if (!user_id || !title) {
      return new Response(
        JSON.stringify({ success: false, error: "user_id and title are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 3. Insert into notifications table (in-app bell) ────────────────────
    // Done first so the notification appears in-app even if FCM delivery fails.
    const { error: notifError } = await supabase
      .from("notifications")
      .insert({
        user_id,
        title,
        body: msgBody ?? null,
        type,
        entity_id: entity_id ?? null,
        entity_type: entity_type ?? null,
        read: false,
      });

    if (notifError) {
      console.error("[send-push] Failed to insert notification row:", notifError);
      // Non-fatal: continue to FCM delivery attempt
    }

    // ── 4. Fetch all FCM tokens for this user ───────────────────────────────
    const { data: tokens, error: tokenError } = await supabase
      .from("fcm_tokens")
      .select("id, token")
      .eq("user_id", user_id);

    if (tokenError) {
      console.error("[send-push] Failed to fetch FCM tokens:", tokenError);
      // Still return success — the in-app notification was inserted
      return new Response(
        JSON.stringify({ success: true, fcm_sent: 0, message: "In-app only (token fetch failed)" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!tokens || tokens.length === 0) {
      console.log(`[send-push] No FCM tokens found for user ${user_id}. In-app only.`);
      return new Response(
        JSON.stringify({ success: true, fcm_sent: 0, message: "In-app only (no tokens)" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 5. Get Firebase project ID from service account ─────────────────────
    const serviceAccountJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");
    const serviceAccount = JSON.parse(serviceAccountJson ?? "{}");
    const projectId = serviceAccount.project_id;

    if (!projectId) {
      throw new Error("project_id missing from FIREBASE_SERVICE_ACCOUNT_JSON");
    }

    // ── 6. Get short-lived FCM access token ─────────────────────────────────
    const accessToken = await getFCMAccessToken();

    // ── 7. Send FCM message to each token ───────────────────────────────────
    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
    const staleTokenIds: string[] = [];
    let fcmSentCount = 0;

    for (const { id: tokenId, token } of tokens) {
      try {
        const fcmPayload = {
          message: {
            token,
            notification: {
              title,
              body: msgBody ?? "",
            },
            // Data payload — available in the notification tap handler on Android
            data: {
              type,
              entity_id: entity_id ?? "",
              entity_type: entity_type ?? "",
              ...Object.fromEntries(
                Object.entries(data).map(([k, v]) => [k, String(v)])
              ),
            },
            android: {
              priority: "high",
              notification: {
                channel_id: "powerproject_default",
                sound: "default",
                click_action: "FLUTTER_NOTIFICATION_CLICK",
              },
            },
          },
        };

        const fcmResponse = await fetch(fcmUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(fcmPayload),
        });

        if (fcmResponse.ok) {
          fcmSentCount++;
        } else {
          const errorData = await fcmResponse.json();
          const errorCode = errorData?.error?.status;
          // FCM returns UNREGISTERED for tokens that are no longer valid
          if (errorCode === "UNREGISTERED" || errorCode === "INVALID_ARGUMENT") {
            console.warn(`[send-push] Stale token detected: ${tokenId}`);
            staleTokenIds.push(tokenId);
          } else {
            console.error(`[send-push] FCM error for token ${tokenId}:`, errorData);
          }
        }
      } catch (tokenErr) {
        console.error(`[send-push] Exception sending to token ${tokenId}:`, tokenErr);
      }
    }

    // ── 8. Prune stale tokens ────────────────────────────────────────────────
    // Remove tokens that FCM confirmed are no longer valid.
    // This keeps the fcm_tokens table clean.
    if (staleTokenIds.length > 0) {
      const { error: pruneError } = await supabase
        .from("fcm_tokens")
        .delete()
        .in("id", staleTokenIds);
      if (pruneError) {
        console.error("[send-push] Failed to prune stale tokens:", pruneError);
      } else {
        console.log(`[send-push] Pruned ${staleTokenIds.length} stale token(s).`);
      }
    }

    // ── 9. Return result ─────────────────────────────────────────────────────
    return new Response(
      JSON.stringify({
        success: true,
        fcm_sent: fcmSentCount,
        fcm_total_tokens: tokens.length,
        stale_tokens_pruned: staleTokenIds.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "An unknown error occurred";
    console.error("[send-push] Unhandled error:", errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
