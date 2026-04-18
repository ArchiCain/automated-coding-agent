# Theme — Requirements

## What It Does

Persists user theme preference (light/dark) to the database. Each authenticated user gets one theme record.

## Endpoints

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/theme` | JWT | Get current user's theme preference |
| PUT | `/theme` | JWT | Update theme preference |

## Response (GET /theme)

```typescript
{ theme: 'light' | 'dark', userId: string }
```

## Request (PUT /theme)

```typescript
{ theme: 'light' | 'dark' }
```

## Behavior

- Default theme is `dark` when no record exists
- User ID extracted from JWT token
- One record per user (unique constraint on `userId`)

## Acceptance Criteria

- [ ] Returns `dark` for users with no saved preference
- [ ] PUT creates record if none exists (upsert)
- [ ] Requires valid JWT (returns 401 without)
