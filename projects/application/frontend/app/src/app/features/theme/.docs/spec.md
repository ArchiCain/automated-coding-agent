# Theme — Spec

## What it is

Lets a signed-in user switch the app between light and dark appearance from a toggle button in the header, and remembers their choice on the server so it sticks across sessions and devices.

## How it behaves

### Loading the app

The app opens in dark appearance by default. Until the user clicks the toggle, no light/dark class is attached to the page root, so colors driven by the app's custom palette tokens are not yet in effect — the page renders with Material's built-in light palette as a fallback. No request is made to the server to fetch the user's saved preference on boot.

### Pre-auth and the login page

The login page does not render the app header, so the theme toggle never appears and the theme machinery is never started. The login screen uses Material's default appearance and does not reflect the user's saved preference.

### Clicking the toggle while signed in

Once the user is signed in and the authenticated shell is showing, the header shows a single icon button labeled "Toggle theme." The icon is a sun when the app is in dark appearance (click to go light) and a moon when in light appearance (click to go dark). Clicking it flips the appearance immediately — the page root class swaps right away, before any network call — and then sends the new choice to the server in the background. If that save request fails, nothing is shown to the user and the on-screen appearance stays as the user set it.

### Fetching the saved preference

There is a method on the theme service that can fetch the user's saved preference from the server and apply it, but it is not wired up anywhere in the app right now, so this never runs in practice. If it did run and the request failed, the failure would be ignored silently and the current appearance would stay put.

## Acceptance criteria

- [ ] The app header shows a single icon button with the accessible label "Toggle theme."
- [ ] The icon is a sun when the app is in dark appearance and a moon when the app is in light appearance.
- [ ] Clicking the toggle flips the appearance on screen immediately, before any network call.
- [ ] Clicking the toggle sends the new choice to the server with the session cookie.
- [ ] If the save request fails, no error is shown and the on-screen appearance does not revert.
- [ ] The app starts in dark appearance by default.
- [ ] The theme toggle is not shown on the login page.

## Known gaps

- There is an `initialize()` method on the theme service that would fetch and apply the saved preference on boot, but nothing in the app calls it. The user's saved preference is not loaded at startup — the app always opens in dark by default and only changes when the user clicks the toggle.
- The class names applied to the page root are `light-theme` and `dark-theme` on the HTML element. This doesn't match older references to a `theme-dark` class on the body.
- This feature lives at `features/theme/`, not under `features/shared/services/`.
- Errors from the GET and PUT preference requests are swallowed silently — there is no user-visible error handling at all.
- The login page does not apply any theme; it renders with Material's default palette regardless of the user's saved preference.

## Code map

Paths relative to `projects/application/frontend/app/`.

| Concern | File · lines |
|---|---|
| Theme service: owns current mode signal, toggle, apply, load, save | `src/app/features/theme/services/theme.service.ts:8-54` |
| Initial in-memory mode is `'dark'` | `src/app/features/theme/services/theme.service.ts:14` |
| `initialize()` method (defined but never called) | `src/app/features/theme/services/theme.service.ts:19-23` |
| `toggle()` flips signal, applies class synchronously, PUTs preference | `src/app/features/theme/services/theme.service.ts:25-30` |
| `applyTheme()` swaps `light-theme` / `dark-theme` class on `<html>` | `src/app/features/theme/services/theme.service.ts:32-36` |
| `loadPreference()` — `GET /theme`, errors swallowed | `src/app/features/theme/services/theme.service.ts:38-47` |
| `savePreference()` — `PUT /theme`, errors swallowed | `src/app/features/theme/services/theme.service.ts:49-53` |
| `DOCUMENT` token injected for SSR-safe DOM access | `src/app/features/theme/services/theme.service.ts:1,12` |
| Toggle button component (icon swap, aria-label) | `src/app/features/theme/components/theme-toggle/theme-toggle.component.ts:7-19` |
| Toggle embedded in app header (authenticated shell only) | `src/app/features/app-header/components/app-header/app-header.component.ts:19` |
| Feature barrel exports `ThemeService`, `ThemeToggleComponent`, `ThemeMode` | `src/app/features/theme/index.ts:2-4` |
| Thin module wrapper (unused by the app today) | `src/app/features/theme/theme.module.ts:4-8` |
| Light palette and `--app-*` custom properties under `:root .light-theme` | `src/app/features/theme/styles/_light-theme.scss:7-47` |
| Dark palette and `--app-*` custom properties under `:root .dark-theme` | `src/app/features/theme/styles/_dark-theme.scss:7-52` |
| Global SCSS wiring; default Material light palette before any class is applied | `src/styles.scss:2-15` |

### Backend contract

Shapes and endpoints served by the backend `theme` feature; see `projects/application/backend/app/src/features/theme/.docs/spec.md` and `contracts.md`.
