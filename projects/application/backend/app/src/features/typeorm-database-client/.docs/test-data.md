# TypeORM Database Client — Test Data

## Seed Data

The `/examples` routes do not require any pre-existing rows; `example_schema.examples` is created empty by the initial migration and tests should create their own fixtures. Soft-deleted rows can be verified by issuing `DELETE /examples/:id` and then asserting with `GET` / `GET meta/count`.

## Required Environment Variables

All five must be present, otherwise `TypeormDatabaseClientModule.forRoot()` throws before the app starts (`typeorm-database-client.module.ts:33-37`):

| Var | Example (local K8s) | Source |
|---|---|---|
| `DATABASE_HOST` | `database` | `infrastructure/k8s/helmfile.yaml.gotmpl:142` |
| `DATABASE_PORT` | `5432` | `infrastructure/k8s/helmfile.yaml.gotmpl:143` |
| `DATABASE_USERNAME` | matches `POSTGRES_USER` | helmfile env |
| `DATABASE_PASSWORD` | matches `POSTGRES_PASSWORD` | helmfile env |
| `DATABASE_NAME` | matches `POSTGRES_DB` | helmfile env |
| `DATABASE_SSL` | `false` | optional |
| `DATABASE_LOGGING` | `false` | optional |
| `DATABASE_SYNC` | (ignored — see spec.md Discrepancies) | — |

## API Examples

### `POST /examples` request
```json
{
  "name": "widget-a",
  "description": "first reference widget",
  "metadata": { "category": "demo", "priority": 1 }
}
```

### `POST /examples` 201 response
```json
{
  "id": "b5f1e8c0-3e43-4b1a-9f4b-1c7e5b6d2a11",
  "name": "widget-a",
  "description": "first reference widget",
  "metadata": { "category": "demo", "priority": 1 },
  "createdAt": "2026-04-20T18:00:00.000Z",
  "updatedAt": "2026-04-20T18:00:00.000Z",
  "deletedAt": null
}
```

### `DELETE /examples/:id` 200 response
```json
{ "message": "Example with ID b5f1e8c0-3e43-4b1a-9f4b-1c7e5b6d2a11 has been soft deleted" }
```

### `POST /examples/:id/restore` 200 response
```json
{ "message": "Example with ID b5f1e8c0-3e43-4b1a-9f4b-1c7e5b6d2a11 has been restored" }
```

### Typical 400 response (NestJS default exception filter)
```json
{
  "statusCode": 400,
  "message": "Name is required",
  "error": "Bad Request"
}
```

### Typical 404 response
```json
{
  "statusCode": 404,
  "message": "Example with ID 999 not found",
  "error": "Not Found"
}
```

### 500 response (non-HTTP error wrapped in controller)
```json
{
  "statusCode": 500,
  "message": "Failed to retrieve examples"
}
```
