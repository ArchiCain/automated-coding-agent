# Theme — Test Plan

Existing unit coverage: `controllers/theme.controller.spec.ts` (controller delegates to service with mocked guard) and `services/theme.service.spec.ts` (service over a mocked repository).

## Contract Tests — `GET /theme`

- [ ] Returns `200` with `{ theme: 'light' | 'dark'; userId: string }` shape (`services/theme.service.ts:32-35`).
- [ ] `userId` in response matches `request.user.id` from the JWT (`controllers/theme.controller.ts:31`).
- [ ] Returns `401 Unauthorized` when no `access_token` cookie and no `Authorization: Bearer` header are provided.
- [ ] `Content-Type: application/json` on success.

## Contract Tests — `PUT /theme`

- [ ] Returns `200` with `{ theme, userId }` matching the requested theme when body is `{ theme: 'light' }` or `{ theme: 'dark' }`.
- [ ] Returns `401 Unauthorized` when the JWT is missing.
- [ ] **Known gap:** invalid body (`{ theme: 'purple' }`, `{ theme: null }`, `{}`) is NOT rejected with `400` because no `ValidationPipe` is registered globally — value is persisted as-is up to 10 chars. Test should assert current behavior and be flipped to a `400` assertion once validation is enabled (`dto/update-theme.dto.ts:3-7`, project `overview.md`).

## Behavior Tests

- [ ] `GET /theme` for a user with no existing row creates a `user_theme` row with `theme='dark'` and returns it (`services/theme.service.ts:23-29`).
- [ ] `GET /theme` for a user with an existing row returns the saved value without modifying it (`services/theme.service.ts:19-22, 32-35`).
- [ ] `PUT /theme` with a new user inserts a row with the requested theme (`services/theme.service.ts:50-54`).
- [ ] `PUT /theme` with an existing row updates the row's `theme` in place (`services/theme.service.ts:55-57`) and refreshes `updated_at` (handled by TypeORM `@UpdateDateColumn`).
- [ ] Unique constraint on `user_id` is enforced — concurrent first-time GET/PUT for the same user must not produce two rows (DB-level `UQ_user_theme_user_id`, migration line 14).
- [ ] Response `userId` equals the JWT `sub` passed to `ThemeService` (`controllers/theme.controller.ts:31, 44`).

## E2E Scenarios

- [ ] **Default-on-first-read:** authenticate as a fresh user, `GET /theme` -> `{ theme: 'dark', userId }`; re-`GET` returns the same row (no duplicate insert).
- [ ] **Round-trip:** `PUT /theme { theme: 'light' }` -> `GET /theme` returns `{ theme: 'light', userId }`; `PUT /theme { theme: 'dark' }` -> `GET /theme` returns `{ theme: 'dark', userId }`.
- [ ] **Auth boundary:** request without JWT -> `401`; request with expired/invalid JWT -> `401` (from `KeycloakJwtGuard`).
- [ ] **Isolation:** two different users maintain independent theme rows — updating user A's theme does not affect user B.

## Constraints / Notes

- One row per user enforced at DB layer (`UNIQUE` on `user_id`).
- Default theme is `dark` both at the application layer (`services/theme.service.ts:27`) and at the DB column default (`user-theme.entity.ts:17`).
- `UserTheme` does not support soft delete — unlike `BaseEntity`-derived entities, `repository.delete()` will hard-delete. Relevant only if a future admin path removes theme rows.