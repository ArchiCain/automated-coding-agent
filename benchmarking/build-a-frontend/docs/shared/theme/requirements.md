# Theme Feature

**Service location:** `src/app/features/shared/services/theme.service.ts`

## Purpose

Dark/light theme toggle. Preference is persisted server-side per user. Defaults to dark if no preference exists.

## ThemeService

**Provided in:** root

### Signals
| Signal | Type | Purpose |
|--------|------|---------|
| `isDark()` | `boolean` | True if current theme is dark |

### Methods
| Method | Purpose |
|--------|---------|
| `toggle()` | Switch between dark and light, save to backend |
| `loadPreference()` | Load theme from `GET /api/theme`, apply to body |

### Backend Contract
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/theme` | Load saved preference (returns `{ theme: 'light' \| 'dark', userId }`) |
| PUT | `/api/theme` | Save preference (body: `{ theme: 'light' \| 'dark' }`) |

## How It Works

1. On app bootstrap (after auth check), `ThemeService.loadPreference()` is called
2. `GET /api/theme` returns the user's saved preference (or `dark` default)
3. Service applies CSS class to `<body>`: `theme-dark` or `theme-light`
4. Angular Material theme overrides activate (see `standards/design.md`)
5. When user toggles, `PUT /api/theme` saves the preference
6. Body class updates immediately (optimistic)

## Acceptance Criteria

- [ ] Default to dark theme if no preference stored
- [ ] Toggle switches theme immediately (no page reload)
- [ ] Preference persists across sessions (saved to backend)
- [ ] Theme applies to all Material components (cards, dialogs, inputs, buttons)
- [ ] Login page respects the theme (even before auth — use last-known or default dark)
