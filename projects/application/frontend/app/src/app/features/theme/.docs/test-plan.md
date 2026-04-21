# Theme — Test Plan

## Initialization

- [ ] Defaults to dark theme if no preference stored
- [ ] Loads preference from `GET /api/theme` after auth
- [ ] Applies CSS class to `<html>`: `dark-theme` or `light-theme`
- [ ] Removes opposite theme class when applying

## Toggle

- [ ] Toggle switches theme immediately (no page reload)
- [ ] Body class updates optimistically before API call
- [ ] `PUT /api/theme` with `{ theme }` sent asynchronously (non-blocking)
- [ ] Theme applies to all Material components

## Persistence

- [ ] Preference persists across sessions (saved to backend)
- [ ] On next login, saved preference is loaded and applied

## Edge Cases

- [ ] Login page uses default dark theme (before auth loads preference)
- [ ] Failed `GET /api/theme` falls back to dark (no error shown)
