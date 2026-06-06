# Runbook 03: Supabase Edge Function (verify-firebase-phone)

## Goal
Create an Edge Function that verifies a Firebase ID token, finds the employee's Gmail, and issues a Supabase Magic Link OTP.

## Steps

1. **Create the Function**
   - Run the Supabase CLI command:
     ```bash
     supabase functions new verify-firebase-phone
     ```

2. **Implement the Logic**
   - Open `supabase/functions/verify-firebase-phone/index.ts`.
   - Implement the following flow (pseudocode structure):
     - **CORS Handling**: Handle OPTIONS preflight requests.
     - **Parse Request**: Extract the `firebaseToken` from the POST body.
     - **Verify Firebase Token**: Using Google's public JSON Web Key Set (JWKS) or Firebase Admin HTTP API, verify the token signature and extract `phone_number`.
     - **Query Supabase**: Using the Supabase Service Role Key:
       ```typescript
       const { data: employee, error } = await supabaseAdmin
         .from('employees')
         .select('email')
         .eq('phone', phone_number)
         .single();
         
       if (!employee || !employee.email) {
           throw new Error("Phone number not registered to an active employee");
       }
       ```
     - **Generate Supabase OTP**:
       ```typescript
       const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
         type: 'magiclink',
         email: employee.email,
       });
       ```
     - **Return OTP**: Return `{ email_otp: linkData.properties.email_otp, email: employee.email }` to the client.

3. **Deploy the Function**
   - Deploy to Supabase:
     ```bash
     supabase functions deploy verify-firebase-phone --no-verify-jwt
     ```
   - Note: We use `--no-verify-jwt` because this function handles login and the user does not have a Supabase JWT yet when calling it.

4. **Verify Secrets**
   - Ensure the Edge Function environment has `FIREBASE_SERVICE_ACCOUNT_JSON` available (this was already set up for push notifications).
