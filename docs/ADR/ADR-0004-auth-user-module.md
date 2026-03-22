# ADR-0004: Auth / User Module Architecture

**Date:** 2026-03-21
**Status:** Accepted
**Module:** Authentication & User Profiles

---

## Context

JapaApp uses Google OAuth for sign-in. User profiles must be created atomically on first sign-in and must store privileged fields (role, status, plan) that cannot be written by the client.

## Decision

### Popup-first Google OAuth, App Check disabled

`signInWithPopup(auth, googleProvider)` is used instead of redirect-based flow. App Check (reCAPTCHA v3) is intentionally **disabled** because it breaks `signInWithPopup` on mobile WebViews and iOS Safari.

> **Important:** Re-enabling App Check requires migrating to a redirect flow or native SDK. Do not re-enable without testing thoroughly on mobile.

### Cloud Function creates user doc on first sign-in

`onUserCreated` (Firebase Auth trigger) creates `users/{uid}` with safe defaults:
```
{ uid, displayName, email, photoURL, createdAt, stats: {all zeros}, role: null, status: 'active', plan: 'free' }
```
This prevents race conditions between the client (attempting to write its own profile) and Firestore rules (which would reject privileged field writes).

### Privileged fields are Admin SDK-only

`role`, `status`, and `plan` on the user doc can only be written via the Admin SDK (Cloud Functions or server-side). Firestore rules reject any client write that touches these fields. This prevents privilege escalation.

### Cached profile for fast reads

`userService.getUserProfile()` caches the user profile in `localStorage` (`japa_v1_user_{uid}`) to avoid repeated Firestore reads on component mount.

### Lazy role population in AuthContext

`AuthContext` fetches the Firestore user doc after Firebase Auth resolves. The `authUser` object is available immediately (from Firebase Auth), but `role`, `status`, and `plan` arrive slightly later. UI components should handle the brief `role: undefined` state.

## Consequences

- **Positive:** App Check disabled means sign-in works reliably on all platforms.
- **Positive:** Cloud Function profile creation prevents race conditions.
- **Positive:** Privileged fields protected by both rules and App Check-equivalent server enforcement.
- **Trade-off:** App Check disabled means no bot protection on sign-in — mitigated by Firebase Auth's built-in rate limiting.
- **Trade-off:** Role available slightly after auth — UI components must not gate critical rendering on role.

## Key Files

| File | Purpose |
|------|---------|
| `src/contexts/AuthContext.tsx` | Firebase Auth state + Firestore role fetch |
| `src/services/userService.ts` | Profile CRUD + stats with `increment()` |
| `src/lib/firebase.ts` | Firebase init; App Check explicitly NOT initialized |
| `src/types/auth.ts` | `AuthUser`, `UserRole` types |
| `functions/src/index.ts` | `onUserCreated` Cloud Function |
| `firestore.rules` | Privileged field write protection for users collection |

## Open Issues

- App Check should be re-enabled once a redirect-based auth flow is tested on mobile.
- `userService` uses client SDK for stats — if the user doc doesn't exist, `set+merge` is used as a fallback (handled in `communityJapaService`). Ensure this pattern is consistent wherever user stats are written.
