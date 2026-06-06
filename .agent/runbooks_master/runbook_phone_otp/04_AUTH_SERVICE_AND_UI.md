# Runbook 04: Auth Service & UI Integration

## Goal
Update `authService.js` to coordinate the Shadow Login flow, and update `Login.jsx` to render the phone input and Firebase reCAPTCHA.

## Steps

1. **Update `authService.js`**
   - Add a new method: `loginWithFirebasePhone(firebaseIdToken)`
   - Flow:
     - Invoke the Supabase Edge Function created in Runbook 03:
       ```javascript
       const { data, error } = await supabase.functions.invoke('verify-firebase-phone', {
         body: { firebaseToken: firebaseIdToken }
       });
       ```
     - Extract `email_otp` and `email` from the response.
     - Call Supabase to finalize login:
       ```javascript
       return await supabase.auth.verifyOtp({
         email: data.email,
         token: data.email_otp,
         type: 'email'
       });
       ```

2. **Update `Login.jsx`**
   - Import `RecaptchaVerifier` and `signInWithPhoneNumber` from `firebase/auth`.
   - Add state for Phone Login mode (toggle between Gmail and Phone).
   - Set up an invisible reCAPTCHA:
     ```javascript
     if (!window.recaptchaVerifier) {
       window.recaptchaVerifier = new RecaptchaVerifier(firebaseAuth, 'sign-in-button', {
         'size': 'invisible'
       });
     }
     ```
   - Request OTP from Firebase:
     ```javascript
     const confirmationResult = await signInWithPhoneNumber(firebaseAuth, phoneNumber, window.recaptchaVerifier);
     setConfirmationResult(confirmationResult);
     ```
   - Verify OTP from Firebase:
     ```javascript
     const result = await confirmationResult.confirm(otpCode);
     const firebaseToken = await result.user.getIdToken();
     
     // Now call our authService to complete the Shadow Login
     await authService.loginWithFirebasePhone(firebaseToken);
     ```

## Success Check
- User enters phone number -> Receives SMS via Firebase.
- User enters SMS code -> Successfully logs into Supabase with their original Gmail account `auth.uid()`.
