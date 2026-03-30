# Testing

Testing patterns, strategies, and automation for ensuring code quality and system reliability.

## Testing Philosophy

The template uses a **layered testing approach** that balances speed, confidence, and maintainability:

- **Fast Feedback**: Unit tests provide immediate feedback during development
- **Real Behavior**: Integration tests verify components work together with real dependencies
- **User Confidence**: E2E tests validate complete workflows from user perspective
- **Boundary Testing**: Tests focus on API boundaries (controllers, endpoints) rather than internal implementations
- **Production Parity**: Integration tests run against real services, not mocks

## Quick Start

```bash
# 1. Unit tests (no prerequisites - run anytime)
task backend:local:test
task frontend:local:test

# 2. Integration tests (requires services running)
task start-local
task backend:local:test:integration
task frontend:local:test:integration

# 3. E2E tests (complete system)
task e2e:test
```

**Prerequisites for integration tests:**
- Add `DATABASE_HOST_LOCAL=localhost` to `.env`
- Start stack: `task start-local`
- Verify health: `task status`

## Test Types

### The Test Pyramid

```
        /\
       /  \  E2E Tests (Few, Slow, High Confidence)
      /----\
     /      \ Integration Tests (Moderate, Real Dependencies)
    /--------\
   /          \ Unit Tests (Many, Fast, Isolated)
  /____________\
```

The pyramid guides test distribution: many fast unit tests at the base, moderate integration tests in the middle, and minimal E2E tests at the top.

### Unit Tests

**Purpose**: Verify individual functions, methods, or components in isolation

**Characteristics**:
- Fast (milliseconds)
- Mocked external dependencies
- Co-located with source code
- Test single unit of functionality

**Example structure**:
```typescript
describe('ServiceName', () => {
  it('should [behavior] when [condition]', () => {
    // Arrange, Act, Assert
  });
});
```

### Integration Tests

**Purpose**: Verify components work together with real dependencies (HTTP, WebSockets, Database)

**Characteristics**:
- Real dependencies (actual HTTP calls, database connections)
- Medium speed (1-5 seconds per test)
- Boundary focus (test at API/interface boundaries)
- Located in `test/integration/` directory

**Key approach**: Tests run against the **real running backend** (`localhost:8085`) rather than creating isolated test instances. This provides true integration testing with all services working together.

### E2E Tests

**Purpose**: Validate complete user workflows through browser automation

**Characteristics**:
- Complete system (all services running)
- Browser automation with Playwright
- User perspective
- Slow (10-60 seconds per test)
- Located in separate `e2e/` project

**Keep minimal**: 5-20 tests total, focusing on critical user journeys.

## Testing Approach

### Integration Tests Against Running Services

**This template's approach**: Integration tests connect to real running services rather than creating isolated test instances.

**Why:**
- Tests real service interactions (Backend ↔ Keycloak, Backend ↔ Database)
- Avoids SSL/authentication configuration issues
- Tests actual deployed configuration
- Faster test execution (no app bootstrap per test suite)
- True integration confidence

**Requirements:**
- Backend stack must be running: `task start-local`
- Tests connect to `http://localhost:8085`
- Authentication uses real Keycloak at `http://localhost:8081`
- Database operations use real PostgreSQL at `localhost:5437`

### Entity Testing Pattern

Entity integration tests use **transaction rollback** to ensure data doesn't persist between tests.

**Pattern**:
```typescript
describe('EntityName Integration', () => {
  let dataSource: DataSource;
  let crudService: TypeormGenericCrudService;
  let transactionHelper: TransactionHelper;

  beforeAll(async () => {
    dataSource = await AppDataSource.initialize();
  });

  beforeEach(async () => {
    // Start transaction
    transactionHelper = new TransactionHelper(dataSource);
    const entityManager = await transactionHelper.start();
    crudService = new TypeormGenericCrudService(entityManager);
  });

  afterEach(async () => {
    // Rollback - data is not persisted
    await transactionHelper.rollback();
  });

  it('should create entity (data will be rolled back)', async () => {
    const entity = await crudService.create(Entity, { name: 'Test' });
    expect(entity.id).toBeDefined();
  });
});
```

**Test coverage for entities**: CREATE, READ, UPDATE, SOFT DELETE, RESTORE, HARD DELETE PREVENTION, TRANSACTION ROLLBACK

### Authentication in Integration Tests

Protected endpoints require real authentication via Keycloak.

**Pattern**:
```typescript
import { getTestAuthToken, authenticatedRequest } from '../auth-helpers';

describe('Protected Endpoint (Integration)', () => {
  let authToken: string;

  beforeAll(async () => {
    authToken = await getTestAuthToken('http://localhost:8085');
  });

  it('should return 401 when not authenticated', async () => {
    await request('http://localhost:8085')
      .get('/api/protected')
      .expect(401);
  });

  it('should return 200 when authenticated', async () => {
    const response = await authenticatedRequest(
      'http://localhost:8085',
      'get',
      '/api/protected',
      authToken
    );
    expect(response.status).toBe(200);
  });
});
```

