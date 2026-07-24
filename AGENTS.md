# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Commands

### Frontend (root)
```bash
npm run dev        # Start Vite dev server at http://localhost:5173
npm run build      # TypeScript check + Vite build → dist/
npm run lint       # ESLint (warnings treated as errors)
npm run test       # Run Vitest tests
npm run preview    # Preview production build
```

### Cloud Functions (functions/)
```bash
npm run build        # Compile TypeScript → lib/
npm run build:watch  # Watch mode
npm run serve        # Build + start Firebase emulators
npm run deploy       # Deploy functions only
```

### Firebase
```bash
npx firebase deploy --only hosting
npx firebase deploy --only functions
npx firebase emulators:start --only functions
```

## Architecture

JapaApp is a spiritual companion app for Japa meditation (mantra chanting). Users count mantras using a digital bead counter (108 beads = 1 Mala), join communities for collective practice, and track streaks.

### Core Data Flows

**Counting flow:** BeadRing UI → `storage` module (localStorage, timezone-aware daily keys) → auto-synced to Firestore `communities/{id}/japa_entries` + user stats in `users/{uid}/stats`

**Offline resilience:** All writes are queued locally first. `syncService` batches and retries queued entries on reconnect with exponential backoff (3 attempts max).

**Community flow:** Users create/join communities (public or private via invite codes). Membership stored in flat `community_members/{communityId}_{uid}` docs. Subcollections per community: `japa_entries`, `chat_messages`, `posts`.

**Auth flow:** Firebase Auth (Google OAuth popup). `onUserCreated` Cloud Function auto-creates the `users/{uid}` doc. App Check is intentionally NOT initialized — reCAPTCHA iframe conflicts with the Firebase auth iframe on Safari/Chrome mobile.

**Offline resilience:** `resilience.ts` wraps every Firestore call via `runWithFallback()`. Timeout is 12s (3 sequential ops need room). `permission-denied` is NOT treated as offline — it surfaces as a real error. Once `USE_MOCK_FALLBACK=true`, all calls go to localStorage for the session; resets on `window.online`.

### Key Services (`src/services/`)

| Service | Purpose |
|---|---|
| `communityJapaService` | Transaction-based japa entry submission with community stat aggregation |
| `communityService` | Community CRUD, invite codes, join requests |
| `communityChatService` | Real-time chat (with soft-delete) |
| `communityFeedService` | Announcements and posts |
| `syncService` | Offline queue management and batch sync |
| `userService` | Profile, stats, streak calculation |
| `mantraService` | Fetch curated mantras from Firestore |
| `pledgeService` | Community pledge CRUD (admin/owner creates; any member contributes) |
| `personalPledgeService` | Personal pledge CRUD — private subcollection `users/{uid}/pledges` |
| `adminService` | App-level admin operations (ban, roles) |
| `feedbackService` | App feedback CRUD — submit (any auth user), read/update (admin only) |
| `japaReactionService` | Japa entry reactions — toggleReaction (atomic), getBatchReactions |

### Firestore Schema

| Collection | Key fields |
|---|---|
| `users/{uid}` | displayName, stats, role, status, plan |
| `communities/{id}` | name, isPrivate, inviteCode, membersCount, totalMalas |
| `community_members/{communityId}_{uid}` | role (owner/admin/member), status (active/banned/left), totalMalas |
| `community_join_requests/{communityId}_{uid}` | status (pending/approved/rejected) |
| `communities/{id}/japa_entries` | uid, count, date, createdAt — **immutable after creation** |
| `communities/{id}/japa_entry_reactions` | pranams/heart/sparkle counts + reactors map — keyed by entryId |
| `communities/{id}/chat_messages` | senderId, content, createdAt, deletedAt (soft-delete) |
| `communities/{id}/posts` | authorId, type (announcement/post), content |
| `app_feedback/{id}` | uid, category (bug/feature/general), message, status, adminNotes — admin-only read |
| `mantras` | audio URL, text, language |

### Security Rules (`firestore.rules`)
- Privileged fields (role, status, plan) are Admin SDK–only; client writes are rejected
- Japa entries are write-once (immutable)
- Communities are readable by any authenticated user (required for invite-code lookups on private communities)
- Helper functions: `isAuthenticated()`, `isCommunityMember()`, `isCommunityAdmin()`, `isAppAdmin()`

### Cloud Functions (`functions/src/index.ts`)
- `onUserCreated` — creates user doc on Firebase Auth signup
- `createRazorpayOrder` — HTTPS callable, initiates payment
- `razorpayWebhook` — HTTPS, confirms payment and upgrades user plan

## Environment Setup

Create `.env.local` in the project root:
```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=   # optional
VITE_RAZORPAY_KEY_ID=           # optional, for donations
```

## Tech Stack

- **React 18 + TypeScript** (strict mode), **Vite 5**
- **TailwindCSS** with custom spiritual theme (saffron, maroon, gold); **Material-UI 7** for nav/layout components
- **Framer Motion** for animations; **i18next** for English/Hindi i18n
- **Firebase**: Firestore (primary DB), Auth (Google OAuth), Analytics, Hosting
- **Cloud Functions**: Node.js 20 runtime
- **Razorpay**: Donations/subscriptions

## Internationalisation

English and Hindi (Devanagari) are supported via `i18next`. Translation keys live in `src/i18n/`. When adding user-facing strings, add keys to both locale files.

## Admin

The `/admin` route renders a lazy-loaded `AdminPanel` component. Superadmin/admin roles are set via the Admin SDK only (never client-side). Audit logs go to the `admin_logs` collection.
