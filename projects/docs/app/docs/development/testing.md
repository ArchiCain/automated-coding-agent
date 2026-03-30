# Testing

## Test pyramid

```
        /\
       /  \  E2E Tests (few, slow, high confidence)
      /----\
     /      \ Integration Tests (moderate, real dependencies)
    /--------\
   /          \ Unit Tests (many, fast, isolated)
  /____________\
```

## Test types

### Unit tests

- Fast (milliseconds), mocked dependencies, co-located with source
- Run anytime — no stack required
- Backend: Jest (`*.spec.ts`)
- Frontend: Vitest (`*.test.tsx`)

### Integration tests

- Connect to **real running services** (not isolated instances)
- Backend hits real DB, Keycloak, and HTTP endpoints
- Frontend tests make real API calls
- Requires stack: `task start-local`

### E2E tests

- Playwright browser automation against the full stack
- User-perspective workflow validation
- Keep minimal: 5-20 tests covering critical journeys
- Located in `projects/e2e/`

## Running tests

```bash
# Unit tests (no prerequisites)
task backend:local:test
task frontend:local:test

# Integration tests (requires stack running)
task start-local
task backend:local:test:integration
task frontend:local:test:integration

# E2E tests (requires stack running)
task e2e:test
```

## Testing matrix

### Backend

| Component | Unit Test | Integration Test | Rationale |
|-----------|-----------|------------------|-----------|
| Controllers | Required | Required | Unit verifies logic; integration verifies HTTP cycle |
| Services | Required | Not needed | Tested indirectly through controller integration tests |
| Gateways (WebSocket) | Not needed | Required | Require real socket connections |
| Utilities | Required | Not needed | Pure functions tested in isolation |

### Frontend

| Component | Unit Test | Integration Test | Rationale |
|-----------|-----------|------------------|-----------|
| Components | Required | Selective | Integration only for components with API/WebSocket calls |
| Hooks | Required | Not needed | Mocked context |
| Utilities | Required | Not needed | Pure functions |

## Integration test patterns

### Entity testing (transaction rollback)

Database tests wrap operations in transactions that roll back after each test:

```typescript
beforeEach(async () => {
  transactionHelper = new TransactionHelper(dataSource);
  entityManager = await transactionHelper.start();
});

afterEach(async () => {
  await transactionHelper.rollback();  // No data persisted
});
```

### Authentication in tests

Protected endpoints use real Keycloak tokens:

```typescript
let authToken: string;

beforeAll(async () => {
  authToken = await getTestAuthToken('http://localhost:8085');
});

it('should return 200 when authenticated', async () => {
  const response = await authenticatedRequest(
    'http://localhost:8085', 'get', '/api/protected', authToken
  );
  expect(response.status).toBe(200);
});
```

Test credentials: `admin/admin` from Keycloak realm.

### Environment config for tests

Tests run on the host machine and need `DATABASE_HOST_LOCAL=localhost` in `.env` to connect to the database directly (instead of the Docker service name `database`).

## File naming

| Test Type | Backend | Frontend |
|-----------|---------|----------|
| Unit | `*.spec.ts` | `*.test.tsx` |
| Integration | `*.integration.spec.ts` | `*.integration.test.tsx` |
| E2E | `*.spec.ts` (in e2e project) | — |

## Configuration

- **Backend unit tests**: `jest.config.js`
- **Backend integration tests**: `jest.integration.config.js` (60-second timeout, setup file loads `.env`)
- **Frontend**: `vite.config.ts` (jsdom environment, v8 coverage)
- **E2E**: `playwright.config.ts` (single worker, screenshots on failure)