**Test credentials**: `admin/admin` from Keycloak realm configuration

### Environment Configuration for Tests

Tests run on the host machine (not in Docker) and require special configuration:

**Key variables in `.env`**:
```bash
DATABASE_HOST=database              # For Docker containers
DATABASE_HOST_LOCAL=localhost       # For tests on host
DATABASE_PORT=5437
```

**Test setup** (`test/setup.ts`) loads root `.env` and overrides for host machine access.

## Testing Matrix

### Backend Testing Strategy

| Component Type | Unit Test | Integration Test | Why |
|----------------|-----------|------------------|-----|
| **Controllers** | ✅ Required | ✅ Required | Unit tests verify logic; integration tests verify full HTTP cycle |
| **Services** | ✅ Required | ❌ Not needed | Services tested indirectly through controller integration tests |
| **Gateways** (WebSocket) | ❌ Not needed | ✅ Required | WebSocket gateways require real socket connections |
| **Utilities/Helpers** | ✅ Required | ❌ Not needed | Pure functions tested in isolation |

### Frontend Testing Strategy

| Component Type | Unit Test | Integration Test | Why |
|----------------|-----------|------------------|-----|
| **Components** | ✅ Required | ⚠️ Selective | Unit test all; integration test only components with API/WebSocket calls |
| **Hooks** | ✅ Required | ❌ Not needed | Hooks tested in isolation with mocked context |
| **Utilities** | ✅ Required | ❌ Not needed | Pure functions tested in isolation |

### E2E Testing Strategy

Keep E2E tests minimal (5-20 total) focusing on:
- Critical user journeys
- Authentication flows
- Cross-page navigation
- Error scenarios users encounter

## Project Structure

### Backend Testing

```
projects/backend/app/
├── src/
│   ├── packages/
│   │   └── auth/
│   │       ├── auth.service.ts
│   │       └── auth.service.spec.ts         # Unit test (co-located)
│   └── endpoints/
│       ├── health.controller.ts
│       └── health.controller.spec.ts        # Unit test (co-located)
├── test/
│   ├── integration/
│   │   ├── health.integration.spec.ts       # HTTP integration test
│   │   ├── example-entity.integration.spec.ts  # Entity CRUD test
│   │   └── chat-gateway.integration.spec.ts    # WebSocket test
│   ├── setup.ts                             # Global test configuration
│   ├── test-helpers.ts                      # TransactionHelper, etc.
│   └── auth-helpers.ts                      # Authentication helpers
├── jest.config.js                           # Unit test config
└── jest.integration.config.js               # Integration test config
```

### Frontend Testing

```
projects/frontend/app/
├── src/
│   └── packages/
│       └── chat/
│           ├── ChatInterface.tsx
│           ├── ChatInterface.test.tsx              # Unit test
│           └── ChatInterface.integration.test.tsx  # Integration test
├── test/
│   └── setup.ts
└── vite.config.ts                           # Includes test configuration
```

### E2E Testing

```
projects/e2e/app/
├── tests/
│   ├── auth-workflow.spec.ts
│   ├── chat-workflow.spec.ts
│   └── document-upload.spec.ts
├── fixtures/                                # Test data
├── page-objects/                            # Page object pattern (optional)
├── playwright.config.ts
└── package.json
```

## Test Naming Conventions

| Test Type | Backend | Frontend |
|-----------|---------|----------|
| **Unit** | `*.spec.ts` | `*.test.tsx` or `*.test.ts` |
| **Integration** | `*.integration.spec.ts` | `*.integration.test.tsx` |
| **E2E** | N/A | `*.spec.ts` (in e2e project) |

**Test descriptions**:
```typescript
describe('ClassName or ComponentName', () => {
  describe('methodName or feature', () => {
    it('should [expected behavior] when [condition]', () => {
      // Test implementation
    });
  });
});
```

## Task Automation

### Common Commands

```bash
# Backend
task backend:local:test                    # Unit tests
task backend:local:test:watch              # Unit tests in watch mode
task backend:local:test:integration        # Integration tests
task backend:local:test:coverage           # Coverage report

# Frontend
task frontend:local:test                   # Unit tests
task frontend:local:test:watch             # Watch mode
task frontend:local:test:integration       # Integration tests
task frontend:local:test:coverage          # Coverage report

# E2E
task e2e:install                           # Install dependencies + Playwright
task e2e:test                              # Run all E2E tests
task e2e:test:headed                       # Run with visible browser
task e2e:test:debug                        # Debug mode
task e2e:test:ui                           # Playwright UI
task e2e:report                            # Show test report

# All tests
task test:unit                             # All unit tests
task test:integration                      # All integration tests
task test:e2e                              # All E2E tests
task test:all                              # Run everything
```

