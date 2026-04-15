# Feature Architecture

Internal code organization pattern for application development in the template.

## Overview

Application projects follow a **feature-based architecture** to create consistent, scalable code organization for frontend and backend applications (React, NestJS, FastAPI, etc.).

**Key Principle**: All application code lives inside `features/`. There are no separate `pages/` or `endpoints/` directories at the project root.

> **Note**: Infrastructure code (Terraform) uses a separate atomic/composite pattern documented in the [Terraform Guide](terraform.md).

## Core Structure

```
src/
└── features/
    ├── auth/                  # Complete authentication feature
    ├── user-dashboard/        # Dashboard feature with pages
    ├── api-client/            # Shared HTTP client feature
    ├── ui-components/         # Shared design system
    └── document-upload/       # Document handling feature
```

### Feature Types

Features fall into two categories:

#### 1. Full-Stack Features
**Complete features with user-facing interfaces:**
- Frontend: Contains pages, components, hooks, and services
- Backend: Contains endpoints (controllers), services, entities, and guards
- Represents a complete user-facing capability
- Example: `auth`, `user-dashboard`, `document-upload`

#### 2. Shared Features
**Reusable utilities without pages/endpoints:**
- Provides common functionality used by other features
- No direct user interface
- Contains components, services, utilities, or clients
- Example: `api-client`, `ui-components`, `database-client`, `s3-storage`

## Technology Examples

### React Frontend

```
src/
└── features/
    ├── user-dashboard/          # Full-stack feature
    │   ├── pages/
    │   │   ├── dashboard.page.tsx
    │   │   └── profile.page.tsx
    │   ├── components/
    │   │   └── UserCard.tsx
    │   └── hooks/
    │       └── useUserData.ts
    ├── auth/                    # Full-stack feature
    │   ├── pages/
    │   │   └── login.page.tsx
    │   ├── components/
    │   │   ├── LoginForm.tsx
    │   │   └── ProtectedRoute.tsx
    │   ├── hooks/
    │   │   └── useAuth.ts
    │   └── services/
    │       └── auth.api.ts
    ├── document-upload/         # Full-stack feature
    │   ├── pages/
    │   │   └── upload.page.tsx
    │   ├── components/
    │   │   └── UploadWidget.tsx
    │   └── hooks/
    │       └── useUpload.ts
    ├── api-client/              # Shared feature
    │   └── http-client.ts
    └── ui-components/           # Shared feature
        ├── Button.tsx
        ├── TextField.tsx
        └── Modal.tsx
```

### NestJS Backend

```
src/
└── features/
    ├── auth/                    # Full-stack feature
    │   ├── controllers/
    │   │   └── auth.controller.ts
    │   ├── services/
    │   │   └── auth.service.ts
    │   ├── guards/
    │   │   └── jwt.guard.ts
    │   ├── decorators/
    │   │   └── public.decorator.ts
    │   └── auth.module.ts
    ├── users/                   # Full-stack feature
    │   ├── controllers/
    │   │   └── users.controller.ts
    │   ├── services/
    │   │   └── users.service.ts
    │   ├── entities/
    │   │   └── user.entity.ts
    │   └── users.module.ts
    ├── document-processing/     # Full-stack feature
    │   ├── controllers/
    │   │   └── documents.controller.ts
    │   ├── services/
    │   │   └── document-processor.service.ts
    │   ├── entities/
    │   │   └── document.entity.ts
    │   └── document-processing.module.ts
    ├── database-client/         # Shared feature
    │   ├── typeorm-config.ts
    │   ├── migrations/
    │   └── database-client.module.ts
    └── s3-storage/              # Shared feature
        ├── s3-client.ts
        └── s3-storage.module.ts
```

## Key Principles

### Everything is a Feature
- **No top-level `pages/` or `endpoints/` directories**: All code lives in features
- **Feature contains everything**: Pages, endpoints, components, services, tests
- **Clear feature boundaries**: Each feature owns its complete functionality
- **Easy to reason about**: Look in one place for all code related to a feature

### Feature Independence
- **Feature → Feature**: ✅ Minimal coupling preferred
- **Feature → External**: ✅ Well-defined interfaces
- **Avoid Deep Dependencies**: Features should be largely self-contained

### Consistent Patterns
- Same structure across frontend and backend applications
- Predictable organization reduces cognitive load
- Easy team onboarding with familiar patterns
- Clear distinction between full-stack and shared features

### Complete Functionality
- Each feature provides a complete, usable capability
- Clear responsibility boundaries at the feature level
- Independent testing, deployment, and maintenance
- Features can be easily extracted to separate libraries

## Feature Organization Guidelines

### Frontend Feature Structure

**Full-Stack Feature:**
```
features/feature-name/
├── pages/                  # Route-level components
│   └── feature.page.tsx
├── components/             # Feature-specific components
│   ├── ComponentA.tsx
│   └── ComponentB.tsx
├── hooks/                  # Feature-specific hooks
│   └── useFeature.ts
├── services/               # API clients and business logic
│   └── feature.api.ts
├── types/                  # TypeScript interfaces
│   └── types.ts
└── index.ts                # Public exports
```

**Shared Feature:**
```
features/feature-name/
├── components/             # Reusable components
│   └── Button.tsx
├── hooks/                  # Reusable hooks
│   └── useTheme.ts
├── utils/                  # Helper functions
│   └── formatters.ts
└── index.ts                # Public exports
```

### Backend Feature Structure

**Full-Stack Feature:**
```
features/feature-name/
├── controllers/            # API route controllers
│   └── feature.controller.ts
├── services/               # Business logic
│   └── feature.service.ts
├── entities/               # Database models
│   └── feature.entity.ts
├── dto/                    # Data transfer objects
│   ├── create-feature.dto.ts
│   └── update-feature.dto.ts
├── guards/                 # Authorization guards
│   └── feature.guard.ts
├── decorators/             # Custom decorators
│   └── feature.decorator.ts
├── feature.module.ts       # NestJS module (REQUIRED)
└── index.ts                # Public exports
```

