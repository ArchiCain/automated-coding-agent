---
id: t-e1a6c7
parent: t-c4a7f1
created: 2026-01-26T16:45:00.000Z
updated: 2026-01-26T16:45:00.000Z
---

# Task: Calculator Module

## Purpose
Create the CalculatorModule that wires together all calculator feature components (controller, services, entities) using NestJS dependency injection and integrates the calculator feature into the main application.

## Context

### Conventions
Follow the established module pattern from the theme feature:
- Use @Module decorator with imports, controllers, providers, exports
- Import TypeOrmModule.forFeature with all entities
- Import KeycloakAuthModule for authentication
- Export services that other modules might need
- Register module in app.module.ts
- Pattern from `theme.module.ts`:
```typescript
@Module({
  imports: [
    TypeOrmModule.forFeature([EntityName]),
    KeycloakAuthModule,
  ],
  controllers: [ControllerName],
  providers: [ServiceName],
  exports: [ServiceName],
})
export class ModuleName {}
```

### Interfaces
```typescript
interface CalculatorModule {
  // Module configuration
  imports: [
    TypeOrmModule.forFeature([Calculation, UserStats, Achievement, UserAchievement]),
    KeycloakAuthModule
  ];
  controllers: [CalculatorController];
  providers: [CalculationService, AchievementService, StatsService];
  exports: [CalculationService]; // For potential use by other features
}
```

### Boundaries
- **Exposes**: Calculator feature as a complete NestJS module
- **Consumes**: TypeORM entities, Keycloak authentication, all calculator services and controller
- **Constraints**:
  - Must register all entities with TypeOrmModule.forFeature
  - Must include KeycloakAuthModule for authentication support
  - Must register all services as providers
  - Must register controller in controllers array
  - Must be imported in app.module.ts to activate the feature

### References
- `app/src/features/theme/theme.module.ts` - Module pattern with TypeORM and auth
- `app/src/app.module.ts` - How modules are imported in main app
- Calculator entities: Calculation, UserStats, Achievement, UserAchievement

## Specification

### Requirements
- Create NestJS module that registers all calculator feature components
- Import TypeORM entities for dependency injection
- Import KeycloakAuthModule for authentication support
- Register controller and services with proper dependency injection
- Export CalculationService for potential cross-feature usage
- Update app.module.ts to import the new calculator module
- Add math.js dependency to package.json

### Files
- `app/src/features/calculator/calculator.module.ts` - Main feature module
- Update `app/src/app.module.ts` - Add CalculatorModule import
- Update `app/package.json` - Add math.js dependency

### Implementation Details

#### Module Configuration
```typescript
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Calculation,
      UserStats,
      Achievement,
      UserAchievement
    ]),
    KeycloakAuthModule,
  ],
  controllers: [CalculatorController],
  providers: [
    CalculationService,
    AchievementService,
    StatsService,
  ],
  exports: [CalculationService],
})
export class CalculatorModule {}
```

#### App Module Integration
Add CalculatorModule to the imports array in app.module.ts alongside existing modules like ThemeModule.

#### Package.json Dependency
Add `"mathjs": "^11.0.0"` to dependencies in app/package.json for safe mathematical expression evaluation.

### Dependencies
- TypeOrmModule for entity registration
- KeycloakAuthModule for authentication
- All calculator entities for database operations
- All calculator services and controller
- math.js package for expression evaluation

### Acceptance Criteria
- [ ] CalculatorModule properly configured with all imports and providers
- [ ] TypeORM entities registered for dependency injection
- [ ] KeycloakAuthModule imported for authentication support
- [ ] CalculatorController registered in module
- [ ] All three services (Calculation, Achievement, Stats) registered as providers
- [ ] CalculationService exported for potential cross-feature use
- [ ] Module imported in app.module.ts to activate feature
- [ ] math.js dependency added to package.json
- [ ] Module follows established naming and structure conventions
- [ ] No circular dependency issues with other modules