## Test Configuration

### Backend (Jest)

**Two configurations**:
- `jest.config.js` - Unit tests (looks for `*.spec.ts`)
- `jest.integration.config.js` - Integration tests (looks for `*.integration.spec.ts`)

**Key settings**:
- Verbose output enabled
- Transform ESM modules (jose, @mastra, etc.)
- Module path aliasing (`@/` → `src/`)
- 60-second timeout for integration tests
- Setup file loads environment and configures connections

### Frontend (Vitest)

**Configuration in** `vite.config.ts`:
- `jsdom` environment for React testing
- Setup file for Testing Library
- Coverage reporting with v8
- Module path aliasing

### E2E (Playwright)

**Configuration in** `playwright.config.ts`:
- Test directory: `./tests`
- Base URL: `http://localhost:3000`
- Single worker (sequential execution)
- Screenshot on failure
- Trace on first retry

## Coverage Requirements

### Recommended Thresholds

| Component Type | Unit Test Coverage | Integration Coverage |
|----------------|-------------------|----------------------|
| **Backend Packages** | 80% minimum | N/A |
| **Backend Controllers** | 90% minimum | 100% (all endpoints) |
| **Backend Services** | 80% minimum | N/A |
| **Frontend Components** | 70% minimum | Selective |
| **Frontend Hooks** | 80% minimum | N/A |
| **Utilities** | 90% minimum | N/A |

## Best Practices

### Integration Test Principles

- **Test Against Running Services**: Connect to real backend, not isolated instances
- **Never Skip Tests**: Tests fail loudly if prerequisites aren't met
- **Transaction Rollback**: Wrap database operations in transactions for automatic cleanup
- **Real Authentication**: Use real Keycloak tokens, don't mock auth

### Test Organization

- **Co-locate unit tests**: Keep unit tests next to source files
- **Separate integration tests**: Dedicated `test/integration/` directory
- **Isolate E2E tests**: Separate project with own dependencies
- **Descriptive names**: Test descriptions clearly state expected behavior

### Test Independence

- **No shared state**: Each test should be independent and idempotent
- **Clean setup/teardown**: Use `beforeEach`/`afterEach` for isolation
- **Mock in unit tests**: Never make real API calls or database queries
- **Real services in integration tests**: Connect to running services
- **Transaction rollback**: Automatic cleanup for database tests

### Test Data Management

- **Transaction rollback preferred**: Use database transactions for automatic cleanup
- **Realistic data**: Use data that resembles production
- **No manual cleanup needed**: Transactions handle cleanup automatically
- **Verify rollback**: Include tests confirming proper transaction behavior

### Performance

- **Parallel unit tests**: Run unit tests in parallel for speed
- **Real services for integration**: Faster than bootstrapping per test
- **Transaction rollback**: Faster than manual cleanup
- **Selective E2E execution**: Run on demand, not every commit
- **Fast unit tests**: Keep under 100ms each

### Debugging

- **Verbose output**: Tests run with `--verbose` by default
- **Watch mode**: Use during development
- **Isolate failures**: Use `.only` to focus on failing tests
- **Check service health**: Verify services running if integration tests fail
- **Review setup**: Check `test/setup.ts` for environment configuration

## Common Testing Patterns

### Async Code

```typescript
// Promises
it('should handle async operations', async () => {
  const result = await asyncFunction();
  expect(result).toBeDefined();
});
```

### Error Handling

```typescript
it('should throw error for invalid input', () => {
  expect(() => functionThatThrows('invalid')).toThrow('Expected error');
});

it('should handle async errors', async () => {
  await expect(asyncFunctionThatThrows()).rejects.toThrow('Error message');
});
```

### WebSocket Events

```typescript
it('should emit and receive events', (done) => {
  const socket = io('http://localhost:8085/namespace');

  socket.on('event-name', (data) => {
    expect(data).toMatchObject({ expected: 'value' });
    socket.disconnect();
    done();
  });

  socket.emit('trigger-event', { param: 'value' });
});
```

## Related Documentation

- **Package Architecture**: [Package Architecture](package-architecture.md) - Organizing testable code
- **Task Automation**: [Task Automation](task-automation.md) - Running tests via tasks
- **Docker**: [Docker](docker.md) - Testing in containerized environments
- **Environment Configuration**: [Environment Configuration](environment-configuration.md) - Test environment setup

---

This testing approach provides comprehensive coverage while maintaining fast feedback cycles and clear testing boundaries. Tests serve as both verification and documentation of system behavior.
