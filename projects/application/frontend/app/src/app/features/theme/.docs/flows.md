# Theme — Flows

## Flow 1: App boot — pre-auth (login page)

1. `main.ts` bootstraps `App` (`src/main.ts`, `src/app/app.ts:4-10`).
2. `provideAppInitializer` blocks on `AppConfigService.load()` (`app.config.ts:17-20`). No theme work happens here.
3. Router resolves `/login` — the public route (`app.routes.ts`). The login page does not import `ThemeService` or `ThemeToggleComponent` (`features/keycloak-auth/pages/login.page.ts`).
4. `ThemeService` is NOT constructed. `<html>` has no `light-theme` / `dark-theme` class.
5. `mat.theme(light.$light-theme)` from `styles.scss:9` applies Material's default light palette to Material components. `--app-*` custom properties are undefined because they live inside `.light-theme` / `.dark-theme` selectors — any style reading them (e.g. `body { background-color: var(--app-bg-default); }` in `styles.scss:20`) falls back to the CSS default (transparent / initial).

## Flow 2: App boot — authenticated shell mount

1. User navigates to a protected route (or `/` after login). `authGuard` validates the session (`features/keycloak-auth/guards/auth.guard.ts`).
2. `AppLayoutComponent` loads and renders `<app-header>` (`features/layouts/components/app-layout/app-layout.component.html:2`).
3. `AppHeaderComponent` template includes `<app-theme-toggle />` (`app-header.component.ts:19`).
4. Angular instantiates `ThemeToggleComponent`; its `inject(ThemeService)` triggers the first construction of `ThemeService` (`theme-toggle.component.ts:18`).
5. Construction runs class-field initializers only — `_mode` is set to `'dark'` (`theme.service.ts:14`). No method is called; **`applyTheme` and `loadPreference` do not run** because nothing invokes `initialize()`.
6. The toggle icon renders `light_mode` because `isDark()` returns `true` (`theme-toggle.component.ts:12`). `<html>` still has no theme class.

> See Discrepancies in `spec.md` — the intended behavior per the prior docs was for `loadPreference()` to run on bootstrap and hydrate the theme from the backend. The current wiring requires a user click to take any visible effect beyond the Material default light palette.

## Flow 3: Toggle to light (starting from default dark signal)

1. User clicks the theme toggle (`theme-toggle.component.ts:11`).
2. `ThemeService.toggle()` runs (`theme.service.ts:25-30`):
   1. Computes `newMode = 'light'` because `_mode() === 'dark'`.
   2. `_mode.set('light')` — signal updates, `isDark()` recomputes to `false`, the template icon swaps to `dark_mode`.
   3. `applyTheme('light')` removes `dark-theme` and adds `light-theme` on `document.documentElement` (`theme.service.ts:32-36`). Material re-evaluates `mat.theme(...)` and the `:root .light-theme` `--app-*` tokens activate.
   4. `savePreference('light')` fires `PUT {backendUrl}/theme` with body `{ theme: 'light' }` and `withCredentials: true` (`theme.service.ts:49-53`).
3. The PUT response is ignored (`.subscribe()` with no handlers). A 401 / 500 / network error is swallowed — the UI stays light.

## Flow 4: Toggle to dark

1. User clicks the toggle while in light mode.
2. `toggle()` sets `_mode = 'dark'`, swaps `<html>` from `light-theme` to `dark-theme`, fires `PUT /theme` with `{ theme: 'dark' }`.
3. The dark scrollbar rules under `.dark-theme` in `styles.scss:27-51` take effect (webkit scrollbar colors + thin scrollbar).

## Flow 5: Explicit `loadPreference()` call (currently unreachable)

If any caller invoked `ThemeService.initialize()` (`theme.service.ts:19-23`):

1. `applyTheme(_mode())` — on first call this adds `dark-theme` to `<html>` because `_mode` is `'dark'`.
2. `loadPreference()` sends `GET {backendUrl}/theme` with `withCredentials: true` (`theme.service.ts:38-47`).
3. On 200: `_mode.set(response.theme)` then `applyTheme(response.theme)`. The signal and DOM class update to the server value. `response.userId` is ignored.
4. On any error: the subscription has no `error` handler, so the error is swallowed and the service stays at `'dark'` (with the dark class from step 1).

No existing caller triggers this flow. See Discrepancies.

## Flow 6: Guest / unauthenticated toggle

Not reachable. The only mount point for `ThemeToggleComponent` is `AppHeaderComponent`, which is rendered only inside `AppLayoutComponent` behind `authGuard` (`app.routes.ts`). The login page has no theme toggle. An unauthenticated user cannot trigger `toggle()` and therefore cannot cause a `PUT /theme`.

If the service were ever constructed pre-auth and `loadPreference` were called, the `GET /theme` would hit `KeycloakJwtGuard` unauthenticated and respond `401` (backend `.docs/contracts.md:20-21`). The frontend's empty error handler would silently ignore it.
