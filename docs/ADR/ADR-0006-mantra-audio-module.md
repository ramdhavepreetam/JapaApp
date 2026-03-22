# ADR-0006: Mantra / Audio Module Architecture

**Date:** 2026-03-21
**Status:** Accepted
**Module:** Mantra Library & Audio Player

---

## Context

JapaApp users benefit from listening to mantra audio while counting beads. The app needs a curated, admin-managed library of mantras with audio playback, multi-speed control, loop support, and graceful offline degradation.

## Decision

### Firestore-hosted mantra library

Mantras are stored in the `mantras` collection in Firestore. Each document contains the mantra metadata and a `audioUrl` pointing to a hosted audio file (e.g., Cloudflare R2 or Firebase Storage). This allows admins to add/remove mantras without a code deployment.

Rules: public read (no auth required), admin-only write (`isAppAdmin()`).

### 5-mantra offline fallback

`mantraService.getMantras()` is wrapped in `runWithFallback`. If Firestore is unavailable, 5 hardcoded fallback mantras are returned (without `audioUrl`, so the play button is disabled). This prevents the UI from showing an empty state during offline sessions.

### Audio player implemented with Web Audio API

`MantraPlayerBar.tsx` uses the browser's native `Audio` element (not Web Audio API) for playback. Key decisions:
- Audio element is created inside `useEffect` (not as a shared ref) to avoid StrictMode double-mount issues
- `loop` property is synced via a `ref` to avoid stale closure in the `ended` event handler
- Progress bar uses `timeupdate` event for visual feedback
- Speed control uses `audio.playbackRate` (0.5×, 0.75×, 1×, 1.25×, 1.5×)

### Admin management

`AdminMantrasTab` allows super admins to:
- View all mantras sorted by `position`
- Add a new mantra (name, Devanagari script, optional Marathi, tradition, audio URL, position)
- Delete a mantra

The `position` field controls display order (ascending). Admins must manually assign positions; there is no drag-to-reorder UI yet.

### Placement in JapaCounter

`MantraPlayerBar` renders at the top of `JapaCounter` inside a click-stop-propagation wrapper (so mantra controls don't trigger bead counting). This placement means the player bar consumes ~80px of vertical height from the counter's space.

## Consequences

- **Positive:** Admins can update the mantra library without app releases.
- **Positive:** Offline fallback prevents blank UI during poor connectivity.
- **Positive:** StrictMode-safe audio element creation prevents double-fire errors.
- **Trade-off:** Audio URLs must be externally hosted (Cloudflare R2 recommended); Firebase Storage URLs work but cost more at scale.
- **Trade-off:** MantraPlayerBar inside JapaCounter takes vertical space — layout must guarantee `minHeight: 340` on the bead ring container.

## Key Files

| File | Purpose |
|------|---------|
| `src/services/mantraService.ts` | Firestore fetch + offline fallback |
| `src/components/MantraPlayerBar.tsx` | Full audio player UI (450 LOC) |
| `src/admin/AdminMantrasTab.tsx` | Admin CRUD for mantra library |
| `src/types/mantra.ts` | `Mantra` interface |

## Open Issues

- No drag-to-reorder for mantra position — admins must manually enter position numbers.
- No audio file upload UI — admins paste external URLs. Consider adding Firebase Storage upload in AdminMantrasTab.
- Mantra player state (selected mantra, speed, loop) resets on navigation — consider persisting to localStorage.
