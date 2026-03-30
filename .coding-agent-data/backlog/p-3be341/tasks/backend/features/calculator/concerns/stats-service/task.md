---
id: t-b7e4a9
parent: t-c4a7f1
created: 2026-01-26T16:45:00.000Z
updated: 2026-01-26T16:45:00.000Z
---

# Task: Stats Service

## Purpose
Implement the StatsService that manages user progress tracking, XP accumulation, level calculations, activity timestamps, and provides leaderboard data for the gamified calculator system.

## Context

### Conventions
Follow the established service pattern from the theme feature:
- Use @Injectable() decorator for NestJS dependency injection
- Inject repositories using @InjectRepository pattern
- Use private readonly properties for dependencies
- Include Logger for debugging and monitoring
- Pattern from `theme.service.ts`:
```typescript
@Injectable()
export class ServiceName {
  private readonly logger = new Logger(ServiceName.name);

  constructor(
    @InjectRepository(EntityName)
    private readonly repository: Repository<EntityName>,
  ) {}
}
```

### Interfaces
```typescript
interface StatsService {
  // User stats management
  getUserStats(userId: string): Promise<UserStatsDto>;
  updateUserStats(userId: string, xpGained: number, operationType: string): Promise<UserStats>;
  createUserStats(userId: string): Promise<UserStats>;

  // Level and XP calculations
  calculateLevelFromXP(xp: number): number;
  calculateXPForNextLevel(currentLevel: number): number;
  checkLevelUp(oldXP: number, newXP: number): { levelUpOccurred: boolean; newLevel?: number };

  // Leaderboard
  getLeaderboard(limit?: number): Promise<LeaderboardEntryDto[]>;

  // Activity tracking
  updateLastActivity(userId: string): Promise<void>;
  getLastActivityTime(userId: string): Promise<Date | null>;

  // Statistics
  getTotalActiveUsers(): Promise<number>;
  getGlobalStats(): Promise<GlobalStatsDto>;
}

// Level calculation formula
function calculateLevelFromXP(xp: number): number {
  return Math.floor(Math.sqrt(xp / 50)) + 1;
}

// XP required for next level
function calculateXPForNextLevel(currentLevel: number): number {
  return Math.pow(currentLevel, 2) * 50;
}
```

### Boundaries
- **Exposes**: User progress tracking, level calculations, leaderboard generation, activity monitoring
- **Consumes**: UserStats repository, Achievement data for user profiles
- **Constraints**:
  - Must create UserStats record on first calculation for new users
  - Must use exponential level progression formula
  - Must update lastActivityAt timestamp for combo multiplier calculation
  - Must aggregate user data for leaderboards (no sensitive data exposure)
  - Must handle concurrent updates to user stats safely
  - Level calculation must be deterministic and consistent

### References
- `app/src/features/theme/services/theme.service.ts` - Service pattern with repository injection
- Calculator entities: UserStats for progress tracking
- Calculation entities for activity timestamp updates

## Specification

### Requirements
- Implement user progress tracking with XP accumulation and level calculations
- Create new UserStats records for first-time users
- Update user statistics after each calculation
- Provide level progression using exponential formula
- Generate leaderboard data without exposing sensitive information
- Track user activity for combo multiplier calculations
- Handle concurrent stat updates safely

### Files
- `app/src/features/calculator/services/stats.service.ts` - User statistics management service implementation

### Implementation Details

#### Level Progression System
- Formula: `level = floor(sqrt(totalXP / 50)) + 1`
- Level 1: 0-49 XP
- Level 2: 50-199 XP
- Level 3: 200-449 XP
- Level 4: 450-799 XP
- And so on...

#### UserStats Management
- Create UserStats on first calculation if doesn't exist
- Use upsert pattern to handle race conditions
- Track: totalXP, level, calculationsCount, lastActivityAt

#### Leaderboard Generation
- Return top users by level, then by XP
- Exclude soft-deleted users
- Anonymize or use display-safe user identifiers
- Limit to prevent performance issues

#### Concurrency Safety
- Use database transactions for stat updates
- Handle race conditions gracefully
- Ensure XP and calculation counts remain consistent

### Dependencies
- Repository injection for UserStats entity
- Database transaction support for atomic updates
- AchievementService integration for complete user profiles

### Acceptance Criteria
- [ ] UserStats created automatically for new users on first calculation
- [ ] XP and calculation counts updated atomically after each calculation
- [ ] Level calculated correctly using exponential progression formula
- [ ] Level-up detection works when XP crosses thresholds
- [ ] LastActivityAt updated for combo multiplier calculations
- [ ] Leaderboard generated efficiently with proper ordering
- [ ] Concurrent stat updates handled safely without data corruption
- [ ] User stats integrated with achievement data for complete profiles
- [ ] Global statistics calculated for system monitoring
- [ ] Service supports high-frequency calculation updates