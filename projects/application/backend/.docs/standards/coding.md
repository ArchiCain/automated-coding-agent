# Backend Coding Standards

Derived from the actual layout under `app/src/`. NestJS 11, TypeScript, CommonJS module output (`app/tsconfig.json:3`).

## Directory Layout

```
app/
├── src/
│   ├── main.ts                         # Bootstrap: cookie-parser, CORS, app.listen
│   ├── app.module.ts                   # Wires feature modules + global APP_GUARD
│   └── features/
│       ├── cors/                       # @Global() — exports CorsService
│       ├── health/                     # @Public() controller
│       ├── keycloak-auth/              # Guards, decorators, permissions
│       ├── theme/                      # Controller/service/DTO/entity-via-import
│       ├── typeorm-database-client/    # forRoot() dynamic module + entities + migrations
│       └── user-management/            # Keycloak Admin API wrapper
└── test/                               # Integration tests (separate jest config)
```

Every feature follows this shape (see `src/features/keycloak-auth/` for the fullest example):

```
features/{name}/
├── {name}.module.ts        # @Module — one per feature
├── index.ts                # Barrel export — everything external consumers import
├── controllers/            # @Controller classes + *.spec.ts
├── services/               # @Injectable services + *.spec.ts
├── guards/                 # (auth feature only)
├── decorators/             # (auth feature only)
├── dto/                    # class-validator DTOs (theme) or .types.ts (user-management)
├── entities/               # TypeORM entities (typeorm-database-client only)
├── migrations/             # TypeORM migrations (typeorm-database-client only)
└── README.md               # Feature-specific docs (several exist)
```

## Naming Conventions

Observed across the codebase:

| Thing | Pattern | Example |
|-------|---------|---------|
| Files | kebab-case | `keycloak-auth.service.ts`, `user-theme.entity.ts` |
| Classes | PascalCase | `KeycloakAuthService`, `UserManagementController` |
| Methods | camelCase | `validateToken`, `getAdminAccessToken` |
| Decorators | PascalCase starting with verb | `@Public()`, `@RequirePermission()`, `@KeycloakUser()` |
| Constants | UPPER_SNAKE_CASE | `PERMISSIONS`, `REQUIRE_PERMISSION_KEY`, `IS_PUBLIC_KEY` |
| Metadata keys | camelCase string | `"isPublic"`, `"requirePermission"` |
| Module base routes | kebab/singular noun | `@Controller('auth')`, `@Controller('users')`, `@Controller('theme')` |
| Entities | singular PascalCase, table name snake_case with explicit `schema` | `UserTheme` → `user_theme` in `example_schema` (`user-theme.entity.ts:9`) |

## Module Patterns

- **Standard module:** static `@Module({ imports, controllers, providers, exports })` — see `theme.module.ts`, `user-management.module.ts`.
- **Global module:** `@Global()` decorator — `CorsModule` (`cors/cors.module.ts:4`).
- **Dynamic module:** `static forRoot(): DynamicModule` reads env vars, constructs config, returns `{ module, global, imports, controllers, providers, exports }` — `TypeormDatabaseClientModule.forRoot()` (`typeorm-database-client.module.ts:22`).
- **Barrel exports:** Every feature has `index.ts` that re-exports the module and any public types/services/decorators. Cross-feature imports go through these barrels (e.g. `from '../keycloak-auth'`).

## Auth Patterns

- **Global JWT guard:** `KeycloakJwtGuard` registered via `APP_GUARD` in `app.module.ts:23-28`. Applies to every route by default. Reads `access_token` cookie first, then `Authorization: Bearer` header (`keycloak-jwt.guard.ts:46-57`).
- **Opt-out:** `@Public()` decorator (`public.decorator.ts:5`) sets metadata key `"isPublic"` which the guard checks via `Reflector.getAllAndOverride`. Applied at class level on `HealthController` and method level on `/auth/login`.
- **User accessor:** `@KeycloakUser()` param decorator pulls `request.user` (set by the guard). Can return a single field: `@KeycloakUser('id') userId: string` (`theme.controller.ts:31`).
- **Permission metadata:** `@RequirePermission('users:read')` or `@RequirePermission(['a','b'], { requireAll: true })` — sets metadata key `"requirePermission"` (`require-permission.decorator.ts:12`). Enforcement requires `PermissionGuard` to be attached; see `keycloak-auth/README.md:91` for the canonical `@UseGuards(KeycloakJwtGuard, PermissionGuard)` pattern.

## Cookie Conventions

Defined once in `keycloak-auth.controller.ts:21-29`:

