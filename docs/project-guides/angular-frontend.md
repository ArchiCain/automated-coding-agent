# Angular Frontend Project Guide

Template and architecture guide for Angular frontend applications in the monorepo.

## Overview

Angular frontends follow a **feature-based architecture** using **standalone components** (Angular 19+). Features are wired into the application using the `provideFeature()` pattern, similar to how NestJS modules are imported into `AppModule`.

**Key Principles**:
- All application code lives inside `features/`
- Features export `provideFeatureName()` functions for app-level registration
- Routes are lazy-loaded per feature
- Runtime configuration for Docker/ECS deployment

## Technology Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Angular | 19+ | Frontend framework |
| Angular Material | 21+ | UI component library |
| TypeScript | 5.6+ | Type-safe development |
| SCSS | - | Component styling |
| Angular CLI | 19+ | Build tooling |

## Project Structure

```
project-name/
├── app/                              # Application source
│   ├── src/
│   │   ├── app/
│   │   │   ├── app.ts                # Root component
│   │   │   ├── app.html
│   │   │   ├── app.scss
│   │   │   ├── app.config.ts         # Application config (providers)
│   │   │   ├── app.routes.ts         # Root routes with lazy loading
│   │   │   │
│   │   │   └── features/             # All application code lives here
│   │   │       ├── dashboard/        # Example: full-stack feature
│   │   │       ├── auth/             # Example: auth feature (when added)
│   │   │       └── api-client/       # Example: shared feature
│   │   │
│   │   ├── assets/
│   │   │   └── config.json           # Runtime configuration
│   │   │
│   │   ├── main.ts                   # Bootstrap entry point
│   │   ├── index.html
│   │   └── styles.scss               # Global styles + Material theme
│   │
│   ├── angular.json                  # Angular CLI config
│   ├── tsconfig.json
│   ├── tsconfig.app.json
│   ├── tsconfig.spec.json
│   ├── package.json
│   └── nginx.conf                    # Production serving config
│
├── dockerfiles/
│   ├── local.Dockerfile              # Development image
│   └── dev.Dockerfile                # Production image (multi-stage)
│
├── terraform/                        # Infrastructure (uses ecs-service module)
│   └── dev/
│       ├── main.tf
│       ├── variables.tf
│       └── outputs.tf
│
├── docker-compose.yml
├── Taskfile.yml
└── README.md
```

## Feature Architecture

### Feature Types

**Full-Stack Features** - Have user-facing routes (pages):
```
features/dashboard/
├── pages/                            # Routed components
│   └── dashboard/
│       ├── dashboard.ts
│       ├── dashboard.html
│       ├── dashboard.scss
│       └── dashboard.spec.ts
├── components/                       # Feature-specific UI
│   └── stats-card/
│       ├── stats-card.ts
│       ├── stats-card.html
│       └── stats-card.scss
├── services/                         # Business logic
│   └── dashboard.service.ts
├── models/                           # Types and interfaces
│   └── dashboard.model.ts
├── dashboard.routes.ts               # Feature routes
├── dashboard.providers.ts            # Feature providers
└── index.ts                          # Public API (barrel export)
```

**Shared Features** - No pages, provide reusable functionality:
```
features/api-client/
├── services/
│   ├── http-client.service.ts
│   └── websocket.service.ts
├── interceptors/
│   └── error.interceptor.ts
├── models/
│   └── api-response.model.ts
├── api-client.providers.ts           # Feature providers
└── index.ts                          # Public API
```

### Folder Reference

| Folder | Purpose |
|--------|---------|
| `pages/` | Routed components - one per URL (full-stack only) |
| `components/` | UI components used within the feature |
| `services/` | Business logic, API calls, state |
| `models/` | TypeScript interfaces and types |
| `interceptors/` | HTTP interceptors |
| `guards/` | Route guards |
| `*.routes.ts` | Feature route definitions |
| `*.providers.ts` | Feature provider configuration |
| `index.ts` | Public API exports |

## Feature Wiring Pattern

The `provideFeature()` pattern gives NestJS-like ergonomics for wiring features into the application.

### Creating a Feature

**1. Define providers** (`feature.providers.ts`):
```typescript
import { Provider } from '@angular/core';
import { DashboardService } from './services/dashboard.service';

export function provideDashboard(): Provider[] {
  return [
    DashboardService,
    // Add interceptors, guards, etc. as needed
  ];
}
```

**2. Define routes** (`feature.routes.ts`):
```typescript
import { Routes } from '@angular/router';

export const DASHBOARD_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/dashboard/dashboard').then((m) => m.DashboardComponent),
  },
];
```

**3. Export public API** (`index.ts`):
```typescript
// Provider function
export { provideDashboard } from './dashboard.providers';

// Routes
export { DASHBOARD_ROUTES } from './dashboard.routes';

// Models (if needed by other features)
export type { DashboardStats } from './models/dashboard.model';

// Services (if needed by other features)
export { DashboardService } from './services/dashboard.service';
```

### Wiring into the Application

