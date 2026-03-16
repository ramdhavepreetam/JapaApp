# Firebase Auth DDoS & Fake Account Protection

When using Firebase Authentication (specifically Google Sign-in as currently implemented in `AuthContext.tsx`), there are several layers of protection you should implement to prevent DDoS attacks and mass fake account creation.

## 1. Firebase App Check (Highly Recommended)
Firebase App Check helps protect your backend resources (Firestore, Functions, Auth) from abuse by ensuring that incoming traffic comes from your actual, authentic app and not a script or modified client.

**Implementation Steps:**
1. Enable App Check in the Firebase Console.
2. Register your web app with **reCAPTCHA Enterprise** or **reCAPTCHA v3** (Enterprise is recommended for better analytics and bot detection).
3. Initialize App Check in your `src/lib/firebase.ts` before initializing Auth or Firestore:
```typescript
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";

// Inside initialization
const appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaEnterpriseProvider('YOUR_RECAPTCHA_SITE_KEY'),
  isTokenAutoRefreshEnabled: true
});
```
4. Enforce App Check in your Firestore Security Rules and Cloud Functions.

## 2. Cloud Functions & Firestore Rate Limiting
Even with Google Sign-in, an attacker with a farm of valid Google accounts could try to spam your database. You need to protect the **post-login actions** (like creating the user document in Firestore).

**Implementation:**
Since you are currently creating user profiles via `userService.createProfile(user)` right after login, you should protect this:
1. **Firestore Rules:** You cannot easily rate-limit directly in standard Firestore rules without tracking timestamps.
2. **Cloud Functions (Better):** Move profile creation to a Firebase Auth Trigger Cloud Function (`functions.auth.user().onCreate()`). This inherently prevents client-side spamming of the `users` collection, as the function only runs once per actual Google account creation.

## 3. Firebase Authentication Quotas & Limits
Firebase Auth itself has built-in limits to protect against DDoS:
- **Sign-in quotas:** Google limits the number of sign-in requests per IP address automatically.
- **Identity Platform:** Upgrading your Firebase project to use Google Cloud Identity Platform allows you to configure specific tenant-level quotas and multi-factor authentication (MFA).

## 4. Blocking Cloud Functions (Advanced)
If you upgrade to Identity Platform, you can write blocking functions that execute *before* a user is created or signed in. 
- `beforeCreate(user, context)`
- `beforeSignIn(user, context)`

You can use these to:
- Check the user's IP address against a known blacklist.
- Prevent logins from certain regions.
- Prevent signups using suspicious email domains (though less relevant for purely Google auth).
- Implement custom rate-limiting using Redis or Firestore counters.

## Summary Recommendation for JapaApp
Since JapaApp only uses Google Auth right now:
1. **Immediate Action:** Implement **Firebase App Check** with reCAPTCHA Enterprise. This is the single most effective way to ensure only your actual web app can trigger sign-ins and database writes.
2. **Architecture Improvement:** Move `userService.createProfile(user)` to a backend Auth trigger (`onCreate`), rather than running it blindly from the client in `AuthContext` when a document is missing. This prevents a malicious client from spamming document creations in the `users` table.