```ts
{ httpOnly: true, secure: NODE_ENV === 'production', sameSite: prod ? 'strict' : 'lax', path: '/' }
```

- `access_token` cookie — `maxAge = expiresIn * 1000` (from Keycloak response).
- `refresh_token` cookie — `maxAge = 30 days`.
- Both cleared on logout and on failed refresh.

## Database Patterns

- **BaseEntity with soft delete:** All entities should extend `BaseEntity` (`typeorm-database-client/entities/base.entity.ts:14`) which adds UUID `id`, `createdAt`, `updatedAt`, `deletedAt`, and **overrides `remove()` / static `delete()` to throw** — forces `softRemove()` / `softDelete()`. (Note: `UserTheme` does NOT extend BaseEntity — see Discrepancies in overview.)
- **Schema:** Entities declare schema explicitly, e.g. `@Entity('user_theme', { schema: 'example_schema' })`.
- **Repository injection:** `@InjectRepository(UserTheme) private readonly userThemeRepository: Repository<UserTheme>` inside `@Injectable()` services (`theme.service.ts:12`).
- **Migrations:** Auto-run on boot (`migrationsRun: true`). Generated via `task backend:local:migration:generate -- Name`.

## DTO and Validation Patterns

Two coexisting styles — pick one per feature:

- **class-validator DTOs** (theme): `class UpdateThemeDto { @IsEnum(['light','dark']) theme }` (`theme/dto/update-theme.dto.ts:3`). Swagger decorators (`@ApiOperation`, `@ApiResponse`) only used on `ThemeController`.
- **Plain TypeScript interfaces** (user-management): `interface CreateUserDto { email: string; ... }` in a `.types.ts` file (`user-management.types.ts:21`).

There is **no global `ValidationPipe`** registered in `main.ts`, so `class-validator` decorators currently don't enforce — services do their own checks (e.g. `example-crud.controller.ts:43-55`).

## Error Handling

- Throw NestJS built-in exceptions: `UnauthorizedException`, `ForbiddenException`, `NotFoundException`, `BadRequestException`, `InternalServerErrorException` — NestJS's default exception filter translates them to HTTP.
- Catch-and-rethrow in services: check `instanceof HttpException` and re-throw (`example-crud.controller.ts:65-72`, `user-management.service.ts:167-172`) so inner errors aren't double-wrapped.
- Every service/controller declares `private readonly logger = new Logger(ClassName.name)` and logs on error paths at `.error()` / `.warn()`.

## Configuration Access

- `ConfigModule.forRoot({ isGlobal: true })` in `app.module.ts:13`.
- Services inject `ConfigService` and call `configService.get<string>('KEY') || 'default'` (`keycloak-auth.service.ts:15-18`).
- Non-DI modules (bootstrap, dynamic `forRoot`) access `process.env.*` directly (`main.ts:15`, `typeorm-database-client.module.ts:23-30`).

## Testing

Two jest configs:

| Config | Root | Pattern | Notes |
|--------|------|---------|-------|
| `app/jest.config.js` | `src/` | `*.spec.ts` | Unit tests, colocated next to source. `ts-jest`, `transformIgnorePatterns` allows `jose` (ESM) through. |
| `app/jest.integration.config.js` | `test/` | `*.integration.spec.ts` | 60s timeout, `setup.ts` setupFileAfterEach, `forceExit: true`. Requires backend stack running — see `task backend:local:test:integration`. |

E2E config exists at `test/jest-e2e.json` (referenced from `package.json:22`).

## Linting and Formatting

- ESLint flat config (`eslint.config.mjs`): `@eslint/js` recommended + `typescript-eslint` recommended + `eslint-plugin-prettier`. Relaxed: `no-explicit-any`, `explicit-function-return-type`, `interface-name-prefix` are all off.
- Prettier runs via `npm run format`. TypeScript compiler has `strictNullChecks: false`, `noImplicitAny: false` (`tsconfig.json:15-17`) — strictness is intentionally loose.

## Cross-Feature Imports

Go through barrels, not deep paths:

```ts
// Good — used in app.module.ts and theme.module.ts
import { KeycloakAuthModule, KeycloakJwtGuard } from './features/keycloak-auth';

// Also seen — deep import for specific guard/decorator
import { KeycloakJwtGuard } from '../../keycloak-auth/guards/keycloak-jwt.guard';
import { KeycloakUser } from '../../keycloak-auth/decorators/keycloak-user.decorator';
```

Both patterns coexist in `theme.controller.ts:12-13`. Prefer barrel imports for new code.
