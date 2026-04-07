# Skill: API Test

You are writing or running **API integration tests** against a live deployed
environment. These tests verify that backend endpoints behave correctly end-to-end,
including database operations, authentication, and error handling.

---

## Test Framework

Tests use **Jest** (or **Vitest** if the project has migrated). Check `package.json`
for the active test runner:

```bash
# Check which runner is configured
cat package.json | grep -E '"test"|"jest"|"vitest"'
```

---

## Test File Location & Naming

```
src/features/{feature}/__tests__/
  {feature}.integration.spec.ts    # Integration tests against live API
  {feature}.service.spec.ts        # Unit tests (mocked dependencies)
  {feature}.controller.spec.ts     # Controller unit tests

tests/integration/                  # Cross-feature integration tests
  {workflow-name}.integration.spec.ts
```

Naming convention:
- `*.spec.ts` — Unit tests (run without external services)
- `*.integration.spec.ts` — Integration tests (require deployed environment)
- `*.e2e.spec.ts` — End-to-end tests (require full stack including frontend)

---

## Integration Test Pattern

```typescript
import axios, { AxiosInstance } from 'axios';

describe('Feature API Integration', () => {
  let client: AxiosInstance;
  const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';

  beforeAll(() => {
    client = axios.create({
      baseURL: baseUrl,
      timeout: 10_000,
      validateStatus: () => true, // Don't throw on non-2xx
    });
  });

  describe('GET /api/features', () => {
    it('should return a list of features', async () => {
      const response = await client.get('/api/features');

      expect(response.status).toBe(200);
      expect(response.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            name: expect.any(String),
          }),
        ]),
      );
    });

    it('should return empty array when no data exists', async () => {
      const response = await client.get('/api/features?filter=nonexistent');

      expect(response.status).toBe(200);
      expect(response.data).toEqual([]);
    });
  });

  describe('POST /api/features', () => {
    it('should create a new feature', async () => {
      const payload = { name: 'Test Feature', description: 'Created by integration test' };
      const response = await client.post('/api/features', payload);

      expect(response.status).toBe(201);
      expect(response.data).toMatchObject({
        id: expect.any(String),
        name: payload.name,
        description: payload.description,
      });
    });

    it('should return 400 for invalid payload', async () => {
      const response = await client.post('/api/features', { name: '' });

      expect(response.status).toBe(400);
      expect(response.data.message).toBeDefined();
    });
  });

  describe('GET /api/features/:id', () => {
    it('should return 404 for non-existent id', async () => {
      const response = await client.get('/api/features/00000000-0000-0000-0000-000000000000');

      expect(response.status).toBe(404);
    });
  });
});
```

---

## API Contract Testing

When testing API contracts, verify:

1. **Status codes** — Correct HTTP status for each scenario (200, 201, 400, 404, 409, 500).
2. **Response shape** — All expected fields are present with correct types.
3. **Pagination** — If paginated, verify `limit`, `offset`, `total` fields.
4. **Error format** — Errors follow the standard envelope: `{ statusCode, message, error }`.
5. **Idempotency** — POST/PUT operations behave correctly on retry.
6. **Edge cases** — Empty strings, null values, max-length strings, special characters.

### Contract Snapshot Pattern

```typescript
it('should match the API contract', async () => {
  const response = await client.get('/api/features/known-id');

  // Verify shape without brittle value matching
  expect(Object.keys(response.data).sort()).toEqual([
    'createdAt', 'description', 'id', 'name', 'status', 'updatedAt',
  ]);
});
```

---

## Running Tests

```bash
# Run all integration tests
npx jest --testPathPattern='integration.spec' --runInBand

# Run specific feature integration tests
npx jest --testPathPattern='features/billing.*integration' --runInBand

# Run with environment URL
API_BASE_URL=http://env-task-123.internal npx jest --testPathPattern='integration' --runInBand
```

The `--runInBand` flag is important for integration tests to avoid parallel requests
that may conflict with each other's test data.

---

## Test Data Management

### Setup

- Create test data in `beforeAll` or `beforeEach` blocks.
- Use unique identifiers (UUIDs or timestamps) to avoid collisions.
- Prefix test data names with `__test__` for easy identification.

### Cleanup

- Delete test data in `afterAll` blocks.
- Use a try/finally pattern to ensure cleanup runs even on test failure.

```typescript
let createdIds: string[] = [];

afterAll(async () => {
  for (const id of createdIds) {
    try {
      await client.delete(`/api/features/${id}`);
    } catch {
      // Best-effort cleanup
    }
  }
});
```

### Isolation

- Each test file manages its own test data.
- Tests should not depend on data created by other test files.
- Tests should pass regardless of execution order.

---

## Debugging Failures

When an integration test fails:

1. **Check the response body** — Add `console.log(response.data)` to see the actual error.
2. **Check the service logs** — `task env:logs TASK_ID=$TASK_ID SERVICE=backend`
3. **Check the database** — `task env:db:query TASK_ID=$TASK_ID QUERY="SELECT ..."`
4. **Check the health** — `task env:health TASK_ID=$TASK_ID`
5. **Verify the endpoint exists** — `curl -v $API_BASE_URL/api/features`

Common failure causes:
- Environment not ready (health check not passing)
- Migration not applied (missing table or column)
- Authentication required but not provided in test
- Test data from a previous run causing uniqueness constraint violations
