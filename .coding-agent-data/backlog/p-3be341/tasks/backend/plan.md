---
id: t-a1b2c3
parent: p-3be341
created: 2026-01-26T16:30:00.000Z
updated: 2026-01-26T16:45:00.000Z
---

# Plan: Backend API

## Purpose
Build the NestJS backend API for the Math Quest gamified calculator, providing secure calculation processing, user progress tracking, achievement system, and data persistence. All mathematical operations must be performed server-side with proper validation and XP/level progression.

## Context

### Conventions
Follow the established feature-based architecture pattern:
- Create a new `calculator` feature module in `app/src/features/calculator/`
- Each feature must have its own `.module.ts` file that exports a NestJS module
- Controllers in `controllers/` subdirectory
- Services in `services/` subdirectory
- Entities in `entities/` subdirectory (part of typeorm-database-client)
- DTOs in `dto/` subdirectory
- Module structure pattern:
```typescript
// calculator.module.ts
import { Module } from '@nestjs/common';
@Module({
  controllers: [CalculatorController, StatsController],
  providers: [CalculationService, AchievementService, StatsService],
  exports: [CalculationService], // Export if other features need it
})
export class CalculatorModule {}
```
- Import the CalculatorModule in `app.module.ts`
- Use existing `TypeormGenericCrudService` for database operations
- Follow existing `KeycloakJwtGuard` pattern for authentication

### Interfaces
```typescript
// Calculation request/response
interface CalculateDto {
  expression: string;
  userId: string; // From Keycloak JWT
}

interface CalculationResultDto {
  result: number;
  xpEarned: number;
  levelUpOccurred: boolean;
  newLevel?: number;
  achievementsUnlocked: Achievement[];
  easterEggMessage?: string;
  comboMultiplier: number;
}

// User progress tracking
interface UserStatsDto {
  userId: string;
  totalXP: number;
  level: number;
  calculationsCount: number;
  unlockedAchievements: Achievement[];
}

// Achievement system
interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  condition: string; // JSON describing unlock condition
}
```

### Boundaries
- **Exposes**: REST API endpoints for calculations, user stats, achievements, and history
- **Consumes**: Keycloak JWT tokens for user authentication, math.js library for expression evaluation
- **Constraints**:
  - Must validate all mathematical expressions to prevent code injection
  - All calculations must be performed server-side (never trust client)
  - Must track XP and achievements properly in database
  - Use soft-delete pattern for all data (no hard deletes)

### References
- `app/src/features/health/health.module.ts` - Module pattern to follow
- `app/src/features/theme/theme.module.ts` - TypeORM integration pattern
- `app/src/features/keycloak-auth/` - Authentication patterns and decorators
- `app/src/features/typeorm-database-client/` - Database entity and CRUD patterns
- `app/src/features/typeorm-database-client/entities/base.entity.ts` - Base entity to extend

## API Endpoints Required

### Calculator Operations
- `POST /api/calculator/calculate` - Process mathematical expression and return result with XP
- `GET /api/calculator/history/:userId` - Get user's calculation history
- `DELETE /api/calculator/history/:userId/:calculationId` - Remove calculation from history

### User Progress
- `GET /api/calculator/stats/:userId` - Get user's XP, level, total calculations
- `POST /api/calculator/achievements/check` - Check for newly unlocked achievements
- `GET /api/calculator/achievements` - Get all available achievements
- `GET /api/calculator/achievements/:userId` - Get user's unlocked achievements

## Database Entities Required

### Calculation Entity
```typescript
@Entity('calculations')
class Calculation extends BaseEntity {
  expression: string;
  result: number;
  userId: string;
  xpEarned: number;
  operationType: 'simple' | 'complex' | 'scientific';
  timestamp: Date;
  comboMultiplier: number;
}
```

### UserStats Entity
```typescript
@Entity('user_stats')
class UserStats extends BaseEntity {
  userId: string; // Unique per user
  totalXP: number;
  level: number;
  calculationsCount: number;
  lastActivityAt: Date;
}
```

### Achievement Entity
```typescript
@Entity('achievements')
class Achievement extends BaseEntity {
  name: string;
  description: string;
  icon: string;
  condition: string; // JSON string
  sortOrder: number;
}
```

### UserAchievement Entity
```typescript
@Entity('user_achievements')
class UserAchievement extends BaseEntity {
  userId: string;
  achievementId: string;
  unlockedAt: Date;
  // Composite unique constraint on userId + achievementId
}
```

## Dependencies to Add
- `math.js` - Safe mathematical expression evaluator (prevents eval injection)
- Must add to package.json dependencies

## Security Requirements
- All endpoints must use `@UseGuards(KeycloakJwtGuard)` for authentication
- Validate mathematical expressions using math.js (NO eval() or similar)
- Sanitize user input in expression field
- Rate limiting on calculation endpoint to prevent abuse
- User can only access their own statistics and history

## Business Logic Requirements
- **XP Calculation**: Simple (10), Complex (25), Scientific (50) operations
- **Level Formula**: Exponential progression (level 2 = 100 XP, level 3 = 250 XP, etc.)
- **Combo System**: Rapid calculations within 10 seconds get 1.5x XP multiplier
- **Achievement Checking**: After each calculation, check if new achievements unlocked
- **Easter Eggs**: Special messages for results 42, 69, 420, 1337, 404, 666
- **Operation Classification**: Automatically classify expressions as simple/complex/scientific

## Children

| Name | Path | Description |
|------|------|-------------|
| Calculator Feature | ./features/calculator/plan.md | Complete calculator feature with gamification, XP tracking, achievements, and secure expression evaluation |