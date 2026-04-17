# Theme Feature

**Feature directory:** `src/app/features/shared/services/theme.service.ts`

## Purpose

Dark/light theme toggle. Preference is persisted server-side per user. Defaults to dark if no preference exists.

## How It Works

1. On app bootstrap (after auth check), `ThemeService.loadPreference()` is called
2. `GET /api/theme` returns the user's saved preference (or `dark` default)
3. Service applies CSS class to `<body>`: `theme-dark` or `theme-light`
4. Angular Material theme overrides activate (see `standards/design.md`)
5. When user toggles, `PUT /api/theme` saves the preference
6. Body class updates immediately (optimistic)

## Backend Contract

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/theme` | Load saved preference — returns `{ theme: 'light' \| 'dark', userId }` |
| PUT | `/api/theme` | Save preference — body: `{ theme: 'light' \| 'dark' }` |

## Acceptance Criteria

- [ ] Default to dark theme if no preference stored
- [ ] Toggle switches theme immediately (no page reload)
- [ ] Preference persists across sessions (saved to backend)
- [ ] Theme applies to all Material components (cards, dialogs, inputs, buttons)
- [ ] Login page respects the theme (even before auth — use last-known or default dark)
