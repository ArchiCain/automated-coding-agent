# Smoke Tests Page — Components

## SmokeTestsPage (`smoke-tests.page.ts`)

The only component on this page.

**Selector:** `app-smoke-tests-page`
**Standalone:** yes
**Change detection:** OnPush
**Location:** `src/app/features/smoke-tests/pages/smoke-tests/`

### State
| Signal | Type | Purpose |
|--------|------|---------|
| `loading` | `signal<boolean>` | True while health check is in flight |
| `health` | `signal<HealthStatus \| null>` | Latest health check result |
| `lastChecked` | `signal<Date \| null>` | When the last check completed |

### Dependencies
| Service | Methods used |
|---------|-------------|
| `HealthService` | `checkHealth()` |

### Template structure
```html
<h1>Smoke Tests</h1>

<mat-card>
  <mat-card-header>
    <mat-card-title>Backend Health</mat-card-title>
  </mat-card-header>
  <mat-card-content>
    <div class="health-row">
      <span class="status-dot" [class]="..."></span>
      <span>{{ health()?.service }}</span>
      <span>{{ health()?.status }}</span>
      <span matTooltip="exact timestamp">{{ relativeTime }}</span>
    </div>
  </mat-card-content>
  <mat-card-actions>
    <button mat-flat-button color="primary" (click)="checkNow()" [disabled]="loading()">
      Check Now
    </button>
    <span class="last-checked">Last checked: {{ lastChecked() | relative }}</span>
  </mat-card-actions>
</mat-card>
```

### Auto-refresh

Use `interval(30000)` with `switchMap` to call `checkHealth()` every 30 seconds. Cancel on component destroy (`takeUntilDestroyed()`).

---

## HealthService (`health.service.ts`)

**Location:** `src/app/features/smoke-tests/services/`
**Provided in:** root

### Methods
| Method | API Call | Returns |
|--------|----------|---------|
| `checkHealth()` | `GET /api/health` | `Observable<HealthStatus>` |

### Types
```typescript
export interface HealthStatus {
  status: string;
  timestamp: string;
  service: string;
}
```
