# TypeORM Database Client — Test Plan

## Module Initialization

- [ ] Migrations run automatically on startup (`migrationsRun: true`)
- [ ] Throws error if required env vars missing (DATABASE_HOST, PORT, USERNAME, PASSWORD, NAME)
- [ ] Connects with SSL when `DATABASE_SSL=true`
- [ ] Enables query logging when `DATABASE_LOGGING=true`
- [ ] Schema synchronization is always disabled

## Base Entity

- [ ] UUID primary keys generated automatically
- [ ] `createdAt` set on insert
- [ ] `updatedAt` updated on every save
- [ ] `deletedAt` set by soft delete operations
- [ ] `remove()` throws error preventing hard deletes
- [ ] Static `delete()` throws error preventing hard deletes
- [ ] `isDeleted` getter returns true when `deletedAt` is not null
- [ ] `deletionDate` getter returns the deletion timestamp or null

## Generic CRUD Service

- [ ] `findAll` returns entities excluding soft-deleted
- [ ] `findById` returns entity or null
- [ ] `create` saves and returns new entity
- [ ] `update` updates and returns modified entity
- [ ] `deleteById` performs soft delete (sets deletedAt)
- [ ] `hardDeleteById` throws error (hard deletes disabled)
- [ ] `hardDelete` throws error (hard deletes disabled)
- [ ] `upsert` creates if not exists, updates if exists
- [ ] `restore` clears deletedAt on soft-deleted entity
- [ ] `findAllWithDeleted` includes soft-deleted entities
- [ ] `count` excludes soft-deleted entities
- [ ] `transaction` executes operations in a database transaction

## Migrations

- [ ] InitialSchema creates schema, uuid-ossp extension, vector extension, examples table
- [ ] AddUserTheme creates user_theme table