**app.config.ts** - Register feature providers:
```typescript
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

import { routes } from './app.routes';

// Import feature providers
import { provideDashboard } from './features/dashboard';
import { provideApiClient } from './features/api-client';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(),
    provideAnimationsAsync(),

    // Feature providers (like NestJS module imports)
    provideDashboard(),
    provideApiClient(),
  ],
};
```

**app.routes.ts** - Lazy load feature routes:
```typescript
import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadChildren: () =>
      import('./features/dashboard').then((m) => m.DASHBOARD_ROUTES),
  },
  {
    path: 'users',
    loadChildren: () =>
      import('./features/users').then((m) => m.USERS_ROUTES),
  },
];
```

### Comparison to NestJS

| NestJS | Angular |
|--------|---------|
| `@Module({ providers: [...] })` | `provideFeature(): Provider[]` |
| `imports: [AuthModule]` | `provideAuth()` in app.config |
| `AuthModule.forRoot(config)` | `provideAuth(config)` |
| Lazy modules via routing | Lazy routes via `loadChildren` |

## Runtime Configuration

For Docker/ECS deployment, configuration is loaded at runtime from `/assets/config.json`.

### Configuration File

**assets/config.json**:
```json
{
  "apiUrl": "http://localhost:8080",
  "environment": "local"
}
```

### Configuration Service

**features/config/services/config.service.ts**:
```typescript
import { Injectable } from '@angular/core';

export interface AppConfig {
  apiUrl: string;
  environment: string;
}

@Injectable({ providedIn: 'root' })
export class ConfigService {
  private config: AppConfig | null = null;

  async load(): Promise<void> {
    const response = await fetch('/assets/config.json');
    this.config = await response.json();
  }

  get apiUrl(): string {
    return this.config?.apiUrl ?? '';
  }

  get environment(): string {
    return this.config?.environment ?? 'local';
  }
}
```

### App Initialization

**main.ts**:
```typescript
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { ConfigService } from './app/features/config';

async function bootstrap() {
  // Load config before bootstrapping
  const configService = new ConfigService();
  await configService.load();

  bootstrapApplication(App, appConfig)
    .catch((err) => console.error(err));
}

bootstrap();
```

### Docker Configuration

The config file is replaced at container startup based on environment variables:

**dockerfiles/dev.Dockerfile**:
```dockerfile
# Generate config.json from environment variables
RUN echo '#!/bin/sh' > /docker-entrypoint.sh && \
    echo 'cat > /usr/share/nginx/html/assets/config.json << EOF' >> /docker-entrypoint.sh && \
    echo '{"apiUrl": "${API_URL}", "environment": "${ENVIRONMENT}"}' >> /docker-entrypoint.sh && \
    echo 'EOF' >> /docker-entrypoint.sh && \
    echo 'exec nginx -g "daemon off;"' >> /docker-entrypoint.sh && \
    chmod +x /docker-entrypoint.sh

ENTRYPOINT ["/docker-entrypoint.sh"]
```

## Naming Conventions

### File Naming (Angular 19+ Style)

| Type | Convention | Example |
|------|------------|---------|
| Component | `name.ts` | `dashboard.ts` |
| Service | `name.service.ts` | `dashboard.service.ts` |
| Model | `name.model.ts` | `user.model.ts` |
| Guard | `name.guard.ts` | `auth.guard.ts` |
| Interceptor | `name.interceptor.ts` | `error.interceptor.ts` |
| Routes | `name.routes.ts` | `dashboard.routes.ts` |
| Providers | `name.providers.ts` | `dashboard.providers.ts` |

### Directory Naming

- Use **kebab-case**: `user-management`, `api-client`
- Feature names are domain-specific and descriptive
- Page directories match route paths when possible

## Key Patterns

### Standalone Components

```typescript
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-stats-card',
  standalone: true,
  imports: [CommonModule, MatCardModule],
  templateUrl: './stats-card.html',
  styleUrl: './stats-card.scss',
})
export class StatsCardComponent {
  // Component logic
}
```

### Dependency Injection

Use the `inject()` function:
```typescript
import { Component, inject } from '@angular/core';
import { DashboardService } from '../services/dashboard.service';

@Component({ ... })
export class DashboardComponent {
  private dashboardService = inject(DashboardService);

  stats = this.dashboardService.getStats();
}
```

### Services

```typescript
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ConfigService } from '../../config';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private http = inject(HttpClient);
  private config = inject(ConfigService);

  getStats() {
    return this.http.get(`${this.config.apiUrl}/dashboard/stats`);
  }
}
```

## Docker Configuration

### local.Dockerfile (Development)

```dockerfile
FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 4200

CMD ["npm", "run", "start", "--", "--host", "0.0.0.0"]
```

### dev.Dockerfile (Production)

```dockerfile
# Stage 1: Dependencies
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Stage 2: Build
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Stage 3: Production
FROM nginx:alpine AS production

# Copy built assets (Angular outputs to dist/browser)
COPY --from=builder /app/dist/*/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Config injection script
RUN echo '#!/bin/sh' > /docker-entrypoint.sh && \
    echo 'envsubst < /usr/share/nginx/html/assets/config.template.json > /usr/share/nginx/html/assets/config.json' >> /docker-entrypoint.sh && \
    echo 'exec nginx -g "daemon off;"' >> /docker-entrypoint.sh && \
    chmod +x /docker-entrypoint.sh

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost/health || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]
```

