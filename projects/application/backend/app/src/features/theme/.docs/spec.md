# Theme — Spec

## What it is

A small backend surface that remembers whether each signed-in user prefers the light or dark theme. Every user gets one saved preference; on first read the server gives back a sensible default ("dark") and remembers it for next time.

## How it behaves

### Getting my theme

When a signed-in user asks for their theme, the server looks up their saved preference and returns it along with their user id. If the user has never had a preference stored, the server creates one set to "dark", saves it, and returns that.

### Changing my theme

When a signed-in user sends a new theme ("light" or "dark"), the server saves it against their account and returns the new value with their user id. If the user had no prior preference, a new one is created; otherwise the existing one is overwritten.

### First-time users

A user who has never touched the theme endpoints still has no row in the database. The first call — either reading or writing — creates their row. After that, every following call updates or returns that same row.

### Who the caller is

Both endpoints require a signed-in user. Requests without a valid token are rejected with `401 Unauthorized` before any handler runs. The user id returned in the response is the one taken from the caller's token, so a user can only read and write their own preference.

### Logging

Every read and write writes an info-level log line including the resolved user id. Writes also log the incoming theme value.

## Acceptance criteria

- Reading the theme when none is saved returns `{ theme: 'dark', userId }` and stores that row for next time.
- Reading the theme when one is saved returns `{ theme, userId }` matching what was saved.
- Writing `{ theme: 'light' }` for a user with no prior row creates the row and returns `{ theme: 'light', userId }`.
- Writing `{ theme: 'dark' }` for a user with an existing row overwrites it and returns `{ theme: 'dark', userId }`.
- Both endpoints return `401` when no valid token is presented.
- A user can never have more than one saved preference.
- The `userId` in every response equals the caller's id taken from their token.

## Known gaps

- The `user_theme` table row does not extend the shared base row used elsewhere in the app, so it has no soft-delete column and no soft-delete behavior (`../typeorm-database-client/entities/user-theme.entity.ts:9-25`, contrast `../typeorm-database-client/entities/base.entity.ts:14`).
- The controller is decorated for Swagger docs, but `SwaggerModule.setup()` is never called at boot, so these annotations currently produce no runtime docs page (`src/main.ts`, `controllers/theme.controller.ts:9,15-17,25-30,37-42`).
- The write endpoint declares that `theme` must be `'light'` or `'dark'`, but the app does not register a global validation step, so invalid values are not rejected at the HTTP layer and are written straight to the 10-char column (`dto/update-theme.dto.ts:3-7`).

## Code map

Paths relative to `projects/application/backend/app/`.

| Concern | File · lines |
|---|---|
| Module wiring (TypeORM feature + Keycloak auth, exports `ThemeService`) | `src/features/theme/theme.module.ts:8-17` |
| REST surface at `/theme`, class-level `@UseGuards(KeycloakJwtGuard)` | `src/features/theme/controllers/theme.controller.ts:18-50` |
| `GET /theme` handler — extracts id via `@KeycloakUser('id')`, logs, delegates to service | `src/features/theme/controllers/theme.controller.ts:25-34` |
| `PUT /theme` handler — extracts id, logs id + body, delegates to service | `src/features/theme/controllers/theme.controller.ts:37-49` |
| Swagger decorators (`@ApiTags`, `@ApiBearerAuth`, `@ApiOperation`, `@ApiResponse`) — inert without `SwaggerModule.setup()` | `src/features/theme/controllers/theme.controller.ts:9,15-17,25-30,37-42` |
| `getTheme` — find by `user_id`, create-and-save default `'dark'` if missing, return `{ theme, userId }` | `src/features/theme/services/theme.service.ts:19-35` |
| `updateTheme` — upsert by `user_id`, overwrite `theme` column if row exists, return `{ theme, userId }` | `src/features/theme/services/theme.service.ts:46-64` |
| Write DTO — `@IsEnum(['light','dark'])` on `theme` (not enforced at runtime; no global `ValidationPipe`) | `src/features/theme/dto/update-theme.dto.ts:3-7` |
| Response DTO `{ theme, userId }` (Swagger-typed only) | `src/features/theme/dto/get-theme.dto.ts:3-8` |
| `UserTheme` entity — table `example_schema.user_theme`, columns `id` (uuid PK), `user_id` (unique), `theme` (varchar(10), default `dark`), `created_at`, `updated_at`; does **not** extend `BaseEntity` | `src/features/typeorm-database-client/entities/user-theme.entity.ts:9-25` |
| Shared `BaseEntity` (for contrast — includes `deleted_at` / soft-delete) | `src/features/typeorm-database-client/entities/base.entity.ts:14` |
| Migration creating `user_theme` with unique `user_id` | `src/features/typeorm-database-client/migrations/1767287838000-AddUserTheme.ts:3-22` |
| JWT guard that populates `request.user.id` (also global via `APP_GUARD`) | `src/features/keycloak-auth/` (`KeycloakJwtGuard`) |
| `@KeycloakUser('id')` param decorator used by the controller | `src/features/keycloak-auth/` |
