# Theme — Spec

## Purpose

Light/dark theme toggle for the Angular SPA. A single `ThemeService` owns the current mode as a signal, toggles a class on `<html>` to drive Material M3 theming and `--app-*` custom properties, and persists the preference server-side via `GET /theme` / `PUT /theme`. A `mat-icon-button` theme toggle in the app header is the only UI entry point.

## Behavior

- Initial in-memory mode is `'dark'` — the private signal is initialized to `'dark'` (`src/app/features/theme/services/theme.service.ts:14`).
- The service is `providedIn: 'root'` but is instantiated lazily — it is only constructed when `ThemeToggleComponent` injects it (`theme-toggle.component.ts:18`). `ThemeToggleComponent` is embedded in `AppHeaderComponent` (`src/app/features/app-header/components/app-header/app-header.component.ts:19`), which is rendered by `AppLayoutComponent` — the authenticated shell. Pre-auth (login page) the service is never constructed.
- `ThemeService.initialize()` exists (`theme.service.ts:19-23`) but is **not called from anywhere** in the app (`app.config.ts`, `app.ts`, `login.page.ts` do not call it). `applyTheme` and `loadPreference` only run as side effects of construction + toggling.
- Because the initial render happens before the service is constructed, `<html>` carries no theme class at first paint. The default Material palette from `styles.scss:9` (`mat.theme(light.$light-theme)`) applies, but the `--app-*` CSS custom properties — which are only defined inside `:root .light-theme` / `:root .dark-theme` selectors (`styles/_light-theme.scss:18`, `styles/_dark-theme.scss:18`) — are undefined until a class is added.
- Once `AppLayoutComponent` mounts, `ThemeToggleComponent` -> `ThemeService` is constructed. Construction itself does NOT call `applyTheme` or `loadPreference`; no class is added and no request is sent until the user clicks the toggle. See Discrepancies.
- `toggle()` flips the signal between `'light'` and `'dark'`, applies the class synchronously, then PUTs the new preference (`theme.service.ts:25-30`). The PUT is fire-and-forget (`.subscribe()` with no handlers — `theme.service.ts:52`).
- `applyTheme(mode)` removes both `light-theme` and `dark-theme` classes from `document.documentElement` and adds the one matching `mode` (`theme.service.ts:32-36`). The `DOCUMENT` token is injected for SSR-safe DOM access (`theme.service.ts:1, 12`).
- `loadPreference()` sends `GET {backendUrl}/theme` with `withCredentials: true` and, on success, replaces the mode and applies the class (`theme.service.ts:38-47`). Errors are silently swallowed — there is no `error` handler on the subscription, so a 401 / network failure leaves the signal untouched and the UI stays in its current state.
- `savePreference(mode)` sends `PUT {backendUrl}/theme` with body `{ theme: mode }` and `withCredentials: true`. No response handling; errors are silently swallowed (`theme.service.ts:49-53`).
- `withCredentials: true` is set per-call on both HTTP calls. `authInterceptor` already forces it for all requests, so these per-call flags are redundant (project coding standard, `features/api-client/interceptors/auth.interceptor.ts:15`).
- The frontend ignores the `userId` field returned by the backend — only `response.theme` is read (`theme.service.ts:42-45`).
- No `@IsEnum` enforcement exists on the client, and the backend has no global `ValidationPipe` (backend `.docs/spec.md:13`), so any string the backend returns would be assigned to `_mode` verbatim and applied as `<html class="{value}-theme">`. In normal operation the backend returns `'light'` or `'dark'`.
- The toggle icon shows `light_mode` when dark (to switch to light) and `dark_mode` when light (`theme-toggle.component.ts:12`). `aria-label="Toggle theme"`.
- `ThemeMode` is exported as a type from the feature barrel alongside `ThemeService` and `ThemeToggleComponent` (`index.ts:2-4`).

## Components / Services

| Part | File | Role |
|---|---|---|
| `ThemeService` | `services/theme.service.ts:8-54` | Singleton (`providedIn: 'root'`). Owns `_mode` signal + `mode` / `isDark` readonly derivations. Methods: `initialize()` (unused), `toggle()`, `applyTheme()` (private), `loadPreference()` (private), `savePreference()` (private). |
| `ThemeToggleComponent` | `components/theme-toggle/theme-toggle.component.ts:7-19` | `app-theme-toggle` selector. `mat-icon-button` bound to `themeService.toggle()`. `OnPush`. Public `themeService` field for template binding. |
| `ThemeModule` | `theme.module.ts:4-8` | Thin NgModule wrapper re-exporting `ThemeToggleComponent` for module-style consumers. Not used by the app today. |
| Light palette SCSS | `styles/_light-theme.scss:7-47` | `mat.define-theme` with `mat.$blue-palette` primary + `mat.$green-palette` tertiary; `--app-*` custom props under `:root .light-theme`. |
| Dark palette SCSS | `styles/_dark-theme.scss:7-52` | `mat.define-theme` with `mat.$azure-palette` primary + `mat.$green-palette` tertiary; `--app-*` custom props under `:root .dark-theme` (including scrollbar tokens). |
| Global wiring | `src/styles.scss:2-15` | `@use` light + dark partials, applies light by default to `html`, overrides on `html.dark-theme`. |

## Acceptance Criteria

- [ ] `ThemeToggleComponent` renders a `mat-icon-button` with `aria-label="Toggle theme"` in the app header.
- [ ] Icon is `light_mode` when `ThemeService.isDark()` is true, otherwise `dark_mode`.
- [ ] Clicking the toggle flips `ThemeService.mode()` and swaps the `light-theme` / `dark-theme` class on `<html>` synchronously, before any network call.
- [ ] Clicking the toggle sends `PUT {backendUrl}/theme` with body `{ theme: 'light' | 'dark' }` and `withCredentials`.
- [ ] `GET {backendUrl}/theme` is sent only when `ThemeService.loadPreference()` is invoked; on success the response `theme` replaces the signal and the `<html>` class is updated.
- [ ] GET / PUT failures do not throw or show UI — the service silently keeps the current in-memory mode.
- [ ] The service starts with `mode === 'dark'`; no `<html>` theme class is added by the service until a user toggles or `loadPreference` succeeds (see Discrepancies).
- [ ] All authenticated requests rely on the `authInterceptor`-supplied session cookie; no bearer token is managed by this feature.
