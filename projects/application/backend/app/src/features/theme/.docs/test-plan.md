# Theme — Test Plan

## Get Theme (`GET /theme`)

- [ ] Requires valid JWT (returns 401 without)
- [ ] Returns `{ theme: 'dark', userId }` for user with no saved preference (creates default)
- [ ] Returns saved preference for user with existing record
- [ ] User ID extracted from JWT token via `@KeycloakUser('id')`

## Update Theme (`PUT /theme`)

- [ ] Requires valid JWT (returns 401 without)
- [ ] Creates new record if none exists (upsert behavior)
- [ ] Updates existing record if one exists
- [ ] Validates `theme` field is `'light'` or `'dark'` (returns 400 on invalid)
- [ ] Returns updated `{ theme, userId }`

## Constraints

- [ ] One record per user (unique constraint on userId)
- [ ] Default theme is `dark` when no record exists
