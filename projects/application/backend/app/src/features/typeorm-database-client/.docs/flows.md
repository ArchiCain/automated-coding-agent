# TypeORM Database Client — Flows

## Flow 1: Database Connection Setup (App Startup)

1. `TypeormDatabaseClientModule.forRoot()` is called during NestJS module registration
2. Module reads env vars: DATABASE_HOST, DATABASE_PORT, DATABASE_USERNAME, DATABASE_PASSWORD, DATABASE_NAME
3. If any required var is missing, throws descriptive error immediately
4. Module builds TypeORM config with `type: 'postgres'`, entities from `./entities`, migrations from `./migrations/`
5. `migrationsRun: true` ensures pending migrations execute on connect
6. TypeORM establishes connection to PostgreSQL
7. Module is registered as `global: true` — available to all other modules without importing
8. `TypeormGenericCrudService` and `TypeOrmModule` are exported for dependency injection

## Flow 2: Migration Execution

1. TypeORM connects to the database
2. TypeORM checks `typeorm_migrations` table for already-run migrations
3. Pending migrations execute in timestamp order:
   - `1734056400000-InitialSchema`: Creates `example_schema`, enables `uuid-ossp` and `vector` extensions, creates `examples` table
   - `1767287838000-AddUserTheme`: Creates `user_theme` table with userId unique constraint
4. Each successful migration is recorded in `typeorm_migrations` table
5. Application continues bootstrapping

## Flow 3: Entity Creation (Generic CRUD)

1. Caller injects `TypeormGenericCrudService`
2. Caller calls `create(EntityClass, { name: 'Test', ... })`
3. Service creates entity instance via `entityManager.create(EntityClass, data)`
4. TypeORM auto-generates UUID for `id` field (from BaseEntity)
5. TypeORM sets `createdAt` and `updatedAt` timestamps
6. Service saves entity via `entityManager.save(entity)`
7. Returns the saved entity with generated fields

## Flow 4: Soft Delete

1. Caller calls `deleteById(EntityClass, id)`
2. Service calls `entityManager.softDelete(EntityClass, id)`
3. TypeORM sets `deletedAt` to current timestamp (does NOT remove row)
4. Subsequent `findAll`/`findOne` calls automatically exclude this entity (TypeORM global filter)
5. Entity can be restored via `restore(EntityClass, id)` which clears `deletedAt`

## Flow 5: Hard Delete Prevention

1. Caller calls `hardDeleteById(EntityClass, id)` or `hardDelete(EntityClass, criteria)`
2. Service immediately throws: "Hard deletes are not allowed in this application"
3. No database operation is performed
4. Alternatively, calling `.remove()` on a BaseEntity instance also throws

## Flow 6: Upsert

1. Caller calls `upsert(EntityClass, criteria, data)`
2. Service queries for existing entity matching criteria
3. If entity exists: updates it by ID, returns updated entity
4. If entity does not exist: creates new entity merging criteria + data, saves and returns it
