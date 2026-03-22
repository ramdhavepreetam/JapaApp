# Mantra Audio Player — Design Spec
**Date:** 2026-03-20
**Status:** Approved for implementation

---

## Problem
Users chanting japa — especially learners — need to hear the mantra while counting. Currently the app shows mantra text but has no audio. A looping audio player directly in the japa screen adds real learning value.

## Solution
A collapsible mantra player bar docked at the top of the JapaCounter screen, above the mantra text display. Uses a curated library of pre-recorded mantras hosted on Cloudflare R2 (zero egress cost). Admin can add mantras over time without app updates.

---

## Design Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Player position | Top bar in JapaCounter | Always visible, collapses to icon, doesn't block counter |
| Mantra selection | Tap mantra name → inline dropdown | Fast, in-context, no screen change |
| Audio hosting | Cloudflare R2 + CDN URL | Zero egress fees, cost-effective |
| Loop | On by default | Core use case — chant along continuously |
| Speed control | 0.5×, 0.75×, 1×, 1.25×, 1.5× | Learners need slow playback; advanced users want faster |
| Audio engine | HTML `<audio>` element + `playbackRate` | Native browser API, no library needed |
| Admin upload | Admin Panel → Mantras tab | Upload audio URL + metadata, stored in Firestore `mantras` collection |
| Initial library | 5–8 mantras | Om Namah Shivaya, Gayatri, Hare Krishna, Mahamrityunjaya, Om Mani Padme Hum |

---

## Theme
Exact match to existing app theme (`src/theme.ts`):
- Primary/play button: `#EA580C` (saffron)
- Bar background: `#881337` (maroon)
- Text on bar: `#FFF8F0` (cream)
- Dropdown background: `#FFFFFF` / `#FFF8F0`
- Selected item accent: `#EA580C` border-left
- Font: Playfair Display (headings), Inter (body)

---

## Components

### 1. `MantraPlayerBar` (new) — `src/components/MantraPlayerBar.tsx`
The top bar shown on JapaCounter. Responsibilities:
- Show currently selected mantra name (tappable)
- Play / Pause button (saffron circle)
- Speed selector pills (0.5×, 0.75×, 1×, 1.25×, 1.5×)
- Loop toggle icon
- Collapse/expand chevron → collapses to a single icon row
- When mantra name tapped → shows `MantraPickerDropdown`
- Manages `<audio>` element ref internally

**Props:**
```ts
interface MantraPlayerBarProps {
  mantras: Mantra[];       // library from Firestore
  loading: boolean;
}
```

**Internal state:**
- `selectedMantra: Mantra | null`
- `isPlaying: boolean`
- `speed: 0.5 | 0.75 | 1 | 1.25 | 1.5`
- `isLooping: boolean` (default: true)
- `isCollapsed: boolean`
- `pickerOpen: boolean`

### 2. `MantraPickerDropdown` (new) — inside `MantraPlayerBar.tsx`
Inline dropdown that appears below the bar when mantra name is tapped:
- List of mantras with Sanskrit text + tradition label
- Currently selected item has saffron left-border highlight
- Selecting a mantra: sets it, closes dropdown, starts playing if was playing
- Renders as MUI `Collapse` for smooth animation

### 3. `MantraService` (new) — `src/services/mantraService.ts`
Firestore service for reading mantra library:
```ts
getMantras(): Promise<Mantra[]>  // reads `mantras` collection, orderBy position ASC
```
Uses `runWithFallback` with a hardcoded offline fallback list (so player works if Firestore is unavailable).

---

## Data Model

### Firestore: `mantras/{mantraId}` collection
```ts
interface Mantra {
  id: string;
  name: string;              // "Om Namah Shivaya"
  nameDevanagari: string;    // "ॐ नमः शिवाय"
  tradition: string;         // "Shaiva" | "Vaishnava" | "Vedic" | "Buddhist"
  audioUrl: string;          // Cloudflare R2 CDN URL
  position: number;          // display order
  addedBy: string;           // admin uid
  addedAt: Timestamp;
}
```

### Firestore Rules addition
```
match /mantras/{mantraId} {
  allow read: if true;                          // public — no auth needed
  allow write: if isAppAdmin();                 // admin only
}
```