**Shared Feature:**
```
features/feature-name/
├── services/               # Shared services
│   └── client.service.ts
├── utils/                  # Helper functions
│   └── helpers.ts
├── types/                  # TypeScript interfaces
│   └── types.ts
├── feature.module.ts       # NestJS module (REQUIRED)
└── index.ts                # Public exports
```

#### NestJS Module Pattern (IMPORTANT)

**Every backend feature MUST have its own module.** The `app.module.ts` should ONLY import feature modules, never individual controllers or providers directly.

**✅ Correct Pattern:**
```typescript
// features/health/health.module.ts
import { Module } from "@nestjs/common";
import { HealthController } from "./controllers/health.controller";
import { HealthService } from "./services/health.service";

@Module({
  controllers: [HealthController],
  providers: [HealthService],
  exports: [HealthService], // Export if other features need it
})
export class HealthModule {}

// features/health/index.ts
export { HealthModule } from "./health.module";

// app.module.ts
import { HealthModule } from "./features/health";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    HealthModule,  // ✅ Import feature module
    // ... other feature modules
  ],
})
export class AppModule {}
```

**❌ Incorrect Pattern:**
```typescript
// app.module.ts
import { HealthController } from "./features/health/controllers/health.controller";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
  ],
  controllers: [HealthController], // ❌ Never import controllers directly
})
export class AppModule {}
```

**Benefits of Module-Per-Feature:**
- **Encapsulation**: Each feature manages its own dependencies
- **Clean app.module**: Just a list of feature modules
- **Easier refactoring**: Move entire features by moving one directory
- **Testability**: Each module can be tested in isolation
- **Standard NestJS pattern**: Follows framework best practices

## Migration from Old Structure

### Before (Old Package Architecture)
```
src/
├── pages/                  # ❌ Separate from features
│   ├── login.tsx
│   └── dashboard.tsx
├── endpoints/              # ❌ Separate from features
│   └── auth.controller.ts
└── packages/
    ├── auth/
    └── api-client/
```

### After (New Feature Architecture)
```
src/
└── features/
    ├── auth/               # ✅ Contains pages + logic
    │   ├── pages/
    │   │   └── login.page.tsx
    │   └── services/
    ├── dashboard/          # ✅ Contains pages + components
    │   ├── pages/
    │   │   └── dashboard.page.tsx
    │   └── components/
    ├── auth-api/           # ✅ Contains controllers + services
    │   ├── controllers/
    │   │   └── auth.controller.ts
    │   ├── services/
    │   └── auth.module.ts
    └── api-client/         # ✅ Shared feature
        └── http-client.ts
```

## Decomposition Model

The feature architecture aligns with a 3-stage decomposition model used for planning and task execution:

### Stage 1: Projects
High-level conceptual groupings of work
- Example: "Frontend Authentication", "Backend API", "Database Schema"

### Stage 2: Features
Discrete units of code (what this architecture defines)
- Each feature is either full-stack (with pages/endpoints) or shared (utilities)
- Example: `auth` feature, `user-dashboard` feature, `api-client` feature

### Stage 3: Atomic Tasks
Individual implementable tasks within a feature
- Example: "Create AuthContext", "Add login endpoint", "Write tests"

This alignment makes it easy to decompose work from high-level plans down to executable tasks.

## Benefits

- **Clarity**: Single concept (features) instead of packages/pages/endpoints
- **Co-location**: Related code lives together regardless of type
- **Portability**: Features can be easily moved between projects or extracted as libraries
- **Maintainability**: Clear feature boundaries and complete ownership
- **Scalability**: Easy to add new features without affecting existing ones
- **Testability**: Self-contained features can be tested independently
- **Faster Development**: No decisions about where code belongs
- **Less Confusion**: "Feature" is more descriptive than "package" and doesn't conflict with npm packages

## Best Practices

### Feature Naming
- Use descriptive, domain-specific names
- Use kebab-case for directories: `user-dashboard`, `api-client`
- Frontend pages: suffix with `.page.tsx` (e.g., `login.page.tsx`)
- Backend endpoints: use `.controller.ts` (e.g., `auth.controller.ts`)

### Feature Size
- Keep features focused on a single domain concept
- Split large features into smaller, related features
- Prefer multiple small features over one large feature
- Extract shared code into separate shared features

### Feature Dependencies
- Minimize dependencies between features
- Shared features should not depend on full-stack features
- Document feature dependencies clearly
- Use dependency injection for loose coupling

### Testing Strategy
- Co-locate tests with feature code
- Unit tests: `*.spec.ts` or `*.test.tsx`
- Integration tests: `*.integration.spec.ts`
- Test features independently where possible

## Implementation Guidelines

For detailed implementation patterns:

| Technology | Guide |
|-----------|-------|
| **React Applications** | [Adding Frontends](../development/adding-frontends.md) |
| **Backend Services** | [Adding Microservices](../development/adding-microservices.md) |
| **Infrastructure Modules** | [Terraform Guide](terraform.md) |

## Related Documentation

- **Project Architecture**: [Project Architecture](project-architecture.md) - High-level organizational patterns
- **Testing**: [Testing](testing.md) - Testing patterns for features
- **Task Automation**: [Task Automation](task-automation.md) - Standardized workflows
- **Environment Configuration**: [Environment Configuration](environment-configuration.md) - Configuration management

---

This feature-based approach creates predictable, maintainable application codebases that are easy to understand and extend. By organizing all code into features, the architecture provides a single, consistent mental model for both developers and AI agents.
