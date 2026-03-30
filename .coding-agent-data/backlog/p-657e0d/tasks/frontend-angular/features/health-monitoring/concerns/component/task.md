---
id: t-c9a1f7
parent: t-f3e8b4
created: 2026-01-26T17:46:00.000Z
updated: 2026-01-26T17:46:00.000Z
---

# Task: Health Status Card Components

## Purpose
Create reusable Material Design status card components for displaying health check results with color-coded indicators, timestamps, and refresh capabilities.

## Context

### Conventions
Follow Angular Material component patterns:
- Standalone components with input/output properties
- Material cards with consistent styling and color themes
- Color-coded status indicators using Material Design colors
- Configurable display options via component inputs
- Event emitters for user interactions (refresh button clicks)

Reference existing patterns:
- `projects/frontend/app/src/features/testing-tools/backend-health-check/BackendHealthCheck.tsx` - Status component structure
- `projects/coding-agent-frontend/app/src/app/features/claude-code-agent/components/agent-card/agent-card.ts` - Angular component patterns

### Interfaces
```typescript
// Component input/output interfaces
interface HealthStatusCardComponent {
  status: HealthStatus | null;
  loading: boolean;
  showTimestamp: boolean;
  showRefreshButton: boolean;
}

interface DatabaseStatusCardComponent {
  status: DatabaseStatus | null;
  loading: boolean;
  showDetails: boolean;
}

// Event emitters
onRefresh: EventEmitter<void>;
onRetry: EventEmitter<void>;
```

### Boundaries
- **Exposes**: Reusable status card components for health monitoring displays
- **Consumes**: HealthStatus and DatabaseStatus types, Material Design components
- **Constraints**: Must support color-coded status, configurable display options, accessibility features

### References
- `projects/frontend/app/src/features/testing-tools/backend-health-check/BackendHealthCheck.tsx` - React component structure to port
- `projects/coding-agent-frontend/app/src/app/features/claude-code-agent/components/agent-card/` - Angular component file structure

## Specification

### Requirements
- **HealthStatusCardComponent**: Display backend health status with status icons, color coding, and optional refresh button
- **DatabaseStatusCardComponent**: Display database connectivity status with connection details and latency information
- Both components must support loading states with Material progress indicators
- Color-coded status using Material theme colors (success: green, error: red, warning: orange)
- Responsive design with consistent card styling
- Accessible design with proper ARIA labels and screen reader support

### Files
- `src/app/features/health-monitoring/components/health-status-card/health-status-card.component.ts` - Backend health status card
- `src/app/features/health-monitoring/components/health-status-card/health-status-card.component.html` - Status card template
- `src/app/features/health-monitoring/components/health-status-card/health-status-card.component.scss` - Status card styles
- `src/app/features/health-monitoring/components/database-status-card/database-status-card.component.ts` - Database status card
- `src/app/features/health-monitoring/components/database-status-card/database-status-card.component.html` - Database card template
- `src/app/features/health-monitoring/components/database-status-card/database-status-card.component.scss` - Database card styles

### Implementation Details
```typescript
// Health Status Card Component
@Component({
  selector: 'app-health-status-card',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './health-status-card.component.html',
  styleUrl: './health-status-card.component.scss'
})

// Component inputs and outputs
@Input() status: HealthStatus | null = null;
@Input() loading = false;
@Input() showTimestamp = true;
@Input() showRefreshButton = true;
@Output() refresh = new EventEmitter<void>();

// Status icon and color mapping methods
getStatusIcon(status: string): string;
getStatusColor(status: string): string;
formatTimestamp(timestamp: string): string;
```

### Status Mapping
```typescript
// Status to icon mapping
'ok' → '✅' (check_circle icon)
'error' → '❌' (error icon)
'warning' → '⚠️' (warning icon)
'unknown' → '❓' (help icon)

// Status to color mapping (Material theme)
'ok' → 'primary' (success green)
'error' → 'warn' (error red)
'warning' → 'accent' (warning orange)
'unknown' → 'basic' (neutral gray)
```

### Acceptance Criteria
- [ ] HealthStatusCardComponent displays status with appropriate icons and colors
- [ ] DatabaseStatusCardComponent shows connection details and latency
- [ ] Both components handle loading states with Material spinners
- [ ] Refresh button emits events properly when clicked
- [ ] Timestamps format correctly in user-friendly format
- [ ] Components are responsive and accessible
- [ ] Card styling is consistent with Material Design patterns
- [ ] Color coding matches Material theme colors