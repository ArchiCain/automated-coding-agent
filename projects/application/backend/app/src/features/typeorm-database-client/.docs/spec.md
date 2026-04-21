# TypeORM Database Client — Spec

## What it is

The backend's database layer. It opens the app's PostgreSQL connection at startup, exposes a shared base class that every persisted record inherits (with built-in soft-delete and timestamps), provides a generic CRUD helper that other features can use without writing repository code, runs pending schema migrations on boot, and ships a small demo REST surface at `/examples` as a reference implementation.

## How it behaves

### At startup

When the backend boots, this feature reads the database host, port, username, password, and name from the environment. If any of the five are missing, the app refuses to start and reports which one. It optionally enables SSL (accepting the server cert without verification) and query logging based on two more env flags. Schema synchronization is always off — the database schema is only changed by migrations. On connect, the feature finds any pending migrations and runs them in order, recording each one in a migrations tracking table so they don't run twice.

### What it provides to the rest of the backend

The feature registers itself globally, so every other feature can inject the database module and the generic CRUD helper without re-importing anything.

**Base record behavior.** Any entity that inherits the shared base class automatically gets a generated UUID primary key, a created timestamp, an updated timestamp, and a soft-delete timestamp — all stored with timezone. Hard deletes are blocked: calling the usual "remove this row" or "delete this class's rows" methods throws an error telling the caller that hard deletes are not allowed. The base class also exposes simple helpers to check whether a record has been soft-deleted and when.

**Generic CRUD helper.** Other features can ask the helper to read, create, update, count, check existence, soft-delete, restore, or list soft-deleted rows for any entity class — without writing a repository. It also exposes raw-query and transaction wrappers, plus escape hatches to get the underlying repository or entity manager when the helper isn't enough. All of its delete methods are soft deletes; the two hard-delete methods it advertises are stubs that throw on call.

### The demo `/examples` endpoints

The feature registers a reference REST controller at `/examples` that exercises the generic CRUD helper end-to-end against a demo entity. The routes are always mounted (no production gate) and sit behind the app's global authentication guard, so every call needs a valid JWT.

### Standalone CLI access

A standalone data source is exported for the TypeORM CLI. It reads the same environment variables, keeps synchronize off, and points at this feature's migrations folder — so developers can generate and run migrations from the command line against the same database the app uses.

## Acceptance criteria

- [ ] The app fails to boot with a clear, specific error when any of the five required database environment variables is unset.
- [ ] Schema synchronization is off regardless of environment; schema changes only come from migrations.
- [ ] On first boot against an empty database, all migrations run in order and are recorded in the migrations tracking table.
- [ ] After the initial migration, the required PostgreSQL extensions and the app's schema and tables exist.
- [ ] A new record of any entity that uses the shared base class is inserted with a generated UUID, a created timestamp, and an updated timestamp.
- [ ] Calling the instance "remove" method or the static "delete" method on a base-class entity throws "Hard deletes are not allowed".
- [ ] Deleting a record through the generic CRUD helper sets the soft-delete timestamp and hides the row from subsequent reads.
- [ ] The helper's hard-delete methods throw without touching the database.
- [ ] Restoring a soft-deleted record clears the soft-delete timestamp and the row becomes visible again.
- [ ] The `/examples` routes require a valid JWT and return the shapes defined in `contracts.md`.
- [ ] The database module and generic CRUD helper are usable from any other feature without an explicit import.

## Known gaps

- A `DATABASE_SYNC` environment variable is documented in the module's JSDoc, but the module never reads it — synchronize is hardcoded off. Either wire the variable up or remove the reference.
- The initial migration file still carries a stale comment referencing an old "mastra" schema that no longer lives in this app, which is misleading to readers.
- The `UserTheme` entity does not inherit the shared base class: it has its own id and timestamps, no soft-delete column, and therefore doesn't participate in the hard-delete guard. It lives in this feature's folder but conceptually belongs to the theme feature.
- The generic CRUD helper's "list soft-deleted rows" method filters with a Mongo-style `{ $ne: null }` expression. TypeORM on PostgreSQL does not interpret that as "is not null" — this call likely returns nothing or errors out and needs to be rewritten using the proper TypeORM "not null" operator.
- The demo `/examples` endpoints are always registered, with no toggle to disable them in production. They're behind authentication, but they still expand the public API surface in every environment.

## Code map

Paths relative to `projects/application/backend/app/`.

| Concern | File · lines |
|---|---|
| Module setup: reads env, validates required vars, configures TypeORM | `src/features/typeorm-database-client/typeorm-database-client.module.ts:23-54` |
| SSL and query-logging env flags | `src/features/typeorm-database-client/typeorm-database-client.module.ts:28-30,48-49` |
| `DATABASE_SYNC` documented but not read; synchronize hardcoded false | `src/features/typeorm-database-client/typeorm-database-client.module.ts:19,29` |
| Entity discovery via barrel enumeration | `src/features/typeorm-database-client/typeorm-database-client.module.ts:46`, `src/features/typeorm-database-client/entities/index.ts:1-2` |
| Migrations glob + auto-run on boot + tracking table | `src/features/typeorm-database-client/typeorm-database-client.module.ts:52-54` |
| Registered globally; module + generic CRUD helper exported | `src/features/typeorm-database-client/typeorm-database-client.module.ts:59-63` |
| Demo `/examples` controller registered unconditionally | `src/features/typeorm-database-client/typeorm-database-client.module.ts:61`, `src/features/typeorm-database-client/controllers/example-crud.controller.ts:24-25` |
| Global JWT guard enforcement | `src/app.module.ts:23-27` |
| Shared base class: UUID id, timestamps, soft-delete column | `src/features/typeorm-database-client/entities/base.entity.ts:14-83` |
| Hard-delete guards (instance `remove` + static `delete`) | `src/features/typeorm-database-client/entities/base.entity.ts:14-83` |
| Demo entity extending the base class | `src/features/typeorm-database-client/entities/example.entity.ts:9-19` |
| `UserTheme` — does not extend base class, no soft-delete | `src/features/typeorm-database-client/entities/user-theme.entity.ts:10-25` |
| Generic CRUD helper: reads, writes, soft-delete, restore, raw query, transaction | `src/features/typeorm-database-client/services/typeorm-generic-crud.service.ts:17-300` |
| Hard-delete stubs that throw | `src/features/typeorm-database-client/services/typeorm-generic-crud.service.ts:125-145` |
| "List soft-deleted" uses Mongo-style `{ $ne: null }` | `src/features/typeorm-database-client/services/typeorm-generic-crud.service.ts:273-281` |
| Initial migration — extensions, schema, demo table + indexes | `src/features/typeorm-database-client/migrations/1734056400000-InitialSchema.ts:15` |
| Stale "mastra" comment in initial migration | `src/features/typeorm-database-client/migrations/1734056400000-InitialSchema.ts:13,69` |
| Follow-up migration — user theme table | `src/features/typeorm-database-client/migrations/1767287838000-AddUserTheme.ts:3` |
| Standalone CLI data source | `src/features/typeorm-database-client/data-source.ts:11-42` |
