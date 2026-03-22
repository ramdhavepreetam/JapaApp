# ADR-0010: Sync / Offline Module Architecture

**Date:** 2026-03-21
**Status:** Accepted
**Module:** Offline Resilience & Queue Sync

---

## Context

JapaApp is used during meditation — often in environments with poor or no connectivity. Every user-facing operation must succeed locally (optimistic) and sync to Firestore when connectivity returns, without the user needing to take any action.

## Decision

### `runWithFallback` — the universal resilience wrapper

Every Firestore call MUST go through `runWithFallback(primaryFn, fallbackFn, label)` in `services/resilience.ts`. The wrapper:

1. Adds a 5-second timeout to `primaryFn`
2. On any of these errors → switches to `fallbackFn`:
   - `FIREBASE_TIMEOUT` (5s exceeded)
   - `unavailable` (server down)
   - `deadline-exceeded`
   - `permission-denied` (often an auth weirdness)
   - `navigator.onLine === false`
3. Sets `USE_MOCK_FALLBACK = true` (module-level sticky flag)
4. Once `USE_MOCK_FALLBACK` is true, **all subsequent calls** skip the `primaryFn` and go straight to `fallbackFn` — no retry noise

### Sticky fallback reset

`USE_MOCK_FALLBACK` resets when:
- `window` fires `online` event (reconnect)
- The app module reloads (page refresh)

This prevents thrashing — if one call fails, the app doesn't make 50 more failing Firebase calls before switching to offline mode.

### `localStorage` as the offline store

`services/localStore.ts` provides mock implementations for all Firestore collections:
- `japa_v1_communities`, `japa_v1_members` — community list + memberships
- `japa_v1_chats`, `japa_v1_posts` — cached chat + posts
- `japa_v1_queue_japa` — pending japa entries to sync
- `japa_v1_queue_chat` — pending chat messages to sync

The keys are versioned (`v1`) to allow future schema migrations with a clear break.

### Sync on reconnect with exponential backoff

`syncService.syncAll()` is called when the `online` event fires. It:
1. Calls `syncJapaEntries()`: processes the queue one-by-one (sequentially to maintain order)
2. Calls `syncChatMessages()`: same sequential processing
3. Each item retries 3 times with backoff: 1s → 2s → 4s
4. On final failure, emits `sync:failed` event + calls `track.syncFailed()`

Idempotency is the safety net: japa entries check `entrySnap.exists()` in their transaction. Duplicate sync attempts are no-ops.

### Counter state vs. community cache

`lib/storage.ts` manages the **counter state** (bead position, daily history, session, pending sync). `services/localStore.ts` manages the **community cache** (members, chats, posts). These are different concerns with different schemas, kept separate.

## Consequences

- **Positive:** App works fully offline — counting, chat, feed all read from localStorage.
- **Positive:** Sticky fallback prevents log spam and repeated failure on bad networks.
- **Positive:** Reconnect sync is transparent to users — happens in background.
- **Trade-off:** `USE_MOCK_FALLBACK` is session-sticky — if it trips incorrectly (e.g., a brief fluke), the user is offline for the rest of the session until reload or reconnect.
- **Trade-off:** The localStorage mock is a simplified version of Firestore — it doesn't replicate all query behaviors. Complex queries may return slightly different results offline.

## Key Files

| File | Purpose |
|------|---------|
| `src/services/resilience.ts` | `runWithFallback`, `USE_MOCK_FALLBACK` (64 LOC) |
| `src/services/syncService.ts` | Queue processing + exponential backoff (122 LOC) |
| `src/services/localStore.ts` | localStorage mock for all collections (226 LOC) |
| `src/lib/storage.ts` | Counter-specific localStorage schema (200 LOC) |
| `src/lib/analytics.ts` | `track.syncFailed()` event |

## Open Issues

- `lib/storage.ts` vs `services/localStore.ts` naming is confusing — both use localStorage, different purposes. Consider renaming `localStore.ts` → `communityCache.ts`.
- No offline indicator for community pledges tab — if offline, pledge contribute operations queue silently but there's no visual cue.
- Sync queue has no size limit — very long offline sessions could accumulate many entries. Consider pruning entries older than 7 days.
