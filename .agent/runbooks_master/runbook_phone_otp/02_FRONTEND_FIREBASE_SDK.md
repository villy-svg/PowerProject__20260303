# Runbook 02: Frontend Firebase SDK Setup

## Goal
Install the Firebase client SDK and initialize it in the React application.

## Steps

1. **Install Firebase**
   - Run the following in your project root:
     ```bash
     npm install firebase
     ```

2. **Add Environment Variables**
   - Open `.env` (and `.env.production`) and add your Firebase config from Runbook 01:
     ```env
     VITE_FIREBASE_API_KEY="AIzaSy..."
     VITE_FIREBASE_AUTH_DOMAIN="powerproject-....firebaseapp.com"
     VITE_FIREBASE_PROJECT_ID="powerproject-..."
     VITE_FIREBASE_STORAGE_BUCKET="powerproject-....firebasestorage.app"
     VITE_FIREBASE_MESSAGING_SENDER_ID="..."
     VITE_FIREBASE_APP_ID="..."
     ```

3. **Create Firebase Client Initializer**
   - Create a new file: `src/services/auth/firebaseClient.js`
   - Add the following code:
     ```javascript
     import { initializeApp } from 'firebase/app';
     import { getAuth } from 'firebase/auth';

     const firebaseConfig = {
       apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
       authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
       projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
       storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
       messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
       appId: import.meta.env.VITE_FIREBASE_APP_ID
     };

     const app = initializeApp(firebaseConfig);
     export const firebaseAuth = getAuth(app);
     ```

## Success Check
- The app builds successfully.
- No console errors regarding Firebase initialization.
