# ADR-0001: Counter/Japa Module — Offline-First Architecture

**Date:** 2026-03-21
**Status:** Accepted
**Module:** Counter / Japa Counting

---

## Context

The Japa counter is the core feature of JapaApp. Users count mantras using a 108-bead digital mala. Counting must work even when the device is offline (during meditation in remote locations, flights, poor connectivity areas). Any disruption to counting is a high-severity UX failure.

## Decision

**Optimistic localStorage-first with async Firestore sync.**

1. Every bead tap writes to `localStorage` immediately via `lib/storage.ts` — zero network latency.
2. On mala completion (108 counts), a `JapaEntry` is queued locally and submitted to Firestore asynchronously via `communityJapaService.submitJapaEntry()`.
3. If Firestore fails, the entry is placed in a persistent queue (`japa_v1_queue_japa` in localStorage).
4. `syncService.syncJapaEntries()` retries the queue on reconnect with exponential backoff (1s → 2s → 4s, max 3 attempts).
5. Idempotency: each entry has a unique `id` (`{uid}_{timestamp}_{random}`) — Firestore transaction checks `entrySnap.exists()` before writing, making retries safe.

**Timezone-aware daily tracking:** Daily history uses local calendar date (`YYYY-MM-DD` via `getTodayDate()`) not UTC. This prevents IST users' daily count from resetting at 05:30 AM instead of midnight.

**`totalMalas` never resets** (lifetime counter). `currentMala` resets daily. `currentCount` is 0–107 (within-mala bead position).

## Consequences

- **Positive:** Counter always works offline. Users never lose progress mid-session.
- **Positive:** Idempotent sync prevents double-counting on retry.
- **Positive:** Timezone-safe daily tracking matches user expectations.
- **Trade-off:** Community totals can be stale by up to the sync retry period.
- **Trade-off:** `USE_MOCK_FALLBACK` in `resilience.ts` is session-sticky — once tripped, all Firestore calls are bypassed until reload or reconnect.

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/storage.ts` | localStorage schema, `increment()`, `getTodayDate()` |
| `src/components/JapaCounter.tsx` | Main counter UI, session management |
| `src/components/BeadRing.tsx` | Visual 108-bead ring animation |
| `src/services/communityJapaService.ts` | Firestore submission + recent entries |
| `src/services/syncService.ts` | Queue retry with exponential backoff |
| `src/services/streakUtils.ts` | Streak calculation (ONLY source of truth) |
| `src/services/resilience.ts` | `runWithFallback`, `USE_MOCK_FALLBACK` flag |

## Open Issues

- `lib/storage.ts` (counter state) and `services/localStore.ts` (community cache) overlap in naming — both use localStorage but serve different purposes. Consider renaming localStore to `communityCache.ts`.
- The MantraPlayerBar inside JapaCounter adds ~80px height — layout must ensure `minHeight: 340` on the bead ring container to prevent clipping.
