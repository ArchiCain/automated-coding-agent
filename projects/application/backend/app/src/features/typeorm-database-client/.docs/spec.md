# TypeORM Database Client — Spec

## Purpose

Establishes the backend's PostgreSQL connection via TypeORM and exports the primitives every other feature uses to persist data: a global `TypeOrmModule`, a `BaseEntity` class that enforces soft-delete, a generic CRUD service, and the repo's migration runner. Also ships a demo `/examples` REST surface as a reference CRUD implementation — not part of product functionality.

## Behavior

- On module registration, `TypeormDatabaseClientModule.forRoot()` reads `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USERNAME`, `DATABASE_PASSWORD`, `DATABASE_NAME` directly from `process.env`; throws a descriptive `Error` if any is missing (`typeorm-database-client.module.ts:23-37`).
- `DATABASE_SSL=true` enables `{ rejectUnauthorized: false }` SSL; any other value disables SSL (`typeorm-database-client.module.ts:28,48`).
- `DATABASE_LOGGING=true` enables TypeORM query logging (`typeorm-database-client.module.ts:30,49`).
- **`DATABASE_SYNC` is documented in the JSDoc (`typeorm-database-client.module.ts:19`) but NOT read** — `synchronize` is hardcoded to `false` (`typeorm-database-client.module.ts:29`). See Discrepancies.
- Entities are discovered by enumerating the `./entities` barrel: `Object.values(Entities) as Function[]` (`typeorm-database-client.module.ts:46`, `entities/index.ts:1-2`). Currently `ExampleEntity` and `UserTheme`.
- Migrations are loaded from `__dirname + "/migrations/*.{ts,js}"` and auto-run on startup (`migrationsRun: true`); run state is tracked in table `typeorm_migrations` (`typeorm-database-client.module.ts:52-54`).
- The module is registered `global: true`, so `TypeOrmModule` and `TypeormGenericCrudService` are injectable everywhere without re-importing (`typeorm-database-client.module.ts:59,63`).
- The module registers `ExampleCrudController`, mounting the demo `/examples` routes on the main HTTP server (`typeorm-database-client.module.ts:61`, `example-crud.controller.ts:24`). The controller carries no `@Public()`, so the global `KeycloakJwtGuard` requires a valid JWT for every route (`app.module.ts:23-27`).
- `BaseEntity` (abstract) provides: UUID `id` (`@PrimaryGeneratedColumn("uuid")`), `createdAt`/`updatedAt`/`deletedAt` as `timestamp with time zone` (snake_case column names), `isDeleted` and `deletionDate` getters, and overrides of `remove()` (instance) and static `delete()` to throw "Hard deletes are not allowed" (`entities/base.entity.ts:14-83`).
- `ExampleEntity` extends `BaseEntity` and declares `@Entity("examples", { schema: "example_schema" })` with columns `name varchar(255)`, `description text nullable`, `metadata jsonb nullable` (`entities/example.entity.ts:9-19`).
- `UserTheme` **does not extend `BaseEntity`** — it defines its own `id`, `createdAt`, `updatedAt` and has no `deletedAt` (`entities/user-theme.entity.ts:10-25`). It lives in the same schema (`example_schema.user_theme`) with a unique `user_id` and `theme` default `'dark'`.
- `TypeormGenericCrudService` exposes entity-agnostic CRUD via `EntityManager` injection: `findAll`, `findOne`, `findById`, `create`, `update`, `updateByCriteria`, `upsert`, `count`, `exists`, `deleteById`, `delete`, `softDelete`/`softDeleteByCriteria`, `restore`/`restoreByCriteria`, `findAllWithDeleted`, `findDeleted`, `isSoftDeleted`, `query`, `transaction`, plus `getRepository`/`getEntityManager` escape hatches (`services/typeorm-generic-crud.service.ts:17-300`).
- All delete methods on the service perform soft deletes; `hardDeleteById` / `hardDelete` exist as stubs that throw immediately (`services/typeorm-generic-crud.service.ts:125-145`).
- `data-source.ts` provides a standalone `AppDataSource` for the TypeORM CLI (`migration:generate`, `migration:run`, etc.) — same env-var validation, `synchronize: false`, migrations globbed from `src/features/typeorm-database-client/migrations/*.ts` (`data-source.ts:11-42`).

## Components / Endpoints / Services

| Item | Type | Source |
|---|---|---|
| `TypeormDatabaseClientModule` | Dynamic, global NestJS module (`forRoot()`) | `typeorm-database-client.module.ts:8-66` |
| `TypeormGenericCrudService` | Entity-agnostic CRUD provider, exported | `services/typeorm-generic-crud.service.ts:17` |
| `BaseEntity` | Abstract TypeORM base class (UUID + timestamps + soft-delete guard) | `entities/base.entity.ts:14` |
| `ExampleEntity` | Reference entity (extends `BaseEntity`) | `entities/example.entity.ts:10` |
| `UserTheme` | Entity, standalone (no `BaseEntity`) — owned by `theme` feature but declared here | `entities/user-theme.entity.ts:10` |
| `ExampleCrudController` | Demo `/examples` REST controller (7 routes) | `controllers/example-crud.controller.ts:25` |
| `AppDataSource` | Standalone TypeORM CLI DataSource | `data-source.ts:22` |
| `InitialSchema1734056400000` | Migration — creates `uuid-ossp`/`vector` extensions, `example_schema`, `examples` table + indexes | `migrations/1734056400000-InitialSchema.ts:15` |
| `AddUserTheme1767287838000` | Migration — creates `example_schema.user_theme` table | `migrations/1767287838000-AddUserTheme.ts:3` |
| `typeorm_migrations` | TypeORM's migration tracking table | `typeorm-database-client.module.ts:54` |

## Acceptance Criteria

- [ ] App fails to boot with a descriptive error when any of the five required `DATABASE_*` vars is unset.
- [ ] `synchronize` is `false` regardless of `DATABASE_SYNC` — schema changes come only from migrations.
- [ ] On first boot against an empty DB, both migrations run in order and are recorded in `typeorm_migrations`.
- [ ] Extensions `uuid-ossp` and `vector` exist after initial migration.
- [ ] Schema `example_schema` contains tables `examples` and `user_theme`.
- [ ] An entity extending `BaseEntity` receives a UUID `id`, `createdAt`, and `updatedAt` automatically on insert.
- [ ] Calling `.remove()` on a `BaseEntity` instance or `EntityClass.delete()` throws.
- [ ] `TypeormGenericCrudService.deleteById` sets `deletedAt` and the row is hidden from subsequent `findAll`/`findById` (soft delete).
- [ ] `hardDeleteById` / `hardDelete` throw without touching the database.
- [ ] `restore` clears `deletedAt` so the row becomes visible again.
- [ ] `/examples` routes require a valid Keycloak JWT (global guard), and return the shapes in `contracts.md`.
- [ ] `TypeormGenericCrudService` and `TypeOrmModule` are available in any other module without an explicit import (global registration).
