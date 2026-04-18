# Backend Coding Standards

## Module Structure

Each feature is a self-contained NestJS module:

```
features/{feature-name}/
├── {feature-name}.module.ts
├── controllers/
│   └── {feature-name}.controller.ts
├── services/
│   └── {feature-name}.service.ts
├── guards/          # (if applicable)
├── decorators/      # (if applicable)
├── dto/             # (if applicable)
├── entities/        # (if applicable)
└── index.ts         # Barrel export
```

## Naming Conventions

- **Files:** kebab-case (`keycloak-auth.service.ts`)
- **Classes:** PascalCase (`KeycloakAuthService`)
- **Methods:** camelCase (`validateToken`)
- **Constants:** UPPER_SNAKE_CASE (`KEYCLOAK_BASE_URL`)

## Patterns

- **Global guard:** Auth guard applied via `APP_GUARD` — use `@Public()` to opt out
- **Permission guard:** Applied per-route with `@RequirePermission()`
- **DTOs:** Use class-based DTOs for request/response typing
- **Environment:** Access via `process.env` with defaults in module config
- **Error handling:** Let NestJS exception filters handle HTTP errors
- **Soft delete:** All entities use soft delete via `BaseEntity`