---

## Audio Playback Implementation

Uses native `HTMLAudioElement` — no library needed. Single reused audio element (prevents memory leaks):
```ts
const audioRef = useRef<HTMLAudioElement>(new Audio());

// On mantra select — reuse element, change src:
audioRef.current.pause();
audioRef.current.src = mantra.audioUrl;
audioRef.current.loop = isLooping;
audioRef.current.playbackRate = speed;
// Do NOT auto-start — user must tap Play (iOS Safari autoplay policy)

// On Play button tap:
audioRef.current.play().catch(() => setIsPlaying(false)); // handle browser autoplay block

// Speed change (real-time, no restart):
audioRef.current.playbackRate = newSpeed;

// Audio load error (CORS, 404, etc.):
audioRef.current.addEventListener('error', () => {
  setIsPlaying(false);
  // show snackbar: "Could not load audio. Check your connection."
});

// Cleanup on unmount:
audioRef.current.pause();
audioRef.current.src = ''; // release for GC
```

**Autoplay behaviour:** Selecting a mantra from the dropdown does NOT auto-start audio. User must tap the Play button. This is required for iOS Safari compatibility.

**Speed:** Changes apply in real-time while playing — no restart.

**CORS:** Cloudflare R2 bucket must have `Access-Control-Allow-Origin: *` configured. Audio URLs that fail CORS will trigger the error handler above.

**Loading state:** While `loading` prop is true, bar shows a saffron skeleton shimmer in place of the mantra name.

**Collapse icon:** `ChevronDown` / `ChevronUp` from `lucide-react` (already installed).

---

## Admin Panel Addition

New "Mantras" tab in `src/admin/AdminPanel.tsx`:
- Lists all mantras with name, tradition, position
- "Add Mantra" form: name, Devanagari text, tradition, R2 audio URL, position
- Writes to `mantras` collection via `adminService.ts`
- No audio upload UI (admin pastes R2 URL directly — they upload file to R2 separately)

---

## Integration in JapaCounter

In `src/components/JapaCounter.tsx`:
- Add `useMantras()` hook call at top (fetches library)
- Render `<MantraPlayerBar mantras={mantras} loading={mantrasLoading} />` just below the app header bar, above the mantra text display

---

## Initial Mantra Library (seed data)

| # | Name | Devanagari | Tradition |
|---|------|-----------|-----------|
| 1 | Om Namah Shivaya | ॐ नमः शिवाय | Shaiva |
| 2 | Gayatri Mantra | ॐ भूर्भुवः स्वः... | Vedic |
| 3 | Hare Krishna Maha Mantra | हरे कृष्ण हरे कृष्ण... | Vaishnava |
| 4 | Mahamrityunjaya Mantra | ॐ त्र्यम्बकं यजामहे... | Shaiva |
| 5 | Om Mani Padme Hum | ॐ मणि पद्मे हूँ | Buddhist |

Audio files to be sourced and uploaded to R2 before launch.

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/components/MantraPlayerBar.tsx` | **Create** — player bar + picker dropdown |
| `src/services/mantraService.ts` | **Create** — Firestore reads for mantra library |
| `src/components/JapaCounter.tsx` | **Modify** — add `<MantraPlayerBar>` above mantra text |
| `src/admin/AdminPanel.tsx` | **Modify** — add Mantras tab |
| `src/admin/AdminMantrasTab.tsx` | **Create** — mantra management UI |
| `src/types/mantra.ts` | **Create** — `Mantra` interface |
| `firestore.rules` | **Modify** — add `mantras` collection rules |

---

## Verification
1. JapaCounter loads → MantraPlayerBar appears at top with library
2. Tap mantra name → dropdown opens, shows all mantras with Devanagari + tradition
3. Select mantra → audio starts, mantra name updates in bar
4. Tap speed pill → playbackRate changes, audio speeds up/slows down in real time
5. Loop toggle → audio loops / stops after one play
6. Collapse chevron → bar collapses to single-line icon; expand restores it
7. Admin panel Mantras tab → can add new mantra, appears in player immediately
8. Offline → hardcoded fallback mantras still show (no audio without internet)
