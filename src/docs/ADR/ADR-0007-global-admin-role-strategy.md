# ADR-0007: Global Admin Role Strategy

## Status
Accepted

## Context
JapaApp needs a superadmin layer so the app owner (Preetam) can:
- Manage users (view, ban, assign roles)
- Manage communities (delete, feature, suspend)
- Manage pledges (pin global pledges, remove inappropriate ones)
- Track donations and subscription status
- Access all data regardless of community privacy settings

The challenge: Firebase is a client-side SDK with no traditional server session.
We must enforce admin access purely through Firestore Security Rules +
Firebase Auth Custom Claims — never trust the client to self-declare admin.

## Decision

### Role Field Strategy
Add `role` to `users/{uid}` in Firestore:
  type UserRole = 'user' | 'community_admin' | 'superadmin'

  users/{uid}:
    role: UserRole          ← default 'user' on registration
    status: 'active' | 'banned' | 'suspended'
    plan: 'free' | 'pro' | 'community'  ← for future monetization
    planExpiresAt: Timestamp | null

### Superadmin Bootstrap
Preetam sets his own UID to superadmin ONCE directly in Firebase Console:
  Firebase Console → Firestore → users/{preetam_uid} → role: "superadmin"

No code path allows self-promotion to superadmin.
Only an existing superadmin can promote another user via admin panel.

### Firebase Custom Claims (server-side enforcement)
On login, a Cloud Function checks users/{uid}.role and sets a
Firebase Auth custom claim: { superadmin: true }

This claim is checked in Firestore Security Rules — the client JWT
is verified server-side, not just in Firestore rules trusting client data.

Cloud Function trigger: onCreate + onLogin (HTTP callable)

### Admin Panel Route
Separate React route: /admin
Guard: currentUser?.role === 'superadmin' (client) +
       Firestore Security Rules (server) — double enforcement

Admin panel is a separate lazy-loaded React chunk — never bundled
into the main app for regular users.

### Firestore Security Rules Pattern
  // Only superadmin can read all users
  match /users/{uid} {
    allow read: if request.auth.token.superadmin == true
                || request.auth.uid == uid;
    allow write: if request.auth.uid == uid
                 || request.auth.token.superadmin == true;
  }

  // Only superadmin can delete any community
  match /communities/{communityId} {
    allow delete: if request.auth.token.superadmin == true;
  }

  // Admin audit log — superadmin write only
  match /admin_logs/{logId} {
    allow read, write: if request.auth.token.superadmin == true;
  }

### New Firestore Collections for Admin

admin_logs/{logId}
  action: string          // 'BAN_USER' | 'DELETE_COMMUNITY' | 'FEATURE_COMMUNITY'
  targetId: string        // uid or communityId
  adminId: string         // superadmin uid
  reason: string
  createdAt: Timestamp

donations/{donationId}
  userId: string
  amount: number
  currency: 'INR' | 'USD'
  gateway: 'razorpay' | 'stripe'
  gatewayOrderId: string
  status: 'pending' | 'completed' | 'failed'
  createdAt: Timestamp

## Options Considered
1) Separate admin Firebase project — cleanest isolation but complex to manage two projects
2) Custom Claims + Security Rules (chosen) — single project, server-enforced, standard pattern
3) Client-only role check — REJECTED — never trust client for admin access

## Consequences
- Positive: Secure by default; Firestore rules enforce at server level
- Positive: No separate backend needed — all Firebase
- Negative: Custom Claims require Cloud Functions (small cost)
- Risk: If Cloud Function fails to set claim, admin cannot access panel
  Mitigation: Manual claim set via Firebase Admin SDK as fallback

## Implementation Notes
- Modules affected: auth/, new module admin/
- New Firestore collections: admin_logs, donations
- New fields on users/{uid}: role, status, plan, planExpiresAt
- Cloud Function: functions/src/setAdminClaim.ts
- New React route: /admin (lazy loaded)
- Migration: existing users get role:'user', status:'active', plan:'free' via
  one-time migration script (or on next login via Cloud Function)
- Testing plan:
    - Security Rules test: non-admin cannot read other users
    - Security Rules test: superadmin can read all users
    - Unit test: admin panel route redirects non-superadmin to home
    - Unit test: ban user sets status:'banned' + writes admin_log