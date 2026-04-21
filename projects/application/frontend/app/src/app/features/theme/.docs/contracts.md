# Theme — Contracts

> Canonical API contract is defined in: `backend/app/src/features/theme/.docs/contracts.md`

## Frontend-Specific Types

```typescript
// theme.service.ts
type ThemeMode = 'light' | 'dark';
```

## API Usage

- `GET /theme` — returns `{ theme: ThemeMode }` (frontend ignores `userId` field)
- `PUT /theme` — sends `{ theme: ThemeMode }`, fire-and-forget (no response handling)
- All requests use `withCredentials: true`

## Frontend Behavior

The frontend applies the theme optimistically (updates DOM class immediately) and sends the PUT request in the background without waiting for a response. The GET request is used only on initialization to load the stored preference.
