---
id: t-1a2b3c
parent: t-a7b8c9
created: 2026-01-26T16:50:00.000Z
updated: 2026-01-26T16:50:00.000Z
---

# Task: Calculator Types

## Purpose
Define comprehensive TypeScript interfaces and types for the calculator feature, including calculation results, user statistics, achievements, and API contracts.

## Context

### Conventions
Follow TypeScript interface patterns established in the codebase:
- Interface names use PascalCase
- Properties are camelCase
- Optional properties marked with `?`
- Export all interfaces for external consumption
- See: `app/src/features/user-management/types.ts` for similar pattern
- See: `app/src/features/theme/theme.api.ts` for API interface pattern

### Interfaces
```typescript
// Core types specified in parent task
interface CalculationResult {
  result: number;
  xpEarned: number;
  levelUpOccurred: boolean;
  newLevel?: number;
  achievementsUnlocked: Achievement[];
  easterEggMessage?: string;
  comboMultiplier: number;
}

interface UserStats {
  userId: string;
  totalXP: number;
  level: number;
  calculationsCount: number;
  unlockedAchievements: Achievement[];
}

interface Calculation {
  id: string;
  expression: string;
  result: number;
  timestamp: Date;
  xpEarned: number;
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt?: Date;
}
```

### Boundaries
- **Exposes**: All TypeScript interfaces and types for calculator feature
- **Consumes**: Nothing (pure type definitions)
- **Constraints**: Must be compatible with backend API contract specifications

### References
- `app/src/features/user-management/types.ts` - Feature-specific types pattern
- `app/src/features/theme/theme.api.ts` - API interface definitions
- `app/src/features/api-client/api-client.ts` - HTTP client types for request/response

## Specification

### Requirements
- Define all core data interfaces for calculations, achievements, and user progress
- Create API request/response types for calculator endpoints
- Define UI component prop interfaces
- Create enums for calculator modes and operations
- Include proper JSDoc comments for complex interfaces

### Files
- `types/calculator.types.ts` - Complete TypeScript interface definitions

### Acceptance Criteria
- [ ] Core data interfaces defined: CalculationResult, UserStats, Calculation, Achievement
- [ ] API request/response interfaces for all calculator endpoints
- [ ] Calculator UI component prop interfaces (display, keypad, modal props)
- [ ] Calculator mode enum (basic, scientific)
- [ ] Operation type enum for mathematical functions
- [ ] Particle effect and animation configuration types
- [ ] History pagination and filtering types
- [ ] All interfaces properly exported
- [ ] JSDoc documentation for complex interfaces
- [ ] Consistent naming following camelCase convention