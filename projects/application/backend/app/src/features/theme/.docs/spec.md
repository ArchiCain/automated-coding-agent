# Theme — Spec

## Purpose

Persists a per-user light/dark theme preference in PostgreSQL. Every authenticated Keycloak user has at most one `user_theme` row keyed by their JWT `sub` (as `user_id`); reads auto-create a default `dark` record on first access so callers never have to handle a missing-preference case.

## Behavior

- `GET /theme` returns the caller's current preference. If no row exists, one is created with `theme: 'dark'` and persisted before returning (`services/theme.service.ts:19-35`).
- `PUT /theme` upserts the caller's preference. When a row exists the `theme` column is overwritten; when it does not, a new row is inserted (`services/theme.service.ts:46-59`).
- Both endpoints extract the caller's user id from the JWT via `@KeycloakUser('id')`, which reads `request.user.id` as populated by the global `KeycloakJwtGuard` (`controllers/theme.controller.ts:31, 44`).
- `KeycloakJwtGuard` is applied at the class level with `@UseGuards(KeycloakJwtGuard)` in addition to the global `APP_GUARD` — missing or invalid tokens produce `401 Unauthorized` from the guard before the handler runs (`controllers/theme.controller.ts:18`).
- `PUT /theme` accepts a JSON body `{ theme: 'light' | 'dark' }`. The DTO uses `@IsEnum(['light','dark'])` but **no global `ValidationPipe` is registered** — invalid values are not rejected at the HTTP layer and are written straight to the 10-char `varchar` column (`dto/update-theme.dto.ts:3-7`, see project `overview.md` Discrepancies).
- Responses always carry both `theme` and `userId` (`services/theme.service.ts:32-35, 61-64`).
- The controller declares Swagger decorators (`@ApiTags('theme')`, `@ApiBearerAuth()`, `@ApiOperation`, `@ApiResponse`) — unique among backend controllers. `SwaggerModule.setup()` is not called in `main.ts`, so these currently have no runtime effect (`controllers/theme.controller.ts:9, 15-17, 25-30, 37-42`).
- Each handler logs an info line including the resolved `userId` and, for PUT, the incoming `theme` value (`controllers/theme.controller.ts:32, 47`).

## Endpoints

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| GET | `/theme` | JWT (cookie or Bearer) | Return the caller's theme; create default `dark` if absent |
| PUT | `/theme` | JWT (cookie or Bearer) | Upsert the caller's theme |

## Components

| Part | File | Role |
|------|------|------|
| `ThemeModule` | `theme.module.ts:8-17` | Imports `TypeOrmModule.forFeature([UserTheme])` and `KeycloakAuthModule`; registers controller + service; exports `ThemeService` |
| `ThemeController` | `controllers/theme.controller.ts:19-50` | REST surface at `/theme`; Swagger-decorated; guarded by `KeycloakJwtGuard` |
| `ThemeService` | `services/theme.service.ts:8-66` | Business logic over `Repository<UserTheme>` — `getTheme`, `updateTheme` |
| `UpdateThemeDto` | `dto/update-theme.dto.ts:3-7` | `class-validator` DTO — `@IsEnum(['light','dark'])` on `theme` |
| `GetThemeResponseDto` | `dto/get-theme.dto.ts:3-8` | Response shape `{ theme, userId }` (also decorated `@IsEnum` but only used for Swagger `type`) |
| `UserTheme` entity | `../typeorm-database-client/entities/user-theme.entity.ts:9-25` | Table `example_schema.user_theme`; columns `id` (uuid PK), `user_id` (unique), `theme` (varchar(10), default `dark`), `created_at`, `updated_at`. **Does NOT extend `BaseEntity`** — no `deleted_at` / soft-delete, no `delete()` override (contrast with `base.entity.ts:14`). |
| Migration | `../typeorm-database-client/migrations/1767287838000-AddUserTheme.ts:3-22` | Creates the `user_theme` table with the unique constraint on `user_id` |

## Acceptance Criteria

- [ ] `GET /theme` with no existing row returns `200 { theme: 'dark', userId }` and persists a new row.
- [ ] `GET /theme` with an existing row returns `200 { theme, userId }` matching the saved value.
- [ ] `PUT /theme` with body `{ theme: 'light' }` and no existing row creates a row and returns `200 { theme: 'light', userId }`.
- [ ] `PUT /theme` with body `{ theme: 'dark' }` on an existing row updates the row and returns `200 { theme: 'dark', userId }`.
- [ ] Both endpoints return `401` when no JWT is presented (enforced by `KeycloakJwtGuard`).
- [ ] The unique constraint on `user_id` is respected — no user can accumulate more than one row.
- [ ] `userId` returned in the response equals `request.user.id` extracted from the JWT.