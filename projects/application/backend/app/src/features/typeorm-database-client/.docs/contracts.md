# TypeORM Database Client — Contracts

These are the demo `/examples` endpoints registered by `TypeormDatabaseClientModule` (`typeorm-database-client.module.ts:61`). They are a reference CRUD implementation — not part of product functionality. All routes sit behind the global `KeycloakJwtGuard` (`src/app.module.ts:23-27`); no `@Public()` opt-out exists on the controller (`example-crud.controller.ts:24`). Auth is: **valid Keycloak JWT required** (cookie `access_token` or `Authorization: Bearer <jwt>`).

There is no global `ValidationPipe` (`src/main.ts`), so request bodies are accepted as plain JSON and validated manually inside each handler.

## Shared Types

```typescript
// Persisted shape (JSON serialization of ExampleEntity)
interface Example {
  id: string;            // UUID, auto-generated
  name: string;          // varchar(255)
  description: string | null;
  metadata: Record<string, any> | null; // jsonb
  createdAt: string;     // ISO timestamp with tz
  updatedAt: string;     // ISO timestamp with tz
  deletedAt: string | null; // ISO timestamp with tz (only visible via *WithDeleted queries)
}

// Request body — `CreateExampleDto` (example-crud.controller.ts:296-300)
interface CreateExampleDto {
  name: string;          // required
  description?: string;
  metadata?: Record<string, any>;
}

// Request body — `UpdateExampleDto` (example-crud.controller.ts:305-309)
interface UpdateExampleDto {
  name?: string;
  description?: string;
  metadata?: Record<string, any>;
}
```

## Endpoints

### `GET /examples`
**Auth:** Required (JWT).
**Query params:** `limit?: string` (non-negative integer), `offset?: string` (non-negative integer), `name?: string` (exact match).
**Source:** `example-crud.controller.ts:32-73`.
**Response 200:**
```typescript
Example[]
```
**Errors:**
- `400 BadRequestException` — `limit` or `offset` is NaN or negative.
- `500 InternalServerError` — `{ statusCode: 500, message: "Failed to retrieve examples" }` on any non-HTTP error.

### `GET /examples/:id`
**Auth:** Required.
**Source:** `example-crud.controller.ts:79-102`.
**Response 200:** `Example`.
**Errors:**
- `400` — `id` missing.
- `404 NotFoundException` — `"Example with ID <id> not found"`.
- `500` — `"Failed to retrieve example"`.

### `POST /examples`
**Auth:** Required.
**Request:** `CreateExampleDto`.
**Source:** `example-crud.controller.ts:108-139`.
**Response 201:** `Example`.
**Errors:**
- `400` — `"Name is required"` when body is missing `name`.
- `400` — `"Example with name '<name>' already exists"` when a live row already has that name.
- `500` — `"Failed to create example"`.

### `PUT /examples/:id`
**Auth:** Required.
**Request:** `UpdateExampleDto`.
**Source:** `example-crud.controller.ts:145-199`.
**Response 200:** `Example` (the updated row, re-fetched).
**Errors:**
- `400` — missing `id`.
- `404` — `"Example with ID <id> not found"`.
- `400` — `"Example with name '<name>' already exists"` when renaming collides with another row.
- `500` — `"Failed to update example"`.

### `DELETE /examples/:id`
**Auth:** Required. Soft delete (sets `deletedAt`).
**Source:** `example-crud.controller.ts:205-233`.
**Response 200:**
```typescript
{ message: `Example with ID ${id} has been soft deleted` }
```
**Errors:**
- `400` — missing `id`.
- `404` — row not found (or already soft-deleted — `findById` hides it).
- `500` — `"Failed to delete example"`.

### `GET /examples/meta/count`
**Auth:** Required.
**Query params:** `name?: string`.
**Source:** `example-crud.controller.ts:239-254`.
**Response 200:**
```typescript
{ count: number } // excludes soft-deleted rows
```
**Errors:**
- `500` — `"Failed to count examples"`.

### `POST /examples/:id/restore`
**Auth:** Required. Clears `deletedAt` on a previously soft-deleted row.
**Source:** `example-crud.controller.ts:260-290`.
**Response 200:**
```typescript
{ message: `Example with ID ${id} has been restored` }
```
**Errors:**
- `400` — missing `id`.
- `400` — `"Example with ID <id> is not deleted or does not exist"` (covers both "row missing" and "row already active").
- `500` — `"Failed to restore example"`.

## Notes on Route Ordering

`GET /examples/meta/count` is declared after `GET /examples/:id` in source, but Nest routes `:id` as a param so literal path `meta/count` has to be caught by the specific route decorator. NestJS registers routes in declaration order; because `meta/count` is a two-segment path it does not collide with `:id` (one segment).
