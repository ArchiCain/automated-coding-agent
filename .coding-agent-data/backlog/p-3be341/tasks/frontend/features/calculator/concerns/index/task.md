---
id: t-7s8t9u
parent: t-a7b8c9
created: 2026-01-26T16:50:00.000Z
updated: 2026-01-26T16:50:00.000Z
---

# Task: Calculator Exports

## Purpose
Create the main index.ts file that exports all public APIs, components, hooks, and types from the calculator feature following established patterns for clean feature boundaries.

## Context

### Conventions
Follow export patterns established in the codebase:
- Named exports for components, hooks, and APIs
- Export types and interfaces for external consumption
- Organize exports by category (types, components, hooks, services)
- See: `app/src/features/theme/index.ts` - Simple feature exports
- See: `app/src/features/user-management/index.ts` - Complex feature exports

### Interfaces
```typescript
// Feature exports following established patterns
export { CalculatorPage } from './pages/calculator.page';
export { Calculator } from './components/calculator/Calculator';
export { useCalculator } from './hooks/use-calculator';
export { CalculatorApi } from './services/calculator.api';
export type { CalculationResult, UserStats } from './types/calculator.types';
```

### Boundaries
- **Exposes**: Clean public API for the entire calculator feature
- **Consumes**: All internal calculator modules (components, hooks, services, types)
- **Constraints**:
  - Only export public-facing APIs, not internal implementation details
  - Maintain stable API surface for external feature consumption
  - Follow naming conventions established by other features

### References
- `app/src/features/theme/index.ts` - Simple feature export pattern
- `app/src/features/user-management/index.ts` - Comprehensive feature exports
- `app/src/features/api-client/index.ts` - Service export patterns

## Specification

### Requirements
- Export the main CalculatorPage component for routing
- Export reusable calculator components for potential external use
- Export custom hooks for calculator functionality
- Export API services for external integration
- Export TypeScript types and interfaces
- Organize exports by logical categories
- Follow established naming conventions

### Files
- `index.ts` - Main feature export file

### Acceptance Criteria
- [ ] CalculatorPage exported for App.tsx route integration
- [ ] Core calculator components exported (Calculator, ProgressBar, etc.)
- [ ] Custom hooks exported (useCalculator, useGamification, useCalculationHistory)
- [ ] API services exported (CalculatorApi, AchievementsApi, StatsApi)
- [ ] TypeScript interfaces exported for external type checking
- [ ] Exports organized by category with clear commenting
- [ ] Internal implementation details not exposed (e.g., internal helper functions)
- [ ] Export names follow established feature patterns
- [ ] All exported items properly re-exported from their source modules
- [ ] No circular dependencies created by export structure