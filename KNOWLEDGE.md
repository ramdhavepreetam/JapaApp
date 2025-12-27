# JapaApp Knowledge Base

## 1. Overview
JapaApp is a progressive web application (PWA) designed to help potential spiritual practitioners track their mantra chanting (Japa) and participate in collective community goals. It emphasizes a premium user experience with fluid animations, haptic feedback, and offline resilience.

## 2. Architecture

### Frontend
- **Framework**: React 18 with TypeScript.
- **Build Tool**: Vite for fast development and optimized production builds.
- **Routing**: Client-side state-based routing (controlled by `App.tsx` state) to ensure a seamless "app-like" feel without full page reloads.
- **Styling**: TailwindCSS for utility-first styling combined with Material UI (MUI) for robust accessible components and interactions.
- **Animations**: Framer Motion for complex transition effects (e.g., page transitions, smooth counters).

### Backend (Serverless)
- **Platform**: Google Firebase.
- **Database**: Cloud Firestore (NoSQL).
- **Authentication**: Firebase Auth.
- **Hosting**: Firebase Hosting.
- **Offline Strategy**: Service Worker (via Vite PWA plugin assumption or manual) + LocalStorage fallback for non-authenticated or demo modes.

## 3. Data Dictionary (Firestore Schema)

### Collection: `users`
Stores individual user profiles and aggregate statistics.

| Field | Type | Description |
|-------|------|-------------|
| `uid` | string | Unique User ID (matches Auth UID). |
| `displayName` | string | User's public display name. |
| `email` | string | User's email address. |
| `photoURL` | string | URL to avatar image. |
| `joinedAt` | Timestamp | Account creation timestamp. |
| `stats` | Map | Aggregate statistics for the user. |
| `stats.totalMalas` | number | Total malas (108 chants) completed. |
| `stats.totalMantras` | number | Total individual mantras chanted. |
| `stats.streakDays` | number | Current daily streak count. |
| `stats.lastChantDate` | string | Date of last chant (YYYY-MM-DD). |

### Collection: `pledges`
Represents a collective community goal (e.g., "1 Million Chants for Peace").

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique Pledge ID. |
| `title` | string | Title of the cause. |
| `description` | string | Detailed description. |
| `targetMalas` | number | The goal target (e.g., 1008 malas). |
| `currentMalas` | number | Sum of all contributions. |
| `participants` | number | Count of active users joined. |
| `creatorId` | string | UID of the user who created it. |
| `mantra` | string | Specific mantra text (optional). |

### Collection: `pledge_participants`
Junction table linking Users to Pledges with individual progress tracking.

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Composite ID: `${pledgeId}_${userId}`. |
| `pledgeId` | string | Reference to parent Pledge. |
| `userId` | string | Reference to participating User. |
| `contributedMalas` | number | Malas contributed by this user to this pledge. |
| `joinedAt` | Timestamp | When the user joined the pledge. |
| `userDisplayName` | string | Cached display name for leaderboards. |
| `pledgeTitle` | string | Cached title for UI reduction. |

## 4. Key Algorithms & Services

### Mock Fallback System (`community.ts`)
The application implements a robust resiliency pattern:
- **Primary**: Attempts to read/write to live Firebase Firestore.
- **Network Check**: Wraps Firebase calls with a timeout race.
- **Fallback**: If Firestore is unreachable (offline, permission error, timeout), it seamlessly switches to a **LocalStorage Mock Service**.
- This allows users to test the app ("Demo Mode") without valid credentials or internet connection.

### Streak Calculation (`userService.ts`)
Daily streaks are calculated optimistically on the client/server boundary:
1. Checks `lastChantDate` against "Today" and "Yesterday" (local time YYYY-MM-DD).
2. **Same Day**: No change to streak.
3. **Consecutive Day**: Increments streak (`streakDays + 1`).
4. **Gap Detected**: Resets streak to 1.
5. Updates are performed atomically using `setDoc` with `merge: true`.

### Transactional Integrity
- **Batching**: writes to `pledges` and `pledge_participants` are often batched. For example, when a user contributes, both their personal contribution record and the global pledge total are updated in a single Firestore write batch to ensure eventual consistency.

## 5. Directory Structure
- `src/components`: UI Components.
    - `JapaCounter.tsx`: The heart of the app. Handles touch interactions, logic for 108 count, and audio feedback.
    - `BeadRing.tsx`: Visual SVG representation of the mala beads.
- `src/services`: Business logic abstraction.
    - Separates UI form Firebase/Storage logic.
- `src/App.tsx`: Main layout controller, handles top-level navigation state.
- `src/contexts`: Dependency Injection for global state (User Auth, etc.).
