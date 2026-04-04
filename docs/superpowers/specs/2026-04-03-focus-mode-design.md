# Focus Mode — Design Spec

**Date:** 2026-04-03
**Status:** Approved for implementation

---

## Problem

The JapaCounter screen has many UI elements (mantra player bar, header icons, online chip, session controls, stats divider) that are useful for setup but become visual noise during active Japa practice. Users who want a distraction-free counting experience have no way to simplify the screen without losing functionality.

## Solution

A small **Focus Mode toggle button** in the top header. Toggling it on switches the counter to a dark, immersive view — ring-centered, all chrome hidden, warm saffron background. Toggling off instantly restores the normal layout. The session continues uninterrupted in both modes.

---

## Pause button removal

The Pause button and Resume button are removed entirely in this change. The `paused` field in the session model (localStorage) is also removed — `storage.pauseSession()`, `storage.resumeSession()`, `handlePauseSession`, `handleResumeSession` are all deleted. The `handleTap` guard that returns early when `data.session.paused === true` is also removed. Sessions are either **inactive** (not started) or **active** (counting). Only Reset ends a session.

Any stale `paused: true` value in localStorage is treated as `false` on read.

---

## Focus Mode toggle

### Placement

The History button is removed from the header entirely (history remains accessible via the Report screen from the bottom nav). The Focus toggle takes its place at the right end of the header row, right-aligned. The left icon group (sound, reset) stays on the left.

### Styling

- **Off state:** Small outlined pill, `secondary` colour (violet), icon + "Focus" label, ~28px tall
- **On state:** Filled solid violet pill, same size and position

### Availability

Focus Mode can only be enabled when a session is **active**. If the session has not been started, the Focus toggle is hidden (not shown at all). This avoids the problem of entering focus mode with no way to start the session.

---

## Behaviour when Focus is ON

### What is hidden

- `MantraPlayerBar`
- Left icon group in header (sound toggle, reset icon)
- History button (already removed from header — see above)
- Online/offline chip + pending sync chip
- Pledge / personal-pledge mode badges
- Font-size controls (A- / A+) on the mantra text block
- Linear progress bar label ("47 / 108 beads" text)
- Today/Lifetime stats divider row (the two-column stat block)
- Session controls: Start, Reset Session, Add Chant button, session text hint

### What stays / is restyled

| Element | In Focus Mode |
|---|---|
| Background | Deep warm dark gradient: `#1a0800` → `#3d1200` |
| `BeadRing` | Scaled to 115% of normal size, centred with extra vertical breathing room |
| Progress bar | Height reduced to 3px, opacity 40%, still shows bead position |
| Mantra text | Shown faintly above ring, opacity 35%, italic, no A-/A+ controls |
| Today's mala count | Large (h2/32px), glowing saffron colour, centred below ring |
| "malas today" label | Small, dimmed, letter-spaced uppercase |
| Focus toggle button | Stays in top-right, filled violet — visible and tappable |
| Bottom navigation | Rendered as normal in `App.tsx`; no dimming (avoids needing to lift state) |
| Feedback toasts | The `style` prop on the toast `<motion.div>` must be made conditional (inline `style` overrides `sx`): in focus mode use `backgroundColor: 'rgba(253,235,208,0.12)'` and `color: 'rgba(253,235,208,0.9)'`; in normal mode keep current `theme.palette.primary.main` |

### Transition

Framer Motion fade on the container: opacity 0→1, duration 300ms. Background colour transition via CSS `transition: background 0.3s ease`.

---

## Tapping in Focus Mode

No change to tap logic. Entire screen remains a tap target. Haptic + sound fire as normal. All feedback toasts (mala completed, session saved, start prompt) appear styled for the dark background (see table above).

---

## State

```ts
const [focusMode, setFocusMode] = useState<boolean>(() => {
  return localStorage.getItem('japa_focus_mode') === 'true';
});
```

Persisted to `localStorage` key `japa_focus_mode`. Toggling saves immediately. Focus mode is forced to `false` if the session is not active (guard in render, not in the toggle handler).

No prop changes needed. No backend/Firestore impact.

---

## Files to change

| File | Change |
|---|---|
| `src/components/JapaCounter.tsx` | Add `focusMode` state + localStorage persistence; conditional rendering/styling for focus mode; remove Pause/Resume buttons and all pause-related handlers; remove History button from header; make toast `style` prop conditional on `focusMode` |
| `src/lib/storage.ts` | Remove `pauseSession()` and `resumeSession()` methods; remove `paused` field from `SessionData` type; remove internal `!data.session.paused` guards in `increment`/tick logic; remove `paused: false` assignment in `resetSession()`; treat stale `paused: true` in localStorage as `false` on read |
| `src/i18n/locales/en.json` | Add `counter.focus` key (`"Focus"`); remove `counter.pause` and `counter.resume` keys |
| `src/i18n/locales/hi.json` | Same as above in Hindi |

---

## Out of scope

- MantraPlayerBar redesign or relocation
- Notification bell relocation
- Any changes to other screens
- Background gradient customisation settings
- Bottom nav dimming (avoided to keep focusMode local to JapaCounter)
