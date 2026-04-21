# Theme — Test Plan

Unit tests target `ThemeService` and `ThemeToggleComponent`. E2E tests exercise the toggle inside the authenticated shell. All claims map back to `spec.md` / `flows.md`.

## Contract Tests

- [ ] `PUT /theme` is sent with body `{ theme: 'light' }` when the user toggles from dark (`theme.service.ts:26, 29`).
- [ ] `PUT /theme` is sent with body `{ theme: 'dark' }` when the user toggles from light.
- [ ] `GET /theme` and `PUT /theme` both include `withCredentials: true` on the request (`theme.service.ts:40, 51`).
- [ ] The `GET /theme` response `userId` field is ignored; only `theme` is read (`theme.service.ts:42-45`).
- [ ] An HTTP error on `GET /theme` does not throw and does not mutate `_mode` (no `error` handler is wired).
- [ ] An HTTP error on `PUT /theme` does not throw and does not revert the optimistic `<html>` class change.

## Behavior Tests — `ThemeService`

- [ ] On first construction, `mode()` returns `'dark'` and `isDark()` returns `true` (`theme.service.ts:14`).
- [ ] Constructing the service does NOT add any theme class to `<html>` and does NOT send `GET /theme` — nothing runs until a method is called.
- [ ] `toggle()` from `'dark'` sets `mode()` to `'light'`, adds `light-theme` to `<html>`, removes `dark-theme`, and triggers exactly one `PUT /theme` with `{ theme: 'light' }` (`theme.service.ts:25-30`).
- [ ] `toggle()` from `'light'` produces the inverse: `dark-theme` class, `{ theme: 'dark' }` body.
- [ ] `applyTheme()` is idempotent — repeated calls with the same mode leave exactly one theme class on `<html>` (`theme.service.ts:32-36`).
- [ ] `initialize()` (if called explicitly) applies the current mode class and then fires `GET /theme`; on 200 the signal replaces with `response.theme` and `applyTheme` is invoked again (`theme.service.ts:19-23, 38-47`).

## Behavior Tests — `ThemeToggleComponent`

- [ ] Renders a `<button mat-icon-button>` with `aria-label="Toggle theme"` (`theme-toggle.component.ts:11`).
- [ ] Inner `<mat-icon>` text is `light_mode` when `isDark()` is true, else `dark_mode` (`theme-toggle.component.ts:12`).
- [ ] Clicking the button calls `ThemeService.toggle()` exactly once.
- [ ] Uses `ChangeDetectionStrategy.OnPush` (`theme-toggle.component.ts:15`).

## E2E Scenarios (authenticated)

- [ ] Sign in, open the app shell, click the theme toggle in the header — `<html>` class changes synchronously and a `PUT /theme` is observed on the network tab with the new mode.
- [ ] Sign in after having toggled to `light` in a previous session, and verify the app eventually renders in light mode only if some caller invokes `loadPreference()` (today it is not invoked — see Discrepancies; this test is expected to FAIL until `initialize()` is wired).
- [ ] Visit `/login` while logged out — no `GET /theme` is sent and no theme toggle is visible (`login.page.ts` does not import `ThemeToggleComponent`).
- [ ] Toggle twice rapidly — exactly two `PUT /theme` requests are sent and the final `<html>` class matches the final signal value.

## Edge Cases

- [ ] Backend returns a value other than `'light' | 'dark'` on `GET /theme` — the frontend sets `_mode` to that string and adds `<html class="{value}-theme">`, which does not match any SCSS selector, so no `mat.theme()` override and no `--app-*` tokens activate. This cannot happen under the documented backend contract but is possible because the backend has no `ValidationPipe` (backend `.docs/spec.md:13`).
- [ ] `backendUrl` not yet loaded — cannot occur: `provideAppInitializer` awaits `AppConfigService.load()` before any route renders (`app.config.ts:17-20`), and `ThemeService` is constructed only after route mount.
