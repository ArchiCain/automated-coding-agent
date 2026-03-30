---
id: t-b8f2e9
parent: t-f3e8b4
created: 2026-01-26T17:46:00.000Z
updated: 2026-01-26T17:46:00.000Z
---

# Task: Health Monitoring Page Component

## Purpose
Create the main smoke tests page component that displays system health status monitoring with auto-refresh capabilities and manual refresh controls.

## Context

### Conventions
Follow Angular 21 standalone component patterns:
- Standalone component with explicit Material module imports
- Use Angular signals for state management (`signal<T>()`)
- Injectable service dependencies with `inject()` function
- Material cards and typography for layout structure
- RxJS interval observables for auto-refresh with proper cleanup

Reference existing patterns:
- `projects/coding-agent-frontend/app/src/app/features/claude-code-agent/components/agent-card/agent-card.ts` - Component structure and signal usage
- `projects/frontend/app/src/features/testing-tools/pages/SmokeTests.tsx` - Layout and content structure

### Interfaces
```typescript
// Page component interface
interface HealthMonitoringPageComponent {
  autoRefresh: boolean;
  refreshInterval: number;
  showHeader: boolean;
}

// Component state using signals
healthStatus: WritableSignal<HealthStatus | null>;
databaseStatus: WritableSignal<DatabaseStatus | null>;
loading: WritableSignal<boolean>;
lastRefresh: WritableSignal<Date | null>;
```

### Boundaries
- **Exposes**: Smoke tests page component at `/smoke-tests` route
- **Consumes**: HealthMonitoringService for health checks, Angular Material components
- **Constraints**: Must auto-refresh every 30 seconds, display timestamps, provide manual refresh

### References
- `projects/frontend/app/src/features/testing-tools/pages/SmokeTests.tsx` - React page layout to port
- `projects/coding-agent-frontend/app/src/app/features/claude-code-agent/components/agent-card/agent-card.ts` - Angular component patterns

## Specification

### Requirements
- Standalone Angular component with Material UI styling
- Auto-refresh health status every 30 seconds using RxJS interval
- Manual refresh button with loading states
- Display both backend health and database connectivity status
- Responsive layout with Material cards for each status section
- Timestamps for last successful check times
- Error handling with user-friendly messages

### Files
- `src/app/features/health-monitoring/components/health-monitoring-page/health-monitoring-page.component.ts` - Main page component
- `src/app/features/health-monitoring/components/health-monitoring-page/health-monitoring-page.component.html` - Page template
- `src/app/features/health-monitoring/components/health-monitoring-page/health-monitoring-page.component.scss` - Page styles

### Implementation Details
```typescript
// Component imports needed
import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { interval, Subscription } from 'rxjs';

// Signal state management
healthStatus = signal<HealthStatus | null>(null);
databaseStatus = signal<DatabaseStatus | null>(null);
loading = signal<boolean>(false);
error = signal<string | null>(null);
lastRefresh = signal<Date | null>(null);
```

### Acceptance Criteria
- [ ] Page component renders at `/smoke-tests` route
- [ ] Auto-refresh works every 30 seconds with proper cleanup
- [ ] Manual refresh button updates status with loading indicator
- [ ] Health status cards display with Material Design styling
- [ ] Timestamps show last check times in user-friendly format
- [ ] Error states display appropriate user messages
- [ ] Responsive layout works on mobile and desktop