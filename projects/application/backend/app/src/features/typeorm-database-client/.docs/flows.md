# TypeORM Database Client — Flows

## Flow 1: Bootstrap — module init -> DataSource -> migrations -> ready

1. `AppModule` imports `TypeormDatabaseClientModule.forRoot()` (`src/app.module.ts:17`). `forRoot` runs synchronously during Nest's module resolution.
2. `forRoot` reads `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USERNAME`, `DATABASE_PASSWORD`, `DATABASE_NAME`, `DATABASE_SSL`, `DATABASE_LOGGING` from `process.env` (`typeorm-database-client.module.ts:23-30`). `DATABASE_SYNC` is mentioned in the JSDoc but ignored — `synchronize = false` is a constant (`typeorm-database-client.module.ts:29`).
3. If any of the five required vars is falsy, `forRoot` throws `Error("Missing required database environment variables...")` and the Nest boot aborts (`typeorm-database-client.module.ts:33-37`).
4. `forRoot` imports `* as Entities` from `./entities` and passes `Object.values(Entities)` into the TypeORM config, so adding a named export to `entities/index.ts` is the only step needed to register a new entity (`typeorm-database-client.module.ts:5,46`).
5. `forRoot` returns a `DynamicModule` with `global: true`, `imports: [TypeOrmModule.forRoot(typeOrmConfig)]`, `controllers: [ExampleCrudController]`, `providers: [TypeormGenericCrudService]`, and `exports: [TypeOrmModule, TypeormGenericCrudService]` (`typeorm-database-client.module.ts:57-64`).
6. `TypeOrmModule.forRoot` constructs the `DataSource`, opens the Postgres connection pool, and — because `migrationsRun: true` — runs any migrations in `__dirname + "/migrations/*.{ts,js}"` not yet recorded in `typeorm_migrations`, in timestamp order (`typeorm-database-client.module.ts:52-54`).
7. Once migrations finish, Nest finishes module initialization and `main.ts` calls `app.listen(process.env.PORT)` (`src/main.ts:15-16`).

## Flow 2: Migration execution (first boot against empty DB)

1. TypeORM checks `typeorm_migrations`; table is empty.
2. `InitialSchema1734056400000.up` runs (`migrations/1734056400000-InitialSchema.ts:18-62`):
   - `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`
   - `CREATE EXTENSION IF NOT EXISTS "vector"`
   - `CREATE SCHEMA IF NOT EXISTS example_schema`
   - `CREATE TABLE example_schema.examples (id uuid PK, name varchar(255) NOT NULL, description text, metadata jsonb, created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, deleted_at timestamptz)`
   - Creates indexes on `name`, `created_at`, `updated_at`, `deleted_at`, a partial index `idx_examples_active (id) WHERE deleted_at IS NULL`, and a GIN index `idx_examples_metadata_gin` on `metadata`.
   - Adds table/column `COMMENT ON` statements for documentation.
3. `AddUserTheme1767287838000.up` runs (`migrations/1767287838000-AddUserTheme.ts:6-17`):
   - `CREATE TABLE example_schema.user_theme (id uuid PK DEFAULT uuid_generate_v4(), user_id varchar NOT NULL UNIQUE, theme varchar(10) NOT NULL DEFAULT 'dark', created_at TIMESTAMP NOT NULL DEFAULT now(), updated_at TIMESTAMP NOT NULL DEFAULT now())`.
4. Each migration is recorded in `typeorm_migrations` with its class name + timestamp.
5. On `down`, `InitialSchema` drops `example_schema.examples` + `example_schema` CASCADE but intentionally leaves extensions alone (`migrations/1734056400000-InitialSchema.ts:64-70`). `AddUserTheme.down` drops `example_schema.user_theme` (`migrations/1767287838000-AddUserTheme.ts:20-22`).

## Flow 3: `GET /examples` (happy path, demo CRUD)

1. Request hits global `KeycloakJwtGuard`; JWT must be valid (cookie or bearer) — no `@Public()` here (`app.module.ts:23-27`, `example-crud.controller.ts:24`).
2. Handler parses `limit` / `offset` / `name` query params (`example-crud.controller.ts:32-62`). Invalid `limit` or `offset` (NaN or negative) throws `BadRequestException("Invalid limit parameter")` / `"Invalid offset parameter"`.
3. Handler builds `FindManyOptions<ExampleEntity>` with `take`, `skip`, and `where: { name }` if provided.
4. Handler calls `crudService.findAll(ExampleEntity, findOptions)` → `entityManager.find(...)`. TypeORM auto-excludes rows with `deletedAt != NULL` because `@DeleteDateColumn` is declared on `BaseEntity` (`services/typeorm-generic-crud.service.ts:36-41`, `entities/base.entity.ts:43-48`).
5. Returns the array of `ExampleEntity` JSON-serialized. Non-`HttpException` errors are wrapped as `500 Internal Server Error` with body `{ statusCode: 500, message: "Failed to retrieve examples" }` (`example-crud.controller.ts:64-72`).

## Flow 4: `POST /examples` with name conflict

1. Auth as above. Body is received as `CreateExampleDto` — note there is **no global ValidationPipe**, so `class-validator` would not run even if decorators existed; the controller does manual checks (`example-crud.controller.ts:109-113`).
2. If `createData.name` is missing/empty → `BadRequestException("Name is required")`.
3. `crudService.findOne(ExampleEntity, { name })` is called. If a row exists → `BadRequestException("Example with name '...' already exists")`.
4. Otherwise `crudService.create(ExampleEntity, createData)` is called: `entityManager.create` + `entityManager.save`, which returns the persisted row with UUID `id`, `createdAt`, `updatedAt` populated by Postgres defaults / TypeORM (`services/typeorm-generic-crud.service.ts:68-74`).
5. Response: 201 Created with the new entity.

## Flow 5: `DELETE /examples/:id` (soft delete)

1. Handler validates `id`; `findById` → 404 if not found (`example-crud.controller.ts:206-219`).
2. `crudService.deleteById(ExampleEntity, id)` → `entityManager.softDelete(...)`, which issues `UPDATE ... SET deleted_at = NOW() WHERE id = $1` (`services/typeorm-generic-crud.service.ts:103-108`).
3. Response body: `{ message: "Example with ID <id> has been soft deleted" }` (200).
4. Subsequent `GET /examples/:id` returns 404 because the default TypeORM filter hides soft-deleted rows.

## Flow 6: `POST /examples/:id/restore`

1. Handler calls `crudService.isSoftDeleted(EntityClass, id)` which queries with `withDeleted: true` and checks `deletedAt !== null` (`services/typeorm-generic-crud.service.ts:290-299`).
2. If the row is not deleted (or does not exist) → `BadRequestException("Example with ID ... is not deleted or does not exist")`.
3. Otherwise `crudService.restore(EntityClass, id)` → `entityManager.restore(...)` clears `deletedAt`.
4. Response: `{ message: "Example with ID <id> has been restored" }`.

## Flow 7: Hard-delete attempt is blocked

1. Any caller invoking `TypeormGenericCrudService.hardDeleteById` or `.hardDelete` throws `Error("Hard deletes are not allowed...")` before touching the DB (`services/typeorm-generic-crud.service.ts:125-145`).
2. Any caller invoking `.remove()` on a `BaseEntity` instance or the static `EntityClass.delete()` throws the same family of errors (`entities/base.entity.ts:54-68`).
3. Soft-delete alternatives (`deleteById`, `softDelete`, `delete` by criteria) are the only supported paths.