### nginx.conf

```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Health check endpoint
    location /health {
        access_log off;
        return 200 'OK';
        add_header Content-Type text/plain;
    }

    # SPA routing - serve index.html for all routes
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
    gzip_min_length 1000;
}
```

### docker-compose.yml

```yaml
services:
  app:
    build:
      context: .
      dockerfile: dockerfiles/local.Dockerfile
    ports:
      - "4200:4200"
    volumes:
      - ./app:/app
      - /app/node_modules
    environment:
      - NODE_ENV=development
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4200"]
      interval: 30s
      timeout: 10s
      retries: 3
```

## Taskfile.yml

```yaml
version: "3"

vars:
  PROJECT_NAME: project-name

tasks:
  # Local Development
  local:install:
    desc: Install dependencies
    dir: app
    cmds:
      - npm ci

  local:run:
    desc: Start development server (outside Docker)
    dir: app
    cmds:
      - npm run start

  local:start:
    desc: Start in Docker
    cmds:
      - docker compose up -d

  local:stop:
    desc: Stop Docker containers
    cmds:
      - docker compose down

  local:logs:
    desc: View container logs
    cmds:
      - docker compose logs -f

  local:test:
    desc: Run unit tests
    dir: app
    cmds:
      - npm run test

  local:build:
    desc: Build for production
    dir: app
    cmds:
      - npm run build

  local:clean:
    desc: Clean build artifacts
    dir: app
    cmds:
      - rm -rf dist .angular node_modules

  # AWS Deployment
  dev:build:
    desc: Build production Docker image
    cmds:
      - docker build -f dockerfiles/dev.Dockerfile -t {{.PROJECT_NAME}}:latest app

  dev:push:
    desc: Push image to ECR
    cmds:
      - aws ecr get-login-password | docker login --username AWS --password-stdin $ECR_URL
      - docker tag {{.PROJECT_NAME}}:latest $ECR_URL/{{.PROJECT_NAME}}:latest
      - docker push $ECR_URL/{{.PROJECT_NAME}}:latest

  dev:deploy:
    desc: Build, push, and update ECS service
    cmds:
      - task: dev:build
      - task: dev:push
      - aws ecs update-service --cluster $ECS_CLUSTER --service {{.PROJECT_NAME}} --force-new-deployment
```

## Terraform (ecs-service module)

Frontend projects use the shared `ecs-service` module:

**terraform/dev/main.tf**:
```hcl
module "frontend" {
  source = "../../../terraform/aws/modules/ecs-service"

  name           = "project-name"
  environment    = "dev"
  ecs_cluster_id = data.terraform_remote_state.global.outputs.ecs_cluster_id
  vpc_id         = data.terraform_remote_state.global.outputs.vpc_id
  subnet_ids     = data.terraform_remote_state.global.outputs.private_subnet_ids

  # Container configuration
  container_port = 80
  cpu            = 256
  memory         = 512

  # DNS
  domain_name        = "app.${var.dns_postfix}.${var.dns_domain_suffix}"
  route53_zone_id    = data.aws_route53_zone.main.zone_id
  alb_listener_arn   = data.terraform_remote_state.global.outputs.alb_https_listener_arn

  # Environment variables for config.json generation
  environment_variables = {
    API_URL     = "https://api.${var.dns_postfix}.${var.dns_domain_suffix}"
    ENVIRONMENT = "dev"
  }

  tags = var.tags
}
```

## Testing

### Unit Tests

Co-located with source files using `.spec.ts`:

```typescript
import { TestBed } from '@angular/core/testing';
import { DashboardComponent } from './dashboard';

describe('DashboardComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(DashboardComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
```

### Running Tests

```bash
# Run all tests
task project-name:local:test

# Watch mode
npm run test -- --watch
```

## Best Practices

### Feature Independence
- Features should be self-contained
- Minimize dependencies between features
- Shared features must NOT depend on full-stack features
- Use barrel exports (`index.ts`) for public APIs

### Component Design
- Keep components focused on single responsibility
- Use `pages/` only for routed components
- Extract reusable UI into `components/`
- Prefer composition over inheritance

### State Management
- Start with services and RxJS
- Use signals for component-level state
- Consider NgRx only for complex global state

### Performance
- Lazy load all full-stack features
- Use `OnPush` change detection where appropriate
- Leverage Angular's built-in optimizations

## Development Workflow

```bash
# Install dependencies
task project-name:local:install

# Start dev server (outside Docker, faster iteration)
task project-name:local:run

# Or start in Docker
task project-name:local:start

# Run tests
task project-name:local:test

# Build and deploy to dev
task project-name:dev:deploy
```

## Related Documentation

- [Feature Architecture](../feature-architecture.md) - Feature-based patterns
- [Project Architecture](../project-architecture.md) - High-level organization
- [Docker](../docker.md) - Container configuration
- [Task Automation](../task-automation.md) - Taskfile commands
- [Terraform](../terraform.md) - Infrastructure deployment
