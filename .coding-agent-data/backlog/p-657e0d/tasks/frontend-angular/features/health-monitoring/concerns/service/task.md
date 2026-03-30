---
id: t-d5e3a8
parent: t-f3e8b4
created: 2026-01-26T17:46:00.000Z
updated: 2026-01-26T17:46:00.000Z
---

# Task: Health Monitoring Service

## Purpose
Create an Angular service that handles HTTP calls to backend health endpoints, provides reactive health status data, and manages error handling for system monitoring functionality.

## Context

### Conventions
Follow Angular 21 service patterns:
- Injectable service with `providedIn: 'root'`
- Use Angular HttpClient with typed responses
- Return observables for reactive programming patterns
- Error handling with proper HTTP error mapping
- Environment-based API URL configuration

Reference existing patterns:
- `projects/coding-agent-frontend/app/src/app/features/claude-code-agent/services/claude-code-agent.service.ts` - Angular service structure
- `projects/frontend/app/src/features/testing-tools/backend-health-check/useBackendHealthCheck.ts` - Health check logic to port

### Interfaces
```typescript
// Service interface
interface HealthMonitoringService {
  checkBackendHealth(): Observable<HealthStatus>;
  checkDatabaseHealth(): Observable<DatabaseStatus>;
  getHealthStatus(): Observable<HealthStatus>;
}

// HTTP response interfaces
interface BackendHealthResponse {
  status: string;
  timestamp: string;
  service: string;
  message?: string;
}

interface DatabaseTestResponse {
  connected: boolean;
  timestamp: string;
  latency?: number;
  error?: string;
}
```

### Boundaries
- **Exposes**: Observable health status data for components to consume
- **Consumes**: Backend health endpoints `/health` and `/database/test`
- **Constraints**: Must handle network errors gracefully, transform backend responses to frontend types

### References
- `projects/backend/app/src/features/health/controllers/health.controller.ts` - Backend endpoint structure
- `projects/frontend/app/src/features/testing-tools/backend-health-check/useBackendHealthCheck.ts` - Health check implementation patterns
- `projects/coding-agent-frontend/app/src/app/features/claude-code-agent/services/claude-code-agent.service.ts` - Angular service patterns

## Specification

### Requirements
- Injectable Angular service for health monitoring API calls
- HTTP methods for checking backend health (`/health` endpoint)
- HTTP methods for checking database connectivity (`/database/test` endpoint)
- Response transformation from backend format to frontend types
- Comprehensive error handling with user-friendly error messages
- Environment configuration for API base URL
- Proper TypeScript typing for all methods and responses

### Files
- `src/app/features/health-monitoring/services/health-monitoring.service.ts` - Main service implementation
- `src/app/features/health-monitoring/services/health-monitoring.service.spec.ts` - Unit tests for service

### Implementation Details
```typescript
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class HealthMonitoringService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl || 'http://localhost:8085';

  // Method signatures to implement
  checkBackendHealth(): Observable<HealthStatus>;
  checkDatabaseHealth(): Observable<DatabaseStatus>;

  // Private helper methods
  private transformHealthResponse(response: BackendHealthResponse): HealthStatus;
  private handleError(error: any): Observable<never>;
}
```

### API Endpoint Mapping
```typescript
// Backend endpoints
GET /health → HealthStatus
GET /database/test → DatabaseStatus

// Response transformation
{
  status: 'ok' | 'error',
  timestamp: string,
  service: string,
  message?: string
} → HealthStatus

{
  connected: boolean,
  timestamp: string,
  latency?: number,
  error?: string
} → DatabaseStatus
```

### Error Handling Strategy
- Network errors → 'Connection failed to backend server'
- 404 errors → 'Health endpoint not available'
- 500 errors → 'Backend server error'
- Timeout errors → 'Request timeout - server may be overloaded'
- Other errors → Generic 'Unable to check system health'

### Acceptance Criteria
- [ ] Service correctly calls backend `/health` endpoint
- [ ] Service correctly calls backend `/database/test` endpoint
- [ ] Response transformation maps backend data to frontend types
- [ ] Error handling provides user-friendly error messages
- [ ] Service is properly injectable and uses environment configuration
- [ ] All methods return proper Observable types
- [ ] Unit tests cover success and error scenarios
- [ ] TypeScript typing is complete and accurate