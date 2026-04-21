# TypeORM Database Client — Test Plan

## Module Initialization

- [ ] Nest bootstrap fails with `Error("Missing required database environment variables...")` when any of `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USERNAME`, `DATABASE_PASSWORD`, `DATABASE_NAME` is unset (`typeorm-database-client.module.ts:33-37`).
- [ ] `synchronize` is always `false`, regardless of `DATABASE_SYNC` (the env var is unread) (`typeorm-database-client.module.ts:29`).
- [ ] `DATABASE_SSL=true` opens a TLS connection with `rejectUnauthorized: false`.
- [ ] `DATABASE_LOGGING=true` enables TypeORM query logs.
- [ ] `TypeormGenericCrudService` and `TypeOrmModule` are injectable in any other module without a local import (global registration).
- [ ] Pending migrations auto-run on startup and are recorded in `typeorm_migrations`.

## Migrations (against an empty DB)

- [ ] `InitialSchema1734056400000` creates extensions `uuid-ossp` + `vector`, schema `example_schema`, table `example_schema.examples`, and all five indexes + the GIN index.
- [ ] `AddUserTheme1767287838000` creates `example_schema.user_theme` with unique `user_id` and `theme` default `'dark'`.
- [ ] Re-running the app with a populated `typeorm_migrations` table does not re-apply migrations.
- [ ] `InitialSchema.down` drops `example_schema.examples` + `example_schema` but leaves the Postgres extensions in place (`migrations/1734056400000-InitialSchema.ts:64-70`).

## BaseEntity

- [ ] An entity extending `BaseEntity` receives a UUID `id` on insert.
- [ ] `createdAt` is set on insert and is timezone-aware.
- [ ] `updatedAt` is bumped on subsequent saves.
- [ ] `deletedAt` is set by `softDelete` / `softRemove`.
- [ ] Calling `instance.remove()` throws `"Hard deletes are not allowed..."` (`entities/base.entity.ts:54-58`).
- [ ] Calling static `EntityClass.delete()` throws `"Hard deletes are not allowed..."` (`entities/base.entity.ts:64-68`).
- [ ] `isDeleted` getter returns `true` when `deletedAt` is set, `false` otherwise.
- [ ] `deletionDate` getter returns `deletedAt` or `null`.

## TypeormGenericCrudService

- [ ] `findAll` returns active rows only (soft-deleted excluded).
- [ ] `findById` / `findOne` return `null` when no match.
- [ ] `create` persists and returns the row with generated `id`/timestamps.
- [ ] `update` applies the patch and returns the re-fetched row.
- [ ] `updateByCriteria` updates every matching row.
- [ ] `upsert` creates when no match exists, otherwise updates by `id` and returns the updated row.
- [ ] `count` excludes soft-deleted rows.
- [ ] `exists` returns `true`/`false` based on `count`.
- [ ] `deleteById` / `delete` / `softDelete` / `softDeleteByCriteria` all perform soft deletes (`deletedAt` set).
- [ ] `hardDeleteById` throws `"Hard deletes are not allowed..."` (`services/typeorm-generic-crud.service.ts:125-132`).
- [ ] `hardDelete` throws `"Hard deletes are not allowed..."` (`services/typeorm-generic-crud.service.ts:138-145`).
- [ ] `restore` / `restoreByCriteria` clear `deletedAt`.
- [ ] `findAllWithDeleted` returns both active and soft-deleted rows.
- [ ] `findDeleted` returns only soft-deleted rows. (Note: implementation uses `{ deletedAt: { $ne: null } }` which is a Mongo operator; behavior against the Postgres driver should be verified — see Discrepancies.)
- [ ] `isSoftDeleted` returns `true` when `deletedAt` is set, else `false`.
- [ ] `transaction` runs its callback inside a DB transaction and rolls back on throw.

## /examples Contract Tests (behind global JWT guard)

- [ ] `GET /examples` without a valid JWT → `401`.
- [ ] `GET /examples` with JWT → `200` + `Example[]`.
- [ ] `GET /examples?limit=invalid` → `400 "Invalid limit parameter"`.
- [ ] `GET /examples?offset=-1` → `400 "Invalid offset parameter"`.
- [ ] `GET /examples?name=Foo` → returns only rows with `name === "Foo"`.
- [ ] `GET /examples/:id` for missing row → `404 "Example with ID <id> not found"`.
- [ ] `POST /examples` with empty body → `400 "Name is required"`.
- [ ] `POST /examples` with duplicate `name` → `400 "Example with name '<name>' already exists"`.
- [ ] `POST /examples` with new `name` → `201` + full `Example`.
- [ ] `PUT /examples/:id` on missing row → `404`.
- [ ] `PUT /examples/:id` renaming to an existing other row's name → `400`.
- [ ] `DELETE /examples/:id` → `200 { message: "Example with ID <id> has been soft deleted" }`, then `GET /examples/:id` → `404`.
- [ ] `GET /examples/meta/count` → `{ count: number }` excluding soft-deleted rows.
- [ ] `POST /examples/:id/restore` on an active row → `400 "Example with ID <id> is not deleted or does not exist"`.
- [ ] `POST /examples/:id/restore` on a soft-deleted row → `200 { message: "Example with ID <id> has been restored" }`, row reappears in `GET /examples`.

## E2E Scenarios

- [ ] **Create → read → update → soft delete → restore** round-trip against a running backend + Postgres sandbox.
- [ ] **Boot without Postgres reachable** → Nest bootstrap errors, container exits non-zero.
- [ ] **Boot with missing env var** → Nest bootstrap throws `Missing required database environment variables`.
