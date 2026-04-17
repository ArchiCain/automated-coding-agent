# Theme Feature — Flows

## Flow 1: App Bootstrap (Dark Preference)

1. User logs in
2. `ThemeService.loadPreference()` runs
3. `GET /api/theme` returns `{ theme: "dark", userId: "..." }`
4. Body gets class `theme-dark`
5. All Material components render with dark palette

## Flow 2: Toggle to Light

1. User clicks theme toggle in sidenav (currently dark)
2. Body class changes from `theme-dark` to `theme-light` immediately
3. `PUT /api/theme` with `{ theme: "light" }` is sent (async, non-blocking)
4. All Material components re-render with light palette

## Flow 3: Toggle Back to Dark

1. User clicks theme toggle again (currently light)
2. Body class changes from `theme-light` to `theme-dark`
3. `PUT /api/theme` with `{ theme: "dark" }` is sent

## Flow 4: Preference Persists

1. User sets theme to light, then closes the browser
2. User opens the app again, logs in
3. `GET /api/theme` returns `{ theme: "light" }`
4. App renders in light mode without user toggling

## Flow 5: New User (No Preference)

1. New user logs in for the first time
2. `GET /api/theme` returns `{ theme: "dark" }` (server default)
3. App renders in dark mode
