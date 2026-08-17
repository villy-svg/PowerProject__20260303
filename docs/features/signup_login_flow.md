# Signup & Login Flow / PRD & TRD

**Status:** Implemented (Production)  
**Date:** 2026-08-12  

## 0. Context & Objectives (The Why & The Boundaries)
*   **0a. Core Objective:** Provide a secure, passwordless authentication mechanism (OTP via email) for users to register and log in to PowerProject. Ensure bots are blocked and unapproved users cannot bypass the `PendingActivation` state.
*   **0b. Success Metrics:** 
    *   100% of authentications go through Supabase OTP.
    *   Zero bot signups (measured via honeypot/timing traps).
*   **0c. Out of Scope:** Social Logins (Google/Apple), SMS-based OTP, and traditional Email/Password combinations are currently out of scope to reduce attack surface and credential management overhead.

## 1. Current State & Dependencies (The Implementation)
*   **1a. Technical:** 
    *   **Core Library:** Supabase Auth (`supabase.auth.signInWithOtp`, `verifyOtp`).
    *   **Service Layer:** `src/services/auth/authService.js` (currently just exports the Supabase client wrapper, while `Login.jsx` handles the heavy lifting).
*   **1b. Product (The UI Flow):** 
    *   User navigates to `/login`.
    *   Selects either "Sign In" or "Register".
    *   Enters Email (and Name if registering).
    *   Submits form -> receives 8-digit OTP via email -> enters OTP in Step 2.
    *   Successful OTP verification redirects them based on `AuthContext` state.
*   **1c. Logical (Anti-Bot & Fallbacks):** 
    *   **Honeypot:** A hidden input field (`phone_number`). If filled, the submission is silently dropped.
    *   **Time-Trap:** If the form is submitted within 1500ms of mounting, it is flagged as a bot and dropped.
    *   **Register Flow (Single API call / Supabase Upsert):** The Register tab makes a single call `signInWithOtp({ shouldCreateUser: true })`. Supabase handles both new and existing users natively — new users get their account created, existing users get a standard sign-in OTP. No double API call, no rate limiting risk, no split email templates.
    *   **Fallback Logic (Sign In → Register — Auto-switch):** If a user is on the Sign-In tab and enters an email that doesn't exist, the system catches the `Signups not allowed` error and **automatically switches the UI to the Register tab**, reveals the Full Name field, and shows a clear directive message. No dead-end error.
    *   **Name Field:** The Full Name field is visible on the Register tab but is **no longer a hard requirement**. It is passed to Supabase for new accounts (stored in `user_metadata`) and silently ignored for existing users who land on the Register tab.
*   **1d. Data & State:** 
    *   State is managed locally in `Login.jsx` (`step`, `email`, `otp`, `isRegistering`).
    *   Global state is handled by `AuthContext.jsx`, listening to Supabase session changes.

---

## 2. Alternative Approaches & Trade-offs

Here are the alternative architectures that were (or could be) considered for this flow, and why the current approach was chosen:

### Alternative 1: Traditional Email & Password
Instead of OTPs, users create a password during registration and use it to log in.
*   **Pros:** 
    *   Faster login for returning users (browsers can auto-fill passwords).
    *   No reliance on email delivery speed for every single login.
*   **Cons:** 
    *   Requires implementing "Forgot Password" flows.
    *   Higher security risk (users reuse weak passwords).
*   **Why we didn't do it:** OTPs shift the security burden entirely to the user's email provider, eliminating credential stuffing attacks against PowerProject.

### Alternative 2: Supabase Auth UI (Pre-built Component)
Using the `@supabase/auth-ui-react` package instead of a custom `Login.jsx` form.
*   **Pros:** 
    *   Zero maintenance. Supabase handles all edge cases, errors, and UI states automatically.
    *   Easy to turn on Social Logins later with just a dashboard toggle.
*   **Cons:** 
    *   Very hard to customize to match PowerProject's specific design system and layout.
    *   Cannot easily inject custom logic (like our Honeypot and Time-trap anti-bot measures).
    *   Cannot easily cleanly separate the "Register" vs "Sign In" logic with custom `shouldCreateUser` flags the way we do now.
*   **Why we didn't do it:** We required strict control over the UI (for the Adaptive Mobile/Desktop layout) and needed custom bot-prevention logic that the pre-built UI doesn't support natively.

### Alternative 3: Magic Links (Clickable URLs instead of 8-digit OTPs)
Users receive an email with a link they click to log in, rather than typing a code.
*   **Pros:** 
    *   Slightly less friction for desktop users (one click vs typing).
*   **Cons:** 
    *   Terrible experience for Cross-Device login (e.g., trying to log in on a Desktop but checking email on a Phone requires transferring the link).
    *   Enterprise email scanners often "click" links automatically to check for malware, which inadvertently consumes single-use magic links and locks the user out.
*   **Why we didn't do it:** The 8-digit OTP is universally reliable across all devices and immune to email scanner consumption.

---

## 3. Risks, Mitigation & Verification
*   **3a. Technical Risks:** Email delivery delays from Supabase/Resend can cause users to abandon the login process. 
    *   *Mitigation:* Keep the OTP expiry window reasonably long (e.g., 15 mins).
*   **3b. Product Risks:** Users might get confused between "Sign In" and "Register". 
    *   *Mitigation:* We explicitly catch this using `shouldCreateUser`. If a new user tries to "Sign In", we show a friendly error: "Account not found. Please switch to Register."
*   **3c. Testing Plan:** 
    1.  **Existing user on Register tab:** Enter a registered email on Register tab → verify only 1 network request fires → OTP received and verified successfully.
    2.  **Auto-switch:** Enter an unregistered email on Sign-In tab → verify UI automatically switches to Register tab and Full Name field appears with directive message.
    3.  **New user full flow:** Enter new email on Register tab with a name → verify OTP received → verify → confirm name is stored in Supabase `user_metadata`.
    4.  **Honeypot:** Manually un-hide the honeypot field, type in it, submit → submission must be silently dropped.
    5.  **Fast Submit:** Submit within 1.5s of page load → must be silently dropped.
*   **3d. Rollback & Reversibility:** Because the logic is entirely contained within `Login.jsx` and `authService.js`, any breaking bugs can be resolved by reverting to the previous git commit of these two files. No database schema rollbacks are required for auth UI changes.
