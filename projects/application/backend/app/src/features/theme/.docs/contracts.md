# Theme — Contracts

Base path: `/theme` (`controllers/theme.controller.ts:17`). All endpoints require JWT (via `access_token` cookie or `Authorization: Bearer <jwt>`) — enforced by the global `KeycloakJwtGuard` and re-asserted by `@UseGuards(KeycloakJwtGuard)` on the controller class (`controllers/theme.controller.ts:18`). The controller declares Swagger decorators (`@ApiTags('theme')`, `@ApiBearerAuth()`) but no Swagger UI is mounted in `main.ts`.

## Endpoints

### `GET /theme`

**Auth:** JWT required.
**Request:** No body, no query params. User id is read from the JWT (`controllers/theme.controller.ts:31`).
**Response 200:**
```typescript
{
  theme: 'light' | 'dark';
  userId: string;
}
```
Source: `services/theme.service.ts:32-35` and `dto/get-theme.dto.ts:3-8`.
**Side effect:** If no `user_theme` row exists for the caller, one is inserted with `theme: 'dark'` before the response is sent (`services/theme.service.ts:23-29`).
**Errors:**
- `401 Unauthorized` — missing/invalid JWT (`keycloak-jwt.guard.ts:46-57`).

### `PUT /theme`

**Auth:** JWT required.
**Request:**
```typescript
{
  theme: 'light' | 'dark';
}
```
Source: `dto/update-theme.dto.ts:3-7`. `@IsEnum(['light','dark'])` is declared but not enforced at runtime — there is no global `ValidationPipe` (see project `overview.md`). Invalid values are persisted as-is up to 10 characters (`user-theme.entity.ts:17`).
**Response 200:**
```typescript
{
  theme: 'light' | 'dark';
  userId: string;
}
```
Source: `services/theme.service.ts:61-64`.
**Semantics:** Upsert. Creates a row if none exists for the caller; otherwise overwrites the `theme` column (`services/theme.service.ts:46-59`).
**Errors:**
- `401 Unauthorized` — missing/invalid JWT.

## Shared Types

```typescript
// Request body for PUT /theme
interface UpdateThemeRequest {
  theme: 'light' | 'dark';
}

// Response body for both GET /theme and PUT /theme
interface ThemeResponse {
  theme: 'light' | 'dark';
  userId: string;
}
```

## Persistence Model

`UserTheme` entity (`../typeorm-database-client/entities/user-theme.entity.ts:9-25`) — table `example_schema.user_theme`:

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | `@PrimaryGeneratedColumn('uuid')` |
| `user_id` | `varchar`, UNIQUE | Keycloak `sub` from the JWT |
| `theme` | `varchar(10)`, default `dark` | No DB-level CHECK constraint |
| `created_at` | `TIMESTAMP`, default `now()` | `@CreateDateColumn` |
| `updated_at` | `TIMESTAMP`, default `now()` | `@UpdateDateColumn` |

`UserTheme` does NOT extend `BaseEntity` — it has no `deleted_at` column, no soft-delete override, and its timestamp columns are plain `TIMESTAMP` (not `timestamp with time zone`) unlike other entities in this codebase (`base.entity.ts:14-48`).

Migration: `../typeorm-database-client/migrations/1767287838000-AddUserTheme.ts:3-22`.