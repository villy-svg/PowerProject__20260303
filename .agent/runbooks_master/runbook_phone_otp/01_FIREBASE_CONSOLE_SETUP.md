# Runbook 01: Firebase Console Setup

## Goal
Enable Phone Authentication in Firebase and extract the Web SDK configuration.

## Steps

1. **Go to Firebase Console**
   - Open your existing Firebase project (the one used for FCM Push Notifications).

2. **Enable Phone Auth**
   - Navigate to **Authentication** > **Sign-in method**.
   - Click **Add new provider** > **Phone**.
   - Toggle **Enable**.
   - (Optional) Add your own phone number in "Phone numbers for testing" to test without consuming SMS quota or solving real reCAPTCHAs.
   - Click **Save**.

3. **Get Web Configuration**
   - Go to **Project Settings** (the gear icon top-left).
   - Scroll down to "Your apps".
   - If you don't have a Web App added yet, click the `</>` icon to add one. Name it "PowerProject Web".
   - Copy the `firebaseConfig` object. It looks like this:
     ```javascript
     const firebaseConfig = {
       apiKey: "AIzaSy...",
       authDomain: "powerproject-....firebaseapp.com",
       projectId: "powerproject-...",
       storageBucket: "powerproject-....firebasestorage.app",
       messagingSenderId: "...",
       appId: "..."
     };
     ```
   - Keep this configuration handy for Runbook 02.

4. **Add Authorized Domains**
   - In **Authentication** > **Settings** > **Authorized domains**, ensure your production domain, localhost, and any Vercel/Netlify staging domains are added. Otherwise, reCAPTCHA will fail.
