---
id: t-c4a7f1
parent: t-a1b2c3
created: 2026-01-26T16:45:00.000Z
updated: 2026-01-26T16:45:00.000Z
---

# Plan: Calculator Feature

## Purpose
Implement the complete calculator feature for the Math Quest gamified calculator backend, providing secure mathematical expression evaluation, user progress tracking with XP/levels, achievement system, and calculation history management.

## Context

### Conventions
Follow the established NestJS feature-based architecture pattern:
- Create feature in `app/src/features/calculator/`
- Use established directory structure: `controllers/`, `services/`, `dto/`
- Database entities in `../typeorm-database-client/entities/` with TypeORM integration
- Module pattern from `theme.module.ts`:
```typescript
@Module({
  imports: [
    TypeOrmModule.forFeature([Calculation, UserStats, Achievement, UserAchievement]),
    KeycloakAuthModule,
  ],
  controllers: [CalculatorController],
  providers: [CalculationService, AchievementService, StatsService],
  exports: [CalculationService],
})
export class CalculatorModule {}
```
- Import module in `app.module.ts`

### Interfaces
```typescript
// Request/Response DTOs
interface CalculateDto {
  expression: string;
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

interface UserStatsDto {
  userId: string;
  totalXP: number;
  level: number;
  calculationsCount: number;
  unlockedAchievements: Achievement[];
}

interface CreateAchievementDto {
  name: string;
  description: string;
  icon: string;
  condition: string; // JSON string
  sortOrder: number;
}

// Database Entities
interface Calculation {
  id: string; // UUID from BaseEntity
  expression: string;
  result: number;
  userId: string; // From JWT
  xpEarned: number;
  operationType: 'simple' | 'complex' | 'scientific';
  timestamp: Date;
  comboMultiplier: number;
}

interface UserStats {
  id: string; // UUID from BaseEntity
  userId: string; // Unique index
  totalXP: number;
  level: number;
  calculationsCount: number;
  lastActivityAt: Date;
}

interface Achievement {
  id: string; // UUID from BaseEntity
  name: string;
  description: string;
  icon: string;
  condition: string; // JSON condition
  sortOrder: number;
}

interface UserAchievement {
  id: string; // UUID from BaseEntity
  userId: string;
  achievementId: string;
  unlockedAt: Date;
  // Composite unique constraint on userId + achievementId
}
```

### Boundaries
- **Exposes**: REST API endpoints for calculator operations, user stats, and achievements
- **Consumes**: Keycloak JWT authentication, math.js for safe expression evaluation, TypeormGenericCrudService for database operations
- **Constraints**:
  - Must use `@UseGuards(KeycloakJwtGuard)` on all endpoints
  - Must use `@KeycloakUser('id')` decorator to extract user ID from JWT
  - All mathematical expressions validated with math.js (NO eval() or Function())
  - User can only access their own data (enforce userId from JWT)
  - Use TypeormGenericCrudService for all database operations
  - All entities must extend BaseEntity for soft-delete support

### References
- `app/src/features/theme/theme.module.ts` - TypeORM integration pattern
- `app/src/features/theme/controllers/theme.controller.ts` - Controller pattern with Swagger docs and authentication
- `app/src/features/theme/services/theme.service.ts` - Service pattern with TypeormGenericCrudService
- `app/src/features/keycloak-auth/decorators/keycloak-user.decorator.ts` - User extraction decorator
- `app/src/features/typeorm-database-client/entities/base.entity.ts` - Base entity to extend
- `app/src/features/typeorm-database-client/services/typeorm-generic-crud.service.ts` - Database CRUD operations

## API Endpoints Required

### Calculator Operations
- `POST /api/calculator/calculate` - Process mathematical expression, return result with XP and achievements
- `GET /api/calculator/history` - Get current user's calculation history with pagination
- `DELETE /api/calculator/history/:calculationId` - Soft-delete calculation from user's history

### User Progress & Stats
- `GET /api/calculator/stats` - Get current user's XP, level, total calculations, achievements
- `GET /api/calculator/leaderboard` - Get top users by level/XP (public data only)

### Achievement System
- `GET /api/calculator/achievements` - Get all available achievements
- `GET /api/calculator/achievements/user` - Get current user's unlocked achievements

## Database Schema

### Entity Files to Create
All entities in `app/src/features/typeorm-database-client/entities/`:

1. **calculation.entity.ts** - Calculation records with XP tracking
2. **user-stats.entity.ts** - User progress aggregates
3. **achievement.entity.ts** - Achievement definitions
4. **user-achievement.entity.ts** - User achievement unlocks

### Entity Relationships
- UserStats: One per userId (unique constraint)
- Calculation: Many per userId, references UserStats
- Achievement: Static data, no user reference
- UserAchievement: Many-to-many join between userId and Achievement

## Business Logic Requirements

### XP Calculation System
```typescript
// Operation type classification (auto-detect from expression)
const XP_VALUES = {
  simple: 10,    // +, -, basic multiplication/division
  complex: 25,   // parentheses, multiple operations, decimals
  scientific: 50 // functions like sin, cos, log, sqrt, pow
};

// Level progression formula: exponential
function calculateLevelFromXP(xp: number): number {
  return Math.floor(Math.sqrt(xp / 50)) + 1;
}

// Combo multiplier: 1.5x if calculation within 10 seconds of previous
```

### Achievement System
Pre-defined achievements to seed database:
- "First Steps" - Complete your first calculation
- "Math Warrior" - Complete 100 calculations
- "Speed Demon" - Get 10 combo multipliers in a row
- "Einstein" - Perform 50 scientific calculations
- "Answer to Everything" - Get result 42
- "Hacker" - Get result 1337

### Easter Eggs
Special messages for specific results: 42, 69, 420, 1337, 404, 666

### Security Requirements
- Validate all expressions using math.js parser (prevents injection)
- Rate limiting: max 60 calculations per minute per user
- User isolation: enforce userId from JWT, no cross-user data access
- Input sanitization: trim and validate expression length (max 1000 chars)

## Dependencies to Add
- `math.js` - Safe mathematical expression evaluator
- Must add to `app/package.json` dependencies

## Implementation Structure

### Controllers
1. **CalculatorController** - `/api/calculator/*` endpoints
   - calculate, history, leaderboard

### Services
1. **CalculationService** - Core calculation logic and history
2. **AchievementService** - Achievement checking and management
3. **StatsService** - User stats tracking and level calculations

### DTOs
1. **calculate.dto.ts** - Request validation
2. **calculation-result.dto.ts** - Response format
3. **user-stats.dto.ts** - Stats response format
4. **achievement.dto.ts** - Achievement response format

## Children

| Name | Path | Description |
|------|------|-------------|
| Database Entities | ./concerns/entities/task.md | TypeORM entities for calculations, user stats, achievements, and user achievement tracking |
| DTOs | ./concerns/dto/task.md | Request validation and response formatting DTOs for API endpoints |
| Calculation Service | ./concerns/calculation-service/task.md | Core mathematical expression evaluation, XP calculation, and history management |
| Achievement Service | ./concerns/achievement-service/task.md | Achievement system management, condition evaluation, and unlocking logic |
| Stats Service | ./concerns/stats-service/task.md | User progress tracking, level calculations, and leaderboard generation |
| Controller | ./concerns/controller/task.md | REST API endpoints with authentication, validation, and Swagger documentation |
| Module | ./concerns/module/task.md | NestJS module configuration and app integration |
| Tests | ./concerns/test/task.md | Unit tests for business logic and service functionality |
