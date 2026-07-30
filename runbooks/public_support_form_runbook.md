# Runbook: Public Request Support Flow (Extension)

This runbook outlines the steps to build and deploy the Public Support Form, the Spam Protection architecture, and the Admin QR Generator.

## Prerequisites
- Supabase Project with Edge Functions enabled.
- Cloudflare Turnstile or Google reCAPTCHA v3 site keys.
- `@zxing/library` or `qrcode.react` (if not already installed) for generating QR codes.

## Phase 1: Supabase Configuration & Edge Function

### 1.1 Enable Anonymous Auth
1. Go to your Supabase Dashboard -> Authentication -> Providers.
2. Ensure **Anonymous sign-ins** are enabled.

### 1.2 Create the Edge Function
1. Create a new Edge Function: `supabase functions new public-support-request`.
2. In the function (`supabase/functions/public-support-request/index.ts`), implement the following logic:
   - Extract the Captcha token from the request body.
   - Verify the token with the Captcha provider's verification endpoint.
   - If invalid, return a `403 Forbidden`.
   - If valid, use the Supabase Service Role key (or the user's Anon JWT) to insert a new row into the `tasks` table with:
     - `verticalId`: `'escalation_tasks'`
     - `priority`: `'High'`
     - `assignedTo`: (Extracted from the request payload)
     - `text`: (Extracted from the request payload)
   - Handle the base64 or multipart image upload to the Supabase Storage bucket.
3. Deploy the function: `supabase functions deploy public-support-request`.

### 1.3 Update RLS Policies
1. Ensure the `tasks` table allows `INSERT` operations for the `anon` role (or let the Edge Function handle it via the Service Role key, bypassing RLS entirely for this specific endpoint). 
*(Recommendation: Letting the Edge Function use the Service Role key is safer as you don't need to open the `tasks` table to the `anon` role directly).*

---

## Phase 2: Frontend Routing & Public UI

### 2.1 Update `src/App.jsx` Routing
1. In `src/App.jsx`, immediately before the `!session` check that returns `<Login />`, add a bypass for the public route.
```javascript
const isPublicSupportRoute = window.location.pathname === '/public/report';

if (isPublicSupportRoute) {
  return (
    <div className="app-container" data-theme={darkMode ? 'dark' : 'light'}>
      <PublicSupportForm />
    </div>
  );
}
```

### 2.2 Create `PublicSupportForm.jsx`
1. Create `src/components/public/PublicSupportForm.jsx`.
2. On mount, call `supabase.auth.signInAnonymously()` to establish a session.
3. Use `new URLSearchParams(window.location.search)` to extract `hubId`, `managerId`, and `summary`.
4. Render a minimalist UI:
   - A title: "Submit Support Request".
   - A file upload dropzone (reuse the logic from `SubmissionModal.jsx` for 25MB limits and auto-compression).
   - An invisible Captcha widget.
   - A "Submit" button.
5. On submit:
   - Trigger the Captcha to get the token.
   - Call the `public-support-request` Edge Function via `supabase.functions.invoke()`, passing the token, the IDs, and the image data.

---

## Phase 3: The "Cleaning QR Generator" (Admin Tool)

### 3.1 Create the Generator Component
1. Create `src/verticals/DataManager/components/CleaningQRGenerator.jsx`.
2. Install `qrcode.react` if needed (`npm install qrcode.react`).
3. Build a UI with:
   - A dropdown for Hubs.
   - A dropdown for Managers.
   - A `<QRCodeCanvas />` or `<QRCodeSVG />` component that renders the URL: `https://your-domain.com/public/report?hubId={selectedHub}&managerId={selectedManager}&summary=Cleaning%20Issue`.
   - A "Download QR" button that triggers a canvas download.

### 3.2 Place the Tile in System Configuration
1. Open `src/verticals/DataManager/DataManagerWorkspace.jsx`.
2. Locate the "Hubs" section (near "Hub Function Management").
3. Add the new `CleaningQRGenerator` tile.
4. Ensure it is protected by the appropriate RBAC guard (e.g., `permissions.canAccessConfig`).

---

## Phase 4: Verification
1. Log in as a Master Admin. Navigate to System Configuration -> Hubs -> Cleaning QR Generator.
2. Generate and download a QR code for a test hub and manager.
3. Open a completely incognito browser window (simulating a non-user phone scan) and navigate to the generated URL.
4. Ensure the UI is minimalist and doesn't display internal data.
5. Upload a photo and click submit.
6. Verify the Captcha validates silently.
7. Log into the app as the assigned Manager and confirm the new Escalation Task appears on the Centralised Task Board with the photo attached.
