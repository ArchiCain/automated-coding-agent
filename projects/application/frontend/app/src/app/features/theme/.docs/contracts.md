# Theme — Contracts (Frontend View)

The canonical contract is owned by the backend at `projects/application/backend/app/src/features/theme/.docs/contracts.md`. This file describes how the frontend consumes it — what it sends, what it uses from the response, and what it ignores.

## Base URL

All calls go to `${AppConfigService.backendUrl}/theme` — the runtime `backendUrl` from `public/config.json`, default `/api` (`src/app/features/api-client/services/app-config.service.ts`). Both calls pass `withCredentials: true` explicitly (`services/theme.service.ts:40, 51`) although `authInterceptor` already applies it.

## Endpoints consumed

### `GET /theme`

**Caller:** `ThemeService.loadPreference()` (`services/theme.service.ts:38-47`).
**Auth:** session cookie (`withCredentials: true`). The frontend never sets an `Authorization` header here.
**Request:** no body, no query params.
**Response shape the frontend reads:**
```typescript
{
  theme: 'light' | 'dark';
  // userId is returned by the backend but ignored by the client
}
```
The TypeScript generic on the call is `HttpClient.get<{ theme: ThemeMode }>` (`theme.service.ts:40`), so `userId` is truncated from the static type. Only `response.theme` is used to update the signal and the `<html>` class.
**Error handling:** `.subscribe({ next: ... })` with no `error` callback (`theme.service.ts:41-46`). Any HTTP error is silently dropped; `_mode` stays at its current value (`'dark'` on first mount).

### `PUT /theme`

**Caller:** `ThemeService.savePreference(mode)` (`services/theme.service.ts:49-53`).
**Auth:** session cookie.
**Request body:**
```typescript
{
  theme: 'light' | 'dark';
}
```
`mode` comes from `ThemeMode = 'light' | 'dark'` (`theme.service.ts:6`). The frontend never sends any other value — `toggle()` can only produce `'light'` or `'dark'` (`theme.service.ts:26`).
**Response:** ignored. `.subscribe()` is called with no arguments (`theme.service.ts:52`).
**Error handling:** none. A non-2xx response, a 401, or a network error is silently dropped — the optimistic class swap on `<html>` is never reverted.

## Shared Types

```typescript
// services/theme.service.ts:6, re-exported from features/theme/index.ts:3
export type ThemeMode = 'light' | 'dark';
```

The feature's public API (`src/app/features/theme/index.ts`) exports:
- `ThemeService` — the singleton consumed by templates via `theme-toggle`.
- `ThemeToggleComponent` — the `mat-icon-button` used by `AppHeaderComponent`.
- `ThemeModule` — thin wrapper; unused.
- `ThemeMode` — the only exported type.

## Alignment with backend contract

| Backend field / behavior | Frontend handling |
|---|---|
| `GET /theme` returns `{ theme, userId }` | Reads `theme`, discards `userId` |
| `PUT /theme` body `{ theme: 'light' \| 'dark' }` | Sends exactly this shape |
| `PUT /theme` performs upsert | Frontend calls unconditionally on every toggle; relies on backend upsert |
| Backend auto-creates default `'dark'` row on first `GET` | Frontend sees `theme: 'dark'` on first load; no client-side fallback needed |
| Backend has no `ValidationPipe`, so `@IsEnum` is inert (backend `.docs/spec.md:13`) | Frontend type-limits `ThemeMode` to `'light' \| 'dark'` and `toggle()` can only emit these, so no invalid payloads are sent from this client |
| `401 Unauthorized` on missing / invalid JWT | Silently swallowed — no redirect, no retry. `authInterceptor` does trigger its refresh-and-retry flow on 401 for non-`/auth/*` URLs (`features/api-client/interceptors/auth.interceptor.ts`), so `/theme` calls benefit from that transparent retry before reaching `ThemeService`. |
