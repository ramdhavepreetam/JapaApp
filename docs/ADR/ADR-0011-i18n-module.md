# ADR-0011: Internationalisation (i18n) Module Architecture

**Date:** 2026-03-21
**Status:** Accepted
**Module:** Internationalisation

---

## Context

JapaApp serves users across India and the Indian diaspora globally. Both English and Hindi (Devanagari script) must be fully supported. The mantra text itself is in Sanskrit/Devanagari and must render correctly regardless of the UI language.

## Decision

### i18next with localStorage language detection

`src/i18n/index.ts` configures i18next with `browser-languagedetector`. Language preference is stored in `localStorage` under key `japa_lang`. Supported languages: `en` (default) and `hi`.

### Namespace-based string organisation

Translation keys are grouped by feature namespace:
```
nav, counter, profile, communities, communityTabs, feed, chat, members, pledge, report
```
Each namespace maps to a section in `en.json` and `hi.json`. Adding a new feature requires adding keys to both files.

### CSS `:lang(hi)` selector for Devanagari font

When the user switches to Hindi, `App.tsx` sets `document.documentElement.lang = 'hi'`. The global CSS rule `:lang(hi) { font-family: 'Noto Sans Devanagari', sans-serif; }` applies the correct font to all Devanagari text. The `@fontsource/noto-sans-devanagari` package is loaded in `main.tsx`.

This is preferred over manually adding `fontFamily` to every component — one global rule handles all Devanagari text consistently.

### `LanguageToggle` component

`src/components/LanguageToggle.tsx` is a pill toggle (EN | हिं) rendered in `ProfileView` for both guest and signed-in users. It calls `i18n.changeLanguage()` which triggers the `japa_lang` localStorage write and re-renders all `useTranslation()` consumers.

### Mantra text in Devanagari

Mantra names store both `name` (romanised) and `nameDevanagari` (Devanagari script). The optional `nameMarathi` field supports Marathi script variants. Both are rendered in `MantraPlayerBar` using the Noto Sans Devanagari font regardless of UI language.

## Consequences

- **Positive:** Single CSS rule handles all Devanagari rendering — no per-component font settings.
- **Positive:** `japa_lang` persists across sessions without a server round-trip.
- **Positive:** Namespace organisation makes it easy to find and add strings for a specific feature.
- **Trade-off:** All strings must be added to **both** `en.json` and `hi.json` simultaneously — easy to miss during fast iteration. Missing keys fall back to the key string itself (visible in UI).
- **Trade-off:** No runtime language switch for mantra audio — audio files are language-neutral (Sanskrit), so this is not a problem in practice.

## Key Files

| File | Purpose |
|------|---------|
| `src/i18n/index.ts` | i18next setup + localStorage language detection |
| `src/i18n/locales/en.json` | English strings (namespaced) |
| `src/i18n/locales/hi.json` | Hindi Devanagari strings |
| `src/components/LanguageToggle.tsx` | EN | हिं pill toggle |
| `src/main.tsx` | `@fontsource/noto-sans-devanagari` import |
| `src/App.tsx` | Sets `document.documentElement.lang` on language change |

## Open Issues

- Missing keys are silently rendered as the key string — add a CI lint step to validate that `en.json` and `hi.json` always have identical key sets.
- No RTL support — not needed for Hindi (Devanagari is LTR) but would be needed for Urdu/Arabic if ever added.
- Hindi translations for some newer strings (communityTabs.pledges, etc.) were added in this sprint — verify all are contextually correct with a native speaker.
