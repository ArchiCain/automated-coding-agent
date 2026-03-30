# testing-tools

Frontend testing utilities for validating backend connectivity and database operations in the frontend application.

## Purpose

This package provides two self-contained testing modules for development and QA environments:

1. **Backend Health Check** - Monitor backend availability and health status
2. **TypeORM Database Client** - Execute comprehensive CRUD smoke tests against a TypeORM-backed API

These tools help validate that your frontend can successfully communicate with the backend and perform basic operations.

## Usage

### Backend Health Check

Display backend health status with automatic periodic checks:

```typescript
import { BackendHealthCheck } from '@packages/testing-tools';

function MyApp() {
  return (
    <BackendHealthCheck
      autoRefresh={true}
      refreshInterval={30000}
      showTimestamp={true}
      showRefreshButton={true}
    />
  );
}
```

Or use the hook directly for custom implementations:

```typescript
import { useBackendHealthCheck } from '@packages/testing-tools';

function CustomHealthComponent() {
  const { data, loading, error, lastChecked, refresh } =
    useBackendHealthCheck(true, 30000);

  return (
    <div>
      <p>Status: {data?.status}</p>
      <button onClick={refresh}>Refresh</button>
    </div>
  );
}
```

### TypeORM Database Client

Run comprehensive CRUD smoke tests against the backend:

```typescript
import { TypeormDatabaseClient } from '@packages/testing-tools';

function TestDashboard() {
  return (
    <TypeormDatabaseClient showDetails={true} />
  );
}
```

Or use the hook for integration with custom test runners:

```typescript
import { useTypeormDatabaseClient } from '@packages/testing-tools';

function CustomTestRunner() {
  const {
    isRunning,
    result,
    error,
    runSmokeTest,
    getAllExamples,
    createExample,
  } = useTypeormDatabaseClient();

  return (
    <div>
      <button onClick={runSmokeTest} disabled={isRunning}>
        Run Tests
      </button>
      {result && <p>Passed: {result.completedSteps}/{result.totalSteps}</p>}
    </div>
  );
}
```

## API

### Backend Health Check

#### Component: `BackendHealthCheck`

Props:
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| autoRefresh | boolean | true | Automatically refresh health status |
| refreshInterval | number | 30000 | Interval between auto-refreshes (ms) |
| showTimestamp | boolean | true | Display last check timestamp |
| showRefreshButton | boolean | true | Show manual refresh button |

#### Hook: `useBackendHealthCheck(autoRefresh, refreshInterval)`

Returns:
```typescript
{
  data: HealthStatus | null;           // Current health status
  loading: boolean;                    // Request in progress
  error: string | null;                // Error message
  lastChecked: Date | null;            // Last check time
  refresh: () => Promise<void>;        // Manual refresh function
}
```

#### Type: `HealthStatus`

```typescript
interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'unknown';
  message: string;
  timestamp: string;
  uptime?: string;                     // Optional uptime duration
  version?: string;                    // Optional backend version
}
```

### TypeORM Database Client

#### Component: `TypeormDatabaseClient`

Props:
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| showDetails | boolean | true | Show detailed test step information |

#### Hook: `useTypeormDatabaseClient()`

Returns:
```typescript
{
  isRunning: boolean;                  // Test suite in progress
  result: TestResult | null;           // Test execution results
  currentStep: number;                 // Current running step index
  error: string | null;                // Error message if failed
  lastRun: Date | null;                // Timestamp of last run
  createdRecords: ExampleEntity[];     // Records created during tests
  updatedRecord: ExampleEntity | null; // Record updated during tests
  deletedRecord: ExampleEntity | null; // Record deleted during tests
  runSmokeTest: () => Promise<void>;   // Execute test suite
  getAllExamples: () => Promise<ExampleEntity[]>;
  createExample: (data: CreateExampleDto) => Promise<ExampleEntity>;
  updateExample: (id: string, data: UpdateExampleDto) => Promise<ExampleEntity>;
  deleteExample: (id: string) => Promise<void>;
  getExampleById: (id: string) => Promise<ExampleEntity>;
  getExampleCount: () => Promise<number>;
}
```

#### Types

**TestResult**
```typescript
interface TestResult {
  success: boolean;           // All tests passed
  totalSteps: number;         // Total test steps (8)
  completedSteps: number;     // Successfully completed steps
  failedSteps: number;        // Failed steps
  duration: number;           // Total duration in milliseconds
  steps: TestStep[];          // Individual step results
}
```

**TestStep**
```typescript
interface TestStep {
  name: string;                        // Step name
  status: 'pending' | 'running' | 'success' | 'error';
  message: string;                     // Status message
  duration?: number;                   // Step duration in milliseconds
  details?: any;                       // Step result details
}
```

**ExampleEntity**
```typescript
interface ExampleEntity {
  id: string;
  name: string;
  description?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;                  // For soft-deleted records
}
```

## Test Workflow

The `runSmokeTest()` function executes the following 8-step workflow:

1. **Initial Data Load** - Fetch existing records from the database
2. **Create Test Records** - Create 5 test records with unique identifiers
3. **Verify Created Records** - Confirm all records exist in the database
4. **Update Test Record** - Update the description and metadata of one record
5. **Verify Updated Record** - Confirm the update was persisted
6. **Delete Test Record** - Soft delete one test record
7. **Verify Deleted Record** - Confirm the deleted record is no longer accessible
8. **Cleanup Test Data** - Delete remaining test records to restore database state

Each step tracks execution time and captures detailed output for debugging.

## Dependencies

| Package | Purpose |
|---------|---------|
| @mui/material | React component library for UI |
| @emotion/react | CSS-in-JS styling |
| react | React library |
| axios | HTTP client for API calls |

## Files

| File | Purpose |
|------|---------|
| backend-health-check/index.ts | Public exports for health check module |
| backend-health-check/BackendHealthCheck.tsx | React component for health check display |
| backend-health-check/useBackendHealthCheck.ts | React hook for health check logic |
| backend-health-check/types.ts | TypeScript type definitions |
| typeorm-database-client/index.ts | Public exports for database client module |
| typeorm-database-client/TypeormDatabaseClient.tsx | React component for test UI |
| typeorm-database-client/useTypeormDatabaseClient.ts | React hook for test execution |
| typeorm-database-client/types.ts | TypeScript type definitions |

## API Endpoints

Both modules expect the following backend endpoints to exist:

### Health Check
- `GET /health` - Returns backend health status

Response:
```json
{
  "status": "ok",
  "message": "Backend is operational",
  "uptime": "5h 30m",
  "version": "1.0.0"
}
```

### Database Operations
- `GET /examples` - List all records
- `POST /examples` - Create new record
- `GET /examples/:id` - Get record by ID
- `PUT /examples/:id` - Update record
- `DELETE /examples/:id` - Soft delete record
- `GET /examples/meta/count` - Get total record count

## Development Notes

- Both modules use React hooks for state management
- Components are Material-UI based and theme-compatible
- Tests create records with timestamp-based identifiers to avoid conflicts
- Soft delete is assumed for the database (records not permanently removed)
- Auto-refresh intervals are configurable for performance optimization
