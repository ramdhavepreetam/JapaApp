# Focus Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a small Focus Mode toggle to JapaCounter that switches to a dark, immersive view hiding all UI chrome, while also removing the unused Pause/Resume buttons.

**Architecture:** Three isolated changes — (1) clean up `storage.ts` session model by removing `paused`, (2) update i18n keys, (3) add `focusMode` state + conditional rendering to `JapaCounter.tsx`. No new files needed. No backend changes.

**Tech Stack:** React 18, TypeScript strict, MUI 7, Framer Motion, Vitest, i18next, localStorage

---

## File Map

| File | What changes |
|---|---|
| `src/lib/storage.ts` | Remove `paused` from `SessionState` type + `INITIAL_STATE`; delete `pauseSession()` and `resumeSession()`; remove `!data.session.paused` guards in `increment()`; remove `paused: false` from `startSession()` and `resetSession()` |
| `src/lib/storage.test.ts` | New file — unit tests for storage session model (no paused behaviour) |
| `src/i18n/locales/en.json` | Remove `counter.pause`, `counter.resume`; add `counter.focus` |
| `src/i18n/locales/hi.json` | Same in Hindi |
| `src/components/JapaCounter.tsx` | Remove pause/resume handlers + import; remove pause guard in `handleTap`; add `focusMode` state; replace History button with Focus toggle; add conditional rendering/styling for focus mode |

---

## Task 1: Clean up storage session model

**Files:**
- Modify: `src/lib/storage.ts`
- Create: `src/lib/storage.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/storage.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { storage } from './storage';

// Mock localStorage
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: (key: string) => store[key] ?? null,
        setItem: (key: string, value: string) => { store[key] = value; },
        removeItem: (key: string) => { delete store[key]; },
        clear: () => { store = {}; },
    };
})();
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

describe('storage.SessionState', () => {
    beforeEach(() => localStorageMock.clear());

    it('get() returns active:false on empty storage', () => {
        const data = storage.get();
        expect(data.session.active).toBe(false);
    });

    it('get() does not have a paused field', () => {
        const data = storage.get();
        expect('paused' in data.session).toBe(false);
    });

    it('get() silently ignores stale paused:true from localStorage', () => {
        localStorageMock.setItem('japa_storage_v1', JSON.stringify({
            session: { active: true, paused: true, counts: 5, malas: 0, startedAt: null, updatedAt: null }
        }));
        const data = storage.get();
        expect('paused' in data.session).toBe(false);
        expect(data.session.active).toBe(true);
    });

    it('startSession() makes session active', () => {
        const data = storage.startSession();
        expect(data.session.active).toBe(true);
    });

    it('increment() counts when session active', () => {
        storage.startSession();
        const { newData } = storage.increment();
        expect(newData.session.counts).toBe(1);
    });

    it('resetSession() clears session', () => {
        storage.startSession();
        storage.increment();
        const data = storage.resetSession();
        expect(data.session.active).toBe(false);
        expect(data.session.counts).toBe(0);
    });

    it('storage has no pauseSession method', () => {
        expect('pauseSession' in storage).toBe(false);
    });

    it('storage has no resumeSession method', () => {
        expect('resumeSession' in storage).toBe(false);
    });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm run test -- src/lib/storage.test.ts
```

Expected: FAIL — `paused` is still in the session model; `pauseSession`/`resumeSession` still exist.

- [ ] **Step 3: Update `SessionState` type — remove `paused`**

In `src/lib/storage.ts`, change lines 19–26:

```ts
export type SessionState = {
    active: boolean;
    startedAt: string | null;
    updatedAt: string | null;
    counts: number;
    malas: number;
};
```

- [ ] **Step 4: Update `INITIAL_STATE` — remove `paused: false`**

Change lines 50–58:

```ts
session: {
    active: false,
    startedAt: null,
    updatedAt: null,
    counts: 0,
    malas: 0,
},
```

- [ ] **Step 5: Update `get()` — strip stale `paused` key on read**

After the session spread in `get()` (line 70), add one line to discard any legacy `paused` key from old localStorage data:

```ts
session: (() => {
    const s: any = { ...INITIAL_STATE.session, ...(parsed.session || {}) };
    delete s.paused;
    return s as SessionState;
})(),
```

This replaces the existing `session: { ...INITIAL_STATE.session, ...(parsed.session || {}) }` line.

- [ ] **Step 6: Update `startSession()` — remove `paused: false` assignment**

Change lines 135–144:

```ts
startSession: () => {
    const data = storage.get();
    const now = new Date().toISOString();
    data.session.active = true;
    data.session.startedAt = data.session.startedAt || now;
    data.session.updatedAt = now;
    storage.save(data);
    return data;
},
```

- [ ] **Step 7: Delete `pauseSession()` and `resumeSession()` methods**

Remove lines 146–162 entirely (both methods).

- [ ] **Step 7: Remove `paused` guards in `increment()`**

Change the two guards at lines 99 and 112 from:
```ts
if (data.session.active && !data.session.paused) {
```
to:
```ts
if (data.session.active) {
```

(Both occurrences — one for counts, one for mala completion.)

- [ ] **Step 8: Update `resetSession()` — remove `paused: false`**

Change lines 164–176:

```ts
resetSession: () => {
    const data = storage.get();
    data.session = {
        active: false,
        startedAt: null,
        updatedAt: null,
        counts: 0,
        malas: 0,
    };
    storage.save(data);
    return data;
},
```

- [ ] **Step 9: Run tests — verify they pass**

```bash
npm run test -- src/lib/storage.test.ts
```

Expected: all 8 tests PASS.

- [ ] **Step 10: Run full test suite — verify nothing broken**

```bash
npm run test
```

Expected: all tests PASS (no regressions).

- [ ] **Step 11: TypeScript check**

```bash
npm run build 2>&1 | head -30
```

Expected: no errors relating to `paused` or `pauseSession`/`resumeSession`.

- [ ] **Step 12: Commit**

```bash
git add src/lib/storage.ts src/lib/storage.test.ts
git commit -m "refactor: remove paused state from session model

Sessions are now either inactive or active — no paused state.
Removes pauseSession(), resumeSession(), and the paused field.
Stale paused:true from localStorage is silently ignored on read."
```

---

## Task 2: Update i18n strings

**Files:**
- Modify: `src/i18n/locales/en.json`
- Modify: `src/i18n/locales/hi.json`

- [ ] **Step 1: Update `en.json`**

In the `counter` object, make these changes:
- Remove the `"paused"` key
- Remove the `"resume"` key
- Remove the `"pause"` key
- Add `"focus": "Focus"` (can go after `"history"`)

The updated `counter` section should read:

```json
"counter": {
  "startPrompt": "Start a session to begin 🙏",
  "malaOffered": "Mala Offered to Community! 🌺",
  "contributionSent": "Contribution Sent! 🚩",
  "malaCompleted": "Mala Completed! 🕉️",
  "history": "History",
  "focus": "Focus",
  "startSession": "Start Session",
  "resetSession": "Reset Session",
  "addChant": "Add Chant",
  "today": "Today",
  "lifetime": "Lifetime",
  "malas": "malas",
  "online": "Online",
  "offline": "Offline",
  "sessionTotal": "Session: {{malas}} malas"
}
```

- [ ] **Step 2: Update `hi.json`**

Same changes in Hindi. The updated `counter` section:

```json
"counter": {
  "startPrompt": "जाप शुरू करने के लिए सत्र प्रारंभ करें 🙏",
  "malaOffered": "समुदाय को माला अर्पित! 🌺",
  "contributionSent": "योगदान भेजा गया! 🚩",
  "malaCompleted": "माला पूर्ण! 🕉️",
  "history": "इतिहास",
  "focus": "फ़ोकस",
  "startSession": "सत्र शुरू करें",
  "resetSession": "सत्र रीसेट करें",
  "addChant": "जाप जोड़ें",
  "today": "आज",
  "lifetime": "कुल",
  "malas": "माला",
  "online": "ऑनलाइन",
  "offline": "ऑफ़लाइन",
  "sessionTotal": "सत्र: {{malas}} माला"
}
```

- [ ] **Step 3: Verify no orphan key references**

```bash
grep -r "counter\.pause\b\|counter\.resume\b" src/
```

Expected: no results. If any appear, update those callsites to remove the reference.

- [ ] **Step 4: Commit**

```bash
git add src/i18n/locales/en.json src/i18n/locales/hi.json
git commit -m "i18n: remove pause/resume keys, add focus key"
```

---

## Task 3: Focus Mode in JapaCounter

**Files:**
- Modify: `src/components/JapaCounter.tsx`

The component is large — work through it section by section. Read the file fresh before starting.

- [ ] **Step 1: Remove unused `Pause` import**

In the lucide-react import line (line 4), remove `Pause` from the destructure. Keep `Play`, `RotateCw`, and all others.

- [ ] **Step 2: Remove pause-related handlers**

Delete `handlePauseSession` (line 295) and `handleResumeSession` (line 296) entirely.

- [ ] **Step 3: Remove the pause guard in `handleTap`**

Remove these lines from `handleTap` (currently lines 228–231):

```ts
if (data.session.paused) {
    setFeedback(t('counter.paused'));
    setTimeout(() => setFeedback(null), 2000);
    return;
}
```

- [ ] **Step 4: Add `focusMode` state**

After the existing `useState` declarations (after line ~59, near `isOnline`), add:

```ts
const [focusMode, setFocusMode] = useState<boolean>(() =>
    localStorage.getItem('japa_focus_mode') === 'true'
);
// Focus mode is only effective when a session is active
const effectiveFocusMode = focusMode && data.session.active;

const toggleFocusMode = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !focusMode;
    setFocusMode(next);
    localStorage.setItem('japa_focus_mode', String(next));
};
```

- [ ] **Step 5: Update the outer Box to support dark background transition**

The root `<Box>` `sx` prop (line 334) needs a background and transition. Add:

```ts
sx={{
    minHeight: '100%',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    cursor: 'pointer',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    MozUserSelect: 'none',
    WebkitTouchCallout: 'none',
    touchAction: 'manipulation',
    background: effectiveFocusMode
        ? 'linear-gradient(160deg, #1a0800 0%, #3d1200 60%, #7c2d00 100%)'
        : 'transparent',
    transition: 'background 0.3s ease',
}}
```

- [ ] **Step 6: Conditionally hide MantraPlayerBar**

Wrap the MantraPlayerBar block (lines ~351–353) with `{!effectiveFocusMode && (…)}`:

```tsx
{!effectiveFocusMode && (
    <Box sx={{ pointerEvents: 'auto', zIndex: 20 }} onClick={e => e.stopPropagation()}>
        <MantraPlayerBar mantras={mantras} loading={mantrasLoading} />
    </Box>
)}
```

- [ ] **Step 7: Replace History button with Focus toggle in header**

Replace the entire right-side `<Box>` in the header (the one containing the History `<Button>`, lines ~374–384) with the Focus toggle. The updated header becomes:

```tsx
{/* Header / Top Bar */}
<Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pl: 2, pr: 2, py: 2, zIndex: 10, pointerEvents: 'none' }}>
    {/* Left icons — hidden in focus mode */}
    {!effectiveFocusMode && (
        <Box sx={{ display: 'flex', gap: 1, pointerEvents: 'auto' }}>
            <IconButton
                onClick={(e) => { e.stopPropagation(); setSoundEnabled(!soundEnabled); }}
                color="primary"
                sx={{ bgcolor: 'rgba(234, 88, 12, 0.1)', '&:hover': { bgcolor: 'rgba(234, 88, 12, 0.2)' } }}
            >
                {soundEnabled ? <Volume2 size={24} /> : <VolumeX size={24} />}
            </IconButton>
            <IconButton
                onClick={handleReset}
                color="secondary"
                sx={{ bgcolor: 'rgba(136, 19, 55, 0.1)', '&:hover': { bgcolor: 'rgba(136, 19, 55, 0.2)' } }}
            >
                <RotateCcw size={24} />
            </IconButton>
        </Box>
    )}
    {effectiveFocusMode && <Box />}  {/* spacer to keep toggle right-aligned */}

    {/* Focus toggle — only shown when session is active */}
    {data.session.active && (
        <Box sx={{ pointerEvents: 'auto' }}>
            <Button
                onClick={toggleFocusMode}
                variant={effectiveFocusMode ? 'contained' : 'outlined'}
                color="secondary"
                size="small"
                sx={{
                    borderRadius: 20,
                    px: 1.5,
                    py: 0.5,
                    minWidth: 'auto',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    lineHeight: 1.2,
                    ...(effectiveFocusMode && {
                        color: 'secondary.contrastText',
                    }),
                }}
            >
                {t('counter.focus')}
            </Button>
        </Box>
    )}
</Box>
```

- [ ] **Step 8: Hide chips in focus mode**

Wrap the online chip block (lines ~390–404) with `{!effectiveFocusMode && (…)}`.

- [ ] **Step 9: Hide pledge/personal-pledge badges in focus mode**

Wrap each mode badge block (pledge badge ~lines 407–425, personal-pledge badge ~lines 427–442) with `{!effectiveFocusMode && (…)}`.

- [ ] **Step 10: Update mantra text block for focus mode**

In the mantra display block (lines ~447–503), the text itself stays but font-size controls hide:

```tsx
{mantra && (
    <Box sx={{
        position: 'relative',
        mt: effectiveFocusMode ? 4 : 8,
        mb: 4,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        maxWidth: 360,
        minHeight: 80,
        pointerEvents: 'auto',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        MozUserSelect: 'none',
        WebkitTouchCallout: 'none',
    }}>
        <Typography
            variant="body1"
            sx={{
                fontSize: `${mantraFontSize}px`,
                fontFamily: theme.typography.fontFamily,
                fontStyle: 'italic',
                fontWeight: 500,
                color: effectiveFocusMode ? 'rgba(253,235,208,0.4)' : 'primary.main',
                textAlign: 'center',
                transition: 'font-size 0.2s ease-in-out, color 0.3s ease',
                px: 2,
                userSelect: 'none',
                WebkitUserSelect: 'none',
            }}
        >
            "{mantra}"
        </Typography>

        {/* Font Size Controls — hidden in focus mode */}
        {!effectiveFocusMode && (
            <Box sx={{ display: 'flex', gap: 1, mt: 1, opacity: 0.5, '&:hover': { opacity: 1 }, transition: 'opacity 0.2s' }}>
                <Button size="small" onClick={(e) => handleFontSizeChange(e, -2)} disabled={mantraFontSize <= 14} sx={{ minWidth: 'auto', p: 0.5 }}>A-</Button>
                <Button size="small" onClick={(e) => handleFontSizeChange(e, 2)} disabled={mantraFontSize >= 48} sx={{ minWidth: 'auto', p: 0.5 }}>A+</Button>
            </Box>
        )}
    </Box>
)}
```

- [ ] **Step 11: Scale BeadRing and dim progress bar in focus mode**

Replace the BeadRing line (line ~505) and progress block (~507–516) with:

```tsx
{/* BeadRing — scaled up in focus mode */}
<Box sx={{ transform: effectiveFocusMode ? 'scale(1.15)' : 'scale(1)', transition: 'transform 0.3s ease' }}>
    <BeadRing count={data.currentCount} />
</Box>

{/* Progress bar */}
<Box sx={{ mt: 1, width: '100%', maxWidth: 320, opacity: effectiveFocusMode ? 0.4 : 1, transition: 'opacity 0.3s ease' }}>
    <LinearProgress
        variant="determinate"
        value={Math.min(100, (data.currentCount / 108) * 100)}
        sx={{
            height: effectiveFocusMode ? 3 : 8,
            borderRadius: 6,
            bgcolor: 'action.hover',
            transition: 'height 0.3s ease',
        }}
    />
    {!effectiveFocusMode && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', textAlign: 'center' }}>
            {data.currentCount} / 108 beads
        </Typography>
    )}
</Box>
```

- [ ] **Step 12: Replace stats row with focus-aware version**

Replace the stats row (lines ~518–543) with a version that shows just today's count (large) in focus mode, and the normal two-column layout otherwise:

```tsx
{effectiveFocusMode ? (
    <Box sx={{ mt: 2, textAlign: 'center' }}>
        <Typography variant="h2" sx={{ color: 'rgba(234,88,12,0.9)', fontWeight: 800, lineHeight: 1, textShadow: '0 0 20px rgba(234,88,12,0.4)' }}>
            {data.history[getTodayDate()]?.malas || 0}
        </Typography>
        <Typography variant="caption" sx={{ color: 'rgba(253,235,208,0.4)', letterSpacing: 3, textTransform: 'uppercase', display: 'block' }}>
            {t('counter.malas')} {t('counter.today').toLowerCase()}
        </Typography>
    </Box>
) : (
    <Box sx={{ mt: 1, display: 'flex', gap: 3, justifyContent: 'center', alignItems: 'center', pointerEvents: 'none' }}>
        <Box sx={{ textAlign: 'center' }}>
            <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 2, fontWeight: 700, display: 'block' }}>
                {t('counter.today')}
            </Typography>
            <Typography variant="h3" color="primary.main" sx={{ lineHeight: 1 }}>
                {data.history[getTodayDate()]?.malas || 0}
            </Typography>
            <Typography variant="caption" color="text.secondary">{t('counter.malas')}</Typography>
        </Box>
        <Box sx={{ width: '1px', height: 56, bgcolor: 'divider' }} />
        <Box sx={{ textAlign: 'center' }}>
            <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 2, fontWeight: 700, display: 'block' }}>
                {t('counter.lifetime')}
            </Typography>
            <Typography variant="h3" color="secondary.main" sx={{ lineHeight: 1 }}>
                {data.totalMalas}
            </Typography>
            <Typography variant="caption" color="text.secondary">{t('counter.malas')}</Typography>
        </Box>
    </Box>
)}
```

- [ ] **Step 13: Update feedback toast style to be conditional**

Replace the `style` prop on the `<motion.div>` toast (lines ~553–558) with a conditional:

```tsx
style={{
    position: 'absolute', bottom: 80,
    backgroundColor: effectiveFocusMode
        ? 'rgba(253,235,208,0.12)'
        : theme.palette.primary.main,
    color: effectiveFocusMode
        ? 'rgba(253,235,208,0.9)'
        : theme.palette.primary.contrastText,
    padding: '12px 32px', borderRadius: 16,
    boxShadow: effectiveFocusMode
        ? '0 8px 32px rgba(0,0,0,0.4)'
        : '0 8px 32px rgba(234, 88, 12, 0.3)',
}}
```

- [ ] **Step 14: Remove Pause button from session controls, hide all controls in focus mode**

Replace the entire controls `<Box>` (lines ~563–613) with a version that hides everything in focus mode and removes Pause/Resume:

```tsx
{/* Controls — hidden in focus mode */}
{!effectiveFocusMode && (
    <Box sx={{ p: 2, textAlign: 'center', pb: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, alignItems: 'center' }}>
            {!data.session.active ? (
                <Button
                    variant="contained" color="primary" startIcon={<Play size={18} />}
                    onClick={(e) => { e.stopPropagation(); handleStartSession(); }}
                    sx={{ borderRadius: 8, px: 4 }}
                >
                    {t('counter.startSession')}
                </Button>
            ) : (
                <Button
                    variant="outlined" color="error" startIcon={<RotateCw size={18} />}
                    onClick={(e) => { e.stopPropagation(); handleResetSession(); }}
                >
                    {t('counter.resetSession')}
                </Button>
            )}

            <Button
                variant="contained" color="secondary"
                onClick={(e) => { e.stopPropagation(); handleTap(); }}
                disabled={!data.session.active}
                sx={{ borderRadius: 8, px: 4 }}
            >
                {t('counter.addChant')}
            </Button>

            <Typography variant="body2" color="text.secondary" sx={{ opacity: 0.7, fontStyle: 'italic' }}>
                {data.session.active ? t('counter.sessionTotal', { malas: data.session.malas }) : t('counter.startPrompt')}
            </Typography>
        </Box>
    </Box>
)}
```

- [ ] **Step 15: TypeScript check**

```bash
npm run build 2>&1 | head -40
```

Expected: zero errors. If TypeScript complains about removed `paused` usages anywhere, delete those references.

- [ ] **Step 16: Run lint**

```bash
npm run lint 2>&1 | head -30
```

Expected: no errors. Fix any unused import warnings (e.g. `Pause` if still present).

- [ ] **Step 17: Run full test suite**

```bash
npm run test
```

Expected: all tests PASS.

- [ ] **Step 18: Manual smoke test**

Start dev server: `npm run dev`

Check these scenarios:
1. Counter screen loads — no Pause button visible
2. Start a session — Focus toggle appears (small, right-aligned in header)
3. Toggle Focus on — dark background fades in, ring grows, all chrome hides, today's count shows large
4. Tap anywhere — bead increments, haptic/sound work
5. Complete a mala — toast shows (dimmed light style on dark background)
6. Toggle Focus off — normal view restores, everything back
7. Reset session — Focus toggle disappears (session no longer active)
8. Reload page — `focusMode` preference persists from localStorage

- [ ] **Step 19: Commit**

```bash
git add src/components/JapaCounter.tsx
git commit -m "feat: add Focus Mode toggle to JapaCounter

A small pill button in the header switches to a dark immersive view:
- Deep saffron-brown gradient background
- BeadRing scales to 115%, all chrome hides
- Only today's mala count + faint mantra text visible
- One tap restores normal layout, session continues uninterrupted
- Preference persisted to localStorage

Also removes Pause/Resume buttons (sessions are active or inactive only)."
```
