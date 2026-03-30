---
id: t-a8c5d2
parent: t-c4a7f1
created: 2026-01-26T16:45:00.000Z
updated: 2026-01-26T16:45:00.000Z
---

# Task: Calculation Service

## Purpose
Implement the core CalculationService that handles mathematical expression evaluation, XP calculation, operation type classification, combo multiplier logic, and calculation history management using math.js for secure expression parsing.

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
interface CalculationService {
  // Core calculation method
  calculateExpression(userId: string, expression: string): Promise<CalculationResultDto>;

  // History management
  getUserCalculationHistory(userId: string, limit?: number, offset?: number): Promise<CalculationHistoryDto[]>;
  deleteCalculation(userId: string, calculationId: string): Promise<void>;

  // Helper methods
  classifyOperationType(expression: string): 'simple' | 'complex' | 'scientific';
  calculateXP(operationType: string): number;
  checkComboMultiplier(userId: string): Promise<number>;
  detectEasterEgg(result: number): string | null;
}

// XP and level calculation
const XP_VALUES = {
  simple: 10,    // +, -, basic */
  complex: 25,   // parentheses, multiple operations, decimals
  scientific: 50 // sin, cos, log, sqrt, pow, etc.
};

function calculateLevelFromXP(xp: number): number {
  return Math.floor(Math.sqrt(xp / 50)) + 1;
}
```

### Boundaries
- **Exposes**: Core calculation logic, history management, XP calculations
- **Consumes**: math.js for expression evaluation, Calculation and UserStats repositories, AchievementService and StatsService
- **Constraints**:
  - Must use math.js parser for ALL expression evaluation (NO eval() or Function())
  - Must validate expression length (max 1000 characters)
  - Must enforce user data isolation (userId from JWT)
  - Must calculate combo multiplier (1.5x if within 10 seconds of last calculation)
  - Must track operation types for proper XP allocation
  - Must use repository pattern for database operations

### References
- `app/src/features/theme/services/theme.service.ts` - Service pattern with repository injection
- Math.js documentation for safe expression evaluation
- Calculator entities: Calculation, UserStats for repository operations

## Specification

### Requirements
- Implement secure mathematical expression evaluation using math.js
- Classify operation types (simple/complex/scientific) for appropriate XP rewards
- Calculate combo multipliers based on timing between calculations
- Manage calculation history with pagination support
- Detect easter egg results and return special messages
- Integrate with StatsService for user progress updates
- Integrate with AchievementService for achievement checking

### Files
- `app/src/features/calculator/services/calculation.service.ts` - Core calculation service implementation

### Implementation Details

#### Expression Evaluation
```typescript
import { evaluate } from 'mathjs';

// Safe evaluation - math.js prevents code injection
try {
  const result = evaluate(sanitizedExpression);
} catch (error) {
  throw new BadRequestException('Invalid mathematical expression');
}
```

#### Operation Type Classification
- **Simple**: Basic arithmetic (+, -, *, /, ^, %)
- **Complex**: Parentheses, multiple operations, decimal numbers, negative numbers
- **Scientific**: Functions like sin, cos, tan, log, ln, sqrt, abs, floor, ceil, round

#### Combo Multiplier Logic
- Check UserStats.lastActivityAt
- If current calculation within 10 seconds of last: multiplier = 1.5
- Otherwise: multiplier = 1.0
- Update lastActivityAt after each calculation

#### Easter Egg Detection
Special messages for results: 42 ("The Answer to Everything"), 69 ("Nice"), 420 ("Blazing"), 1337 ("Elite Hacker"), 404 ("Not Found"), 666 ("Devilish")

### Dependencies
- Repository injection for Calculation and UserStats entities
- AchievementService for checking unlocked achievements
- StatsService for updating user progress
- math.js package for expression evaluation (needs to be added to package.json)

### Acceptance Criteria
- [ ] Expressions evaluated safely using math.js (no eval() or Function())
- [ ] Expression length validated (max 1000 characters)
- [ ] Operation types correctly classified for XP calculation
- [ ] Combo multiplier calculated based on timing between calculations
- [ ] Calculation history stored with proper user isolation
- [ ] Easter egg messages returned for special results
- [ ] Service integrates with AchievementService and StatsService
- [ ] Pagination supported for calculation history
- [ ] Soft-delete used for calculation removal
- [ ] All database operations use injected repositories