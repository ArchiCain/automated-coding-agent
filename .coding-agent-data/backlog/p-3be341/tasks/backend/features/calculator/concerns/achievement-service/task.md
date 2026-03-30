---
id: t-f6b9e1
parent: t-c4a7f1
created: 2026-01-26T16:45:00.000Z
updated: 2026-01-26T16:45:00.000Z
---

# Task: Achievement Service

## Purpose
Implement the AchievementService that manages the achievement system, checks for achievement unlocks after calculations, seeds initial achievements, and provides achievement data for users and administrative purposes.

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
interface AchievementService {
  // Achievement checking and unlocking
  checkAchievements(userId: string, calculation: Calculation, userStats: UserStats): Promise<Achievement[]>;
  unlockAchievement(userId: string, achievementId: string): Promise<void>;

  // Achievement management
  getAllAchievements(): Promise<Achievement[]>;
  getUserAchievements(userId: string): Promise<AchievementDto[]>;
  createAchievement(data: CreateAchievementDto): Promise<Achievement>;

  // System initialization
  seedInitialAchievements(): Promise<void>;

  // Private helpers
  private evaluateAchievementCondition(condition: string, context: AchievementContext): boolean;
}

interface AchievementContext {
  userId: string;
  calculation?: Calculation;
  userStats?: UserStats;
  allCalculations?: Calculation[];
}

// Pre-defined achievements to seed
const INITIAL_ACHIEVEMENTS = [
  {
    name: "First Steps",
    description: "Complete your first calculation",
    icon: "first-calculation",
    condition: JSON.stringify({ type: "calculation_count", value: 1 }),
    sortOrder: 1
  },
  {
    name: "Math Warrior",
    description: "Complete 100 calculations",
    icon: "math-warrior",
    condition: JSON.stringify({ type: "calculation_count", value: 100 }),
    sortOrder: 2
  },
  {
    name: "Speed Demon",
    description: "Get 10 combo multipliers in a row",
    icon: "speed-demon",
    condition: JSON.stringify({ type: "consecutive_combos", value: 10 }),
    sortOrder: 3
  },
  {
    name: "Einstein",
    description: "Perform 50 scientific calculations",
    icon: "einstein",
    condition: JSON.stringify({ type: "scientific_count", value: 50 }),
    sortOrder: 4
  },
  {
    name: "Answer to Everything",
    description: "Get result 42",
    icon: "answer-42",
    condition: JSON.stringify({ type: "specific_result", value: 42 }),
    sortOrder: 5
  },
  {
    name: "Hacker",
    description: "Get result 1337",
    icon: "hacker",
    condition: JSON.stringify({ type: "specific_result", value: 1337 }),
    sortOrder: 6
  }
];
```

### Boundaries
- **Exposes**: Achievement checking logic, achievement data management, user achievement tracking
- **Consumes**: Achievement, UserAchievement, Calculation, and UserStats repositories
- **Constraints**:
  - Must evaluate JSON-based achievement conditions
  - Must track which achievements users have unlocked
  - Must prevent duplicate achievement unlocks (unique constraint handling)
  - Must support various condition types (count-based, result-based, streak-based)
  - Must initialize system with predefined achievements
  - Achievement conditions stored as JSON strings for flexibility

### References
- `app/src/features/theme/services/theme.service.ts` - Service pattern with repository injection
- Calculator entities: Achievement, UserAchievement, Calculation, UserStats

## Specification

### Requirements
- Implement achievement condition evaluation system supporting multiple condition types
- Create initial achievement seeding functionality for system setup
- Manage user achievement unlocks with duplicate prevention
- Provide achievement data for user profiles and leaderboards
- Support flexible JSON-based achievement conditions for future extensibility
- Track achievement unlock timestamps for user history

### Files
- `app/src/features/calculator/services/achievement.service.ts` - Achievement management service implementation

### Implementation Details

#### Achievement Condition System
Support these condition types in JSON format:
- `calculation_count`: Total calculations performed
- `scientific_count`: Scientific calculations performed
- `consecutive_combos`: Consecutive combo multipliers achieved
- `specific_result`: Calculation result equals specific value
- `xp_threshold`: Total XP earned threshold
- `level_reached`: User level achieved

Example condition JSON:
```json
{"type": "calculation_count", "value": 100}
{"type": "specific_result", "value": 42}
{"type": "consecutive_combos", "value": 10}
```

#### Achievement Checking Logic
Called after each calculation with context:
1. Get all achievements user hasn't unlocked yet
2. For each achievement, evaluate its condition against current context
3. Unlock any achievements whose conditions are now met
4. Return newly unlocked achievements

#### Duplicate Prevention
Use try/catch around UserAchievement creation to handle unique constraint violations gracefully.

### Dependencies
- Repository injection for Achievement and UserAchievement entities
- Access to Calculation and UserStats repositories for condition evaluation
- JSON parsing for flexible condition evaluation

### Acceptance Criteria
- [ ] Achievement conditions evaluated from JSON configuration
- [ ] Initial achievements seeded on system startup
- [ ] User achievement unlocks tracked with timestamps
- [ ] Duplicate achievement unlocks prevented
- [ ] Various condition types supported (count, result, streak)
- [ ] Achievement data provided for user profiles
- [ ] All achievements returned for administrative views
- [ ] Service integrates with calculation workflow
- [ ] Achievement unlocks logged for debugging
- [ ] Flexible condition system supports future achievement types