# Database Client — Requirements

## What It Does

TypeORM integration with PostgreSQL. Provides base entity pattern, migrations, and a generic CRUD service.

## Configuration

| Env Variable | Default | Description |
|-------------|---------|-------------|
| `DATABASE_HOST` | localhost | PostgreSQL host |
| `DATABASE_PORT` | 5432 | PostgreSQL port |
| `DATABASE_USERNAME` | postgres | Database user |
| `DATABASE_PASSWORD` | postgres | Database password |
| `DATABASE_NAME` | postgres | Database name |
| `DATABASE_SSL` | false | Enable SSL |
| `DATABASE_LOGGING` | false | Enable query logging |

## Base Entity

All application entities extend `BaseEntity` which provides:

- Auto-generated UUID primary key (`id`)
- Timestamps: `createdAt`, `updatedAt`, `deletedAt`
- Soft delete enforcement — hard deletes throw an error
- Helper: `isDeleted` getter, `deletionDate` getter

## Entities

| Entity | Schema/Table | Description |
|--------|-------------|-------------|
| `ExampleEntity` | `example_schema.examples` | Demo entity with name, description, JSONB metadata |
| `UserThemeEntity` | `example_schema.user_theme` | User theme preference (userId unique, theme string) |

## Migrations

| Migration | Description |
|-----------|-------------|
| `1734056400000-InitialSchema` | Creates schema, extensions (uuid-ossp, vector), examples table |
| `1767287838000-AddUserTheme` | Creates user_theme table |

Migrations auto-run on startup (`migrationsRun: true`). Schema synchronization is disabled.

## Generic CRUD Service

`TypeormGenericCrudService` provides reusable CRUD operations for any entity extending `BaseEntity`:
- List with pagination and filtering
- Get by ID
- Create, update, soft delete
- Restore soft-deleted records
- Count

## Acceptance Criteria

- [ ] Migrations run automatically on startup
- [ ] Hard deletes are prevented at the entity level
- [ ] UUID primary keys generated automatically
- [ ] PostgreSQL extensions (uuid-ossp, vector) created in initial migration
