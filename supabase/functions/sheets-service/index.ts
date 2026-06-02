// sheets-service/index.ts
// Edge Function: Proxy read/write requests to the Google Sheets API securely
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
  token_uri: string;
}

// Memory cache for token reuse across warm starts
let cachedToken: string | null = null;
let tokenExpiry = 0;

async function getAccessToken(serviceAccount: ServiceAccountKey): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  // 1. Generate JWT
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: serviceAccount.token_uri,
    iat: now,
    exp: now + 3600,
  };

  const base64url = (str: string) => btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const pemToBuffer = (pem: string) => {
    const b64 = pem
      .replace(/-----BEGIN PRIVATE KEY-----/g, "")
      .replace(/-----END PRIVATE KEY-----/g, "")
      .replace(/\n/g, "");
    const binary = atob(b64);
    const buffer = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      buffer[i] = binary.charCodeAt(i);
    }
    return buffer.buffer;
  };

  const unsignedToken = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToBuffer(serviceAccount.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsignedToken)
  );

  const encodedSignature = base64url(String.fromCharCode(...new Uint8Array(signature)));
  const jwt = `${unsignedToken}.${encodedSignature}`;

  // 2. Token Exchange
  const response = await fetch(serviceAccount.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Token exchange failed: ${errText}`);
  }

  const tokenData = await response.json();
  cachedToken = tokenData.access_token;
  tokenExpiry = Date.now() + (tokenData.expires_in - 60) * 1000;
  return cachedToken!;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Authorize caller JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const callerClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await callerClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Get Service Account secrets
    const keyJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
    if (!keyJson) {
      return new Response(
        JSON.stringify({ success: false, error: "Google credentials not configured on backend" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const serviceAccount: ServiceAccountKey = JSON.parse(keyJson);

    // 3. Parse and route sheets requests
    const body = await req.json();
    const { action, spreadsheetId, range, values, valueInputOption = "USER_ENTERED" } = body;

    if (!spreadsheetId) {
      return new Response(
        JSON.stringify({ success: false, error: "spreadsheetId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = await getAccessToken(serviceAccount);

    if (action === "getSpreadsheet") {
      const apiResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!apiResponse.ok) {
        const errorMsg = await apiResponse.text();
        return new Response(
          JSON.stringify({ success: false, error: `Google API Error: ${errorMsg}` }),
          { status: apiResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await apiResponse.json();
      return new Response(
        JSON.stringify({ success: true, data }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else if (action === "readSheet") {
      const targetRange = range || "Sheet1!A:Z";
      const apiResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(targetRange)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!apiResponse.ok) {
        const errorMsg = await apiResponse.text();
        return new Response(
          JSON.stringify({ success: false, error: `Google API Error: ${errorMsg}` }),
          { status: apiResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await apiResponse.json();
      return new Response(
        JSON.stringify({ success: true, data: data.values || [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else if (action === "appendRow") {
      if (!values || !Array.isArray(values)) {
        return new Response(
          JSON.stringify({ success: false, error: "values array is required for appendRow" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const targetRange = range || "Sheet1!A:A";
      const apiResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(targetRange)}:append?valueInputOption=${valueInputOption}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ values }),
        }
      );

      if (!apiResponse.ok) {
        const errorMsg = await apiResponse.text();
        return new Response(
          JSON.stringify({ success: false, error: `Google API Error: ${errorMsg}` }),
          { status: apiResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await apiResponse.json();
      return new Response(
        JSON.stringify({ success: true, updates: data.updates }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else if (action === "updateSheet") {
      if (!range) {
        return new Response(
          JSON.stringify({ success: false, error: "range is required for updateSheet" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (!values || !Array.isArray(values)) {
        return new Response(
          JSON.stringify({ success: false, error: "values array is required for updateSheet" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const apiResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=${valueInputOption}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ values }),
        }
      );

      if (!apiResponse.ok) {
        const errorMsg = await apiResponse.text();
        return new Response(
          JSON.stringify({ success: false, error: `Google API Error: ${errorMsg}` }),
          { status: apiResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await apiResponse.json();
      return new Response(
        JSON.stringify({ success: true, updatedCells: data.updatedCells }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else {
      return new Response(
        JSON.stringify({ success: false, error: `Unsupported action: ${action}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "An unknown error occurred";
    return new Response(
      JSON.stringify({ success: false, error: errorMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
