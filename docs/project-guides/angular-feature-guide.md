# Angular Feature Architecture Guide

This guide documents the feature-based architecture patterns used in the Angular frontend. It covers how to structure features, create reusable components, and maintain consistency across the codebase.

## Table of Contents

1. [Feature Structure](#feature-structure)
2. [Directory Organization](#directory-organization)
3. [Barrel Exports](#barrel-exports)
4. [Component Patterns](#component-patterns)
5. [Service Patterns](#service-patterns)
6. [Models and Types](#models-and-types)
7. [Configuration](#configuration)
8. [Examples](#examples)

---

## Feature Structure

Each feature in the application follows a consistent structure that promotes modularity, reusability, and maintainability.

### Core Principles

1. **Self-contained**: Each feature should be self-contained with its own components, services, models, and configuration
2. **Single responsibility**: Features should focus on a specific domain or capability
3. **Barrel exports**: Use `index.ts` files to expose the feature's public API
4. **Consistent naming**: Follow naming conventions throughout

### Feature Categories

| Category | Purpose | Examples |
|----------|---------|----------|
| **Domain Features** | Business logic and domain-specific functionality | `entities`, `prod`, `claude-code-agent` |
| **Infrastructure Features** | Shared infrastructure capabilities | `local-env` (docker management) |
| **UI Features** | Reusable UI components | `ui-components`, `layout` |

---

## Directory Organization

### Standard Feature Structure

```
features/
├── feature-name/
│   ├── components/           # Presentational and container components
│   │   ├── component-name/
│   │   │   ├── component-name.component.ts
│   │   │   ├── component-name.component.html
│   │   │   └── component-name.component.scss
│   │   └── ...
│   ├── pages/               # Route-level components (optional)
│   │   └── page-name/
│   │       ├── page-name.ts
│   │       ├── page-name.html
│   │       └── page-name.scss
│   ├── services/            # Feature-specific services
│   │   └── feature-name.service.ts
│   ├── models/              # TypeScript interfaces and types
│   │   ├── feature-name.model.ts
│   │   └── ...
│   ├── config/              # Feature configuration (optional)
│   │   └── feature-name.config.ts
│   └── index.ts             # Barrel export
```

### Current Feature Layout

```
app/src/app/features/
├── claude-code-agent/       # Agent management feature
├── entities/                # Entity management feature
├── layout/                  # Application shell (header, nav)
├── local-env/               # Local environment/Docker management
├── prod/                    # Production environment management
└── ui-components/           # Reusable UI components
```

---

## Barrel Exports

Each feature must have an `index.ts` file that exports its public API. This provides:
- Clear public API definition
- Simplified imports for consumers
- Encapsulation of internal implementation

### Pattern

```typescript
// features/feature-name/index.ts

// Models
export * from './models/feature-name.model';

// Config (if applicable)
export * from './config/feature-name.config';

// Services
export { FeatureService } from './services/feature.service';

// Components
export { FeatureComponentA } from './components/component-a/component-a.component';
export { FeatureComponentB } from './components/component-b/component-b.component';
```

### Example: local-env Feature

```typescript
// features/local-env/index.ts

// Models
export * from './models/docker-service.model';
export * from './models/repo.model';
export * from './models/local-env.model';

// Config
export * from './config/docker-services.config';

// Services
export { LocalEnvService } from './services/local-env.service';

// Components
export { DockerControlsBarComponent } from './components/docker-controls-bar/docker-controls-bar.component';
export { DockerServiceCardComponent } from './components/docker-service-card/docker-service-card.component';
export { DockerServicesGridComponent } from './components/docker-services-grid/docker-services-grid.component';
export { RepoCardComponent } from './components/repo-card/repo-card.component';
export { ReposGridComponent } from './components/repos-grid/repos-grid.component';
```

---

## Component Patterns

### Standalone Components

All components should be standalone (Angular 17+):

```typescript
@Component({
  selector: 'app-component-name',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    // ... other imports
  ],
  templateUrl: './component-name.component.html',
  styleUrl: './component-name.component.scss',
})
export class ComponentNameComponent {
  // ...
}
```

### Signals and Inputs/Outputs

Use Angular's signals API for reactive state:

```typescript
@Component({...})
export class DockerServiceCardComponent {
  // Required input using signal
  service = input.required<DockerService>();

  // Optional input with default value
  editorName = input<string>('VS Code');

  // Computed values
  statusClass = computed(() => {
    const status = this.status();
    if (!status) return 'unknown';
    // ...
  });

  // Output events
  onAction = output<DockerServiceActionEvent>();

  // Emit events
  emitAction(action: DockerServiceAction): void {
    this.onAction.emit({ action, service: this.service() });
  }
}
```

### Reusable Component Pattern

Components should be designed for reuse across different contexts:

```typescript
/**
 * Reusable Docker services grid component.
 * Renders docker service cards and handles per-service operations.
 *
 * @example
 * <app-docker-services-grid
 *   [services]="dockerServices"
 *   [statusMap]="dockerStatus()"
 *   [envId]="'prod'"
 *   [editorName]="'VS Code'"
 *   [worktreeRepos]="reposWithWorktrees()"
 *   (onOutput)="handleOutput($event)"
 *   (onLogsRequested)="showLogs($event)"
 * />
 */
@Component({...})
export class DockerServicesGridComponent {
  // Configuration inputs
  services = input.required<DockerService[]>();
  statusMap = input.required<DockerStatusMap>();
  envId = input.required<string>();

  // Optional customization
  editorName = input<string>('VS Code');
  worktreeRepos = input<Set<string>>(new Set());

  // Event outputs for parent handling
  onOutput = output<string>();
  onOperationStart = output<string>();
  onOperationComplete = output<void>();
  onLogsRequested = output<DockerService>();
  onEditorRequested = output<string>();
}
```

---

## Service Patterns

### Feature Service Pattern

Services should be focused and use Angular's inject function:

```typescript
@Injectable({
  providedIn: 'root',
})
export class LocalEnvService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api/local-env`;

  /**
   * Get Docker container status for an environment
   */
  getDockerStatus(envId: string): Observable<DockerStatusMap> {
    return this.http.get<DockerStatusMap>(
      `${this.baseUrl}/${encodeURIComponent(envId)}/docker/status`
    );
  }

  /**
   * Stop all Docker services with streaming output
   */
  stopAll(envId: string, onOutput: (output: string) => void): Promise<void> {
    return this.streamOperation(
      `${this.baseUrl}/${encodeURIComponent(envId)}/docker/stop`,
      onOutput
    );
  }
}
```

### Streaming Operations (SSE)

For long-running operations, use Server-Sent Events:

```typescript
private streamOperation(url: string, onOutput: (output: string) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const eventSource = new EventSource(url);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.output) {
          onOutput(data.output);
        }
        if (data.error) {
          eventSource.close();
          reject(new Error(data.error));
        }
      } catch {
        // Ignore parse errors
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      resolve(); // SSE connection closed - normal completion
    };
  });
}
```

---

## Models and Types

### Model File Organization

Group related types in model files:

```typescript
// models/docker-service.model.ts

/**
 * Docker service configuration
 */
export interface DockerService {
  id: string;
  name: string;
  icon: string;
  port?: number;
  oneShot?: boolean;
  repoName?: string;
  url?: string;
}

/**
 * Docker container status
 */
export interface DockerContainerStatus {
  state: 'running' | 'exited' | 'dead' | 'restarting' | 'created';
  health: 'healthy' | 'unhealthy' | 'starting' | null;
}

/**
 * Map of service ID to container status
 */
export type DockerStatusMap = Record<string, DockerContainerStatus>;

/**
 * Actions that can be performed on a docker service
 */
export type DockerServiceAction =
  | 'start' | 'stop' | 'restart' | 'rebuild'
  | 'logs' | 'editor' | 'install' | 'branch';

/**
 * Event emitted when an action is triggered
 */
export interface DockerServiceActionEvent {
  action: DockerServiceAction;
  service: DockerService;
}
```

---

## Configuration

### Feature Configuration Pattern

Centralize configuration in dedicated files:

```typescript
// config/docker-services.config.ts

export interface DockerServiceConfig {
  id: string;
  name: string;
  icon: string;
  basePort: number;
  dashboardBasePort?: number;
  oneShot?: boolean;
  repoName?: string;
  urlPath?: string;
}

/**
 * Base docker services configuration.
 * Ports are offset based on environment (prod = 0, worktrees = portIndex * 100)
 */
export const DOCKER_SERVICES_CONFIG: DockerServiceConfig[] = [
  { id: 'dynamodb', name: 'DynamoDB', icon: 'table_chart', basePort: 8000, dashboardBasePort: 8001 },
  { id: 'postgres', name: 'Postgres', icon: 'storage', basePort: 5432, dashboardBasePort: 8081 },
  // ... more services
];

/**
 * Compute docker services with environment-specific port offsets
 */
export function computeDockerServices(portOffset: number): DockerService[] {
  return DOCKER_SERVICES_CONFIG.map(config => ({
    id: config.id,
    name: config.name,
    icon: config.icon,
    port: config.basePort > 0 ? config.basePort + portOffset : undefined,
    oneShot: config.oneShot,
    repoName: config.repoName,
    url: computeServiceUrl(config, portOffset),
  }));
}
```

---

## Examples

### Using Feature Components

```typescript
// In a page component
import {
  DockerControlsBarComponent,
  DockerServicesGridComponent,
  LocalEnvService,
  computeDockerServices,
  DockerService,
  DockerStatusMap,
} from '../../../local-env';

@Component({
  imports: [
    DockerControlsBarComponent,
    DockerServicesGridComponent,
  ],
})
export class MyPageComponent {
  private readonly localEnvService = inject(LocalEnvService);

  envId = 'prod';
  dockerStatus = signal<DockerStatusMap>({});
  dockerServices = computed(() => computeDockerServices(0));

  // Handle component outputs
  handleDockerOutput(output: string): void {
    this.slideOverContent.set(output);
  }

  handleDockerOperationStart(title: string): void {
    this.slideOverTitle.set(title);
    this.slideOverOpen.set(true);
  }
}
```

### Template Usage

```html
<!-- Docker controls -->
<app-docker-controls-bar
  [envId]="envId"
  (onOutput)="handleDockerOutput($event)"
  (onOperationStart)="handleDockerOperationStart($event)"
  (onOperationComplete)="handleDockerOperationComplete()"
  (onOperationError)="handleDockerOperationError($event)"
/>

<!-- Docker services grid -->
<app-docker-services-grid
  [envId]="envId"
  [services]="dockerServices()"
  [statusMap]="dockerStatus()"
  [editorName]="getEditorName(preferredEditor())"
  [worktreeRepos]="reposWithWorktrees()"
  [baseBranch]="entityBranch()"
  (onOutput)="handleDockerOutput($event)"
  (onLogsRequested)="handleLogsRequested($event)"
  (onEditorRequested)="handleEditorRequested($event)"
/>
```

---

## Best Practices

### DO

- Use standalone components
- Use signals for reactive state
- Create barrel exports for features
- Document component inputs/outputs with JSDoc
- Keep components focused and single-purpose
- Use computed signals for derived state
- Group related types in model files

### DON'T

- Create deeply nested directory structures
- Put business logic in templates
- Use NgModules for new features
- Import internal feature files directly (use barrel exports)
- Duplicate configuration across features
- Mix UI components with domain components

---

## Migration Checklist

When creating a new feature or refactoring:

- [ ] Create feature directory under `features/`
- [ ] Create subdirectories: `components/`, `services/`, `models/`
- [ ] Create `index.ts` barrel export
- [ ] Define models/interfaces in `models/`
- [ ] Create services in `services/`
- [ ] Create components in `components/`
- [ ] Export public API in `index.ts`
- [ ] Update imports in consuming code
- [ ] Remove old files if migrating
- [ ] Verify TypeScript compilation
