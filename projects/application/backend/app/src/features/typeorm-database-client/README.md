# TypeORM Database Client

Comprehensive NestJS TypeORM integration package for PostgreSQL database operations with enforced soft-delete patterns and generic CRUD services.

## Purpose

This package provides a centralized database client layer for the backend project, offering:

- **Generic CRUD service** for all entities with type-safe operations
- **PostgreSQL integration** via TypeORM with automatic migration support
- **Soft-delete enforcement** to prevent data loss (hard deletes are disabled)
- **Base entity** with UUID primary keys and automatic timestamps
- **Example controller** demonstrating CRUD patterns for reference

The package manages all database connectivity, entity definitions, migrations, and common database operations in a single, reusable module.

## Usage

### Basic Setup

Import the module in your NestJS application:

```typescript
import { TypeormDatabaseClientModule } from '@packages/typeorm-database-client';

@Module({
  imports: [TypeormDatabaseClientModule.forRoot()],
})
export class AppModule {}
```

### Using the Generic CRUD Service

The `TypeormGenericCrudService` works with any entity extending `BaseEntity`:

```typescript
import { TypeormGenericCrudService } from '@packages/typeorm-database-client';
import { ExampleEntity } from '@packages/typeorm-database-client';

@Injectable()
export class ExampleService {
  constructor(private crudService: TypeormGenericCrudService) {}

  async findAll() {
    return this.crudService.findAll(ExampleEntity);
  }

  async findById(id: string) {
    return this.crudService.findById(ExampleEntity, id);
  }

  async create(data: any) {
    return this.crudService.create(ExampleEntity, data);
  }

  async update(id: string, data: any) {
    return this.crudService.update(ExampleEntity, id, data);
  }

  async softDelete(id: string) {
    return this.crudService.deleteById(ExampleEntity, id);
  }

  async restore(id: string) {
    return this.crudService.restore(ExampleEntity, id);
  }

  async count() {
    return this.crudService.count(ExampleEntity);
  }
}
```

### Creating Custom Entities

All entities must extend `BaseEntity`:

```typescript
import { Entity, Column } from 'typeorm';
import { BaseEntity } from '@packages/typeorm-database-client';

@Entity('users')
export class UserEntity extends BaseEntity {
  @Column({ length: 255 })
  email: string;

  @Column({ length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  bio: string;
}
```

Entities automatically include:
- UUID `id` (primary key)
- `createdAt` (auto-set on creation)
- `updatedAt` (auto-updated on changes)
- `deletedAt` (auto-set on soft delete)
- Soft-delete protection methods

## API

### TypeormGenericCrudService

| Method | Signature | Description |
|--------|-----------|-------------|
| `findAll` | `<T>(entityClass: EntityTarget<T>, options?: FindManyOptions<T>): Promise<T[]>` | Find all entities with optional pagination and filtering |
| `findOne` | `<T>(entityClass: EntityTarget<T>, criteria: FindOptionsWhere<T>): Promise<T \| null>` | Find single entity by criteria |
| `findById` | `<T>(entityClass: EntityTarget<T>, id: any): Promise<T \| null>` | Find entity by ID |
| `create` | `<T>(entityClass: EntityTarget<T>, data: DeepPartial<T>): Promise<T>` | Create new entity |
| `update` | `<T>(entityClass: EntityTarget<T>, id: any, data: DeepPartial<T>): Promise<T \| null>` | Update entity by ID |
| `updateByCriteria` | `<T>(entityClass: EntityTarget<T>, criteria: FindOptionsWhere<T>, data: DeepPartial<T>): Promise<void>` | Update entities matching criteria |
| `upsert` | `<T>(entityClass: EntityTarget<T>, criteria: FindOptionsWhere<T>, data: DeepPartial<T>): Promise<T>` | Create or update based on criteria |
| `count` | `<T>(entityClass: EntityTarget<T>, criteria?: FindOptionsWhere<T>): Promise<number>` | Count entities (excludes soft-deleted) |
| `exists` | `<T>(entityClass: EntityTarget<T>, criteria: FindOptionsWhere<T>): Promise<boolean>` | Check if entity exists |
| `deleteById` | `<T>(entityClass: EntityTarget<T>, id: any): Promise<void>` | Soft delete by ID |
| `delete` | `<T>(entityClass: EntityTarget<T>, criteria: FindOptionsWhere<T>): Promise<void>` | Soft delete by criteria |
| `softDelete` | `<T>(entityClass: EntityTarget<T>, id: any): Promise<void>` | Soft delete by ID (alias) |
| `softDeleteByCriteria` | `<T>(entityClass: EntityTarget<T>, criteria: FindOptionsWhere<T>): Promise<void>` | Soft delete by criteria |
| `restore` | `<T>(entityClass: EntityTarget<T>, id: any): Promise<void>` | Restore soft-deleted entity by ID |
| `restoreByCriteria` | `<T>(entityClass: EntityTarget<T>, criteria: FindOptionsWhere<T>): Promise<void>` | Restore soft-deleted entities by criteria |
| `findAllWithDeleted` | `<T>(entityClass: EntityTarget<T>, options?: FindManyOptions<T>): Promise<T[]>` | Find entities including soft-deleted ones |
| `findDeleted` | `<T>(entityClass: EntityTarget<T>, options?: FindManyOptions<T>): Promise<T[]>` | Find only soft-deleted entities |
| `isSoftDeleted` | `<T>(entityClass: EntityTarget<T>, id: any): Promise<boolean>` | Check if entity is soft deleted |
| `query` | `(query: string, parameters?: any[]): Promise<any>` | Execute custom SQL query |
| `transaction` | `<T>(runInTransaction: (entityManager: EntityManager) => Promise<T>): Promise<T>` | Execute operations in a transaction |
| `getRepository` | `<T>(entityClass: EntityTarget<T>): Repository<T>` | Get TypeORM repository for advanced operations |
| `getEntityManager` | `(): EntityManager` | Get TypeORM EntityManager |

### BaseEntity

All entities extending `BaseEntity` automatically include:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string (UUID) | Auto-generated unique identifier |
| `createdAt` | Date | Auto-set creation timestamp |
| `updatedAt` | Date | Auto-updated modification timestamp |
| `deletedAt` | Date \| null | Soft-delete timestamp (null if active) |
| `isDeleted` | boolean (getter) | Returns true if soft deleted |
| `deletionDate` | Date \| null (getter) | Returns deletedAt or null |

## Configuration

Configure database connection via environment variables:

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DATABASE_HOST` | PostgreSQL host | localhost | Yes |
| `DATABASE_PORT` | PostgreSQL port | 5432 | Yes |
| `DATABASE_USERNAME` | PostgreSQL user | postgres | Yes |
| `DATABASE_PASSWORD` | PostgreSQL password | postgres | Yes |
| `DATABASE_NAME` | Database name | postgres | Yes |
| `DATABASE_SSL` | Use SSL connection | false | No |
| `DATABASE_LOGGING` | Enable query logging | false | No |

### Example .env

```env
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=postgres
DATABASE_NAME=automated_repo_db
DATABASE_SSL=false
DATABASE_LOGGING=false
```

## Migrations

TypeORM migrations are automatically discovered and run on application startup.

### Generate Migration

```bash
npm run migration:generate -- -n NameOfMigration
```

### Create Empty Migration

```bash
npm run migration:create -- -n NameOfMigration
```

### Run Migrations

```bash
npm run migration:run
```

### Revert Last Migration

```bash
npm run migration:revert
```

### Show Migration Status

```bash
npm run migration:show
```

Migrations are stored in the `migrations/` directory within this package.

## Files

| File | Purpose |
|------|---------|
| `index.ts` | Public API exports (module, service, entities) |
| `typeorm-database-client.module.ts` | NestJS module with database configuration and ForRoot setup |
| `typeorm-generic-crud.service.ts` | Generic CRUD service for all entities |
| `data-source.ts` | TypeORM DataSource config for CLI migrations |
| `entities/base.entity.ts` | Base entity class with soft-delete support |
| `entities/example.entity.ts` | Example entity demonstrating BaseEntity usage |
| `entities/user-theme.entity.ts` | UserTheme entity for user preferences |
| `entities/index.ts` | Entity exports |
| `example-crud.controller.ts` | Example REST controller with full CRUD endpoints |
| `migrations/` | Database schema migrations (auto-discovered) |

## Soft Delete Pattern

This package enforces soft deletes to prevent data loss:

- **All deletes are soft**: Records are marked with `deletedAt` timestamp, not removed
- **Hard deletes blocked**: Calling hard delete methods throws an error
- **Queries exclude deleted**: By default, `findAll`, `count`, etc. exclude soft-deleted records
- **Full history available**: Use `findAllWithDeleted` or `findDeleted` to access deleted records
- **Easy restoration**: Use `restore()` to undelete soft-deleted entities

### Querying Soft-Deleted Data

```typescript
// Get active records only (default)
const active = await crudService.findAll(UserEntity);

// Get all records including deleted
const all = await crudService.findAllWithDeleted(UserEntity);

// Get only deleted records
const deleted = await crudService.findDeleted(UserEntity);

// Check if specific record is deleted
const isDeleted = await crudService.isSoftDeleted(UserEntity, userId);

// Restore a deleted record
await crudService.restore(UserEntity, userId);
```

## Dependencies

- `@nestjs/core` - NestJS framework
- `@nestjs/common` - NestJS common utilities
- `@nestjs/typeorm` - NestJS TypeORM integration
- `typeorm` - Object-relational mapping library
- `pg` - PostgreSQL client driver

## Notes

- Database synchronization is **disabled** in production (`synchronize: false`) - use migrations instead
- The package is global (registered once, available everywhere)
- All dates are stored as timezone-aware timestamps
- The `ExampleCrudController` and `ExampleEntity` are reference implementations and can be removed in production
