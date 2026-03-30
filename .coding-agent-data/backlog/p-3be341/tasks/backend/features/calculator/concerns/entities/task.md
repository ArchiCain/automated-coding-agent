---
id: t-e7a2b4
parent: t-c4a7f1
created: 2026-01-26T16:45:00.000Z
updated: 2026-01-26T16:45:00.000Z
---

# Task: Calculator Database Entities

## Purpose
Create the four database entities (Calculation, UserStats, Achievement, UserAchievement) for the calculator feature, providing TypeORM models for mathematical calculations, user progress tracking, achievement system, and user achievement relationships.

## Context

### Conventions
Follow the established entity pattern from the codebase:
- All entities extend BaseEntity from `../typeorm-database-client/entities/base.entity.ts`
- Use TypeORM decorators: @Entity, @Column, @Index
- Place entities in `app/src/features/typeorm-database-client/entities/`
- Use `example_schema` schema name
- Follow naming: kebab-case files, PascalCase class names
- Pattern from `example.entity.ts`:
```typescript
@Entity("table_name", { schema: "example_schema" })
export class EntityName extends BaseEntity {
  @Column({ length: 255 })
  propertyName: string;
}
```

### Interfaces
```typescript
// Entities to implement
interface Calculation extends BaseEntity {
  expression: string;        // The math expression (e.g., "2+2*3")
  result: number;           // Calculated result
  userId: string;           // User who performed calculation (from JWT)
  xpEarned: number;        // XP points earned
  operationType: 'simple' | 'complex' | 'scientific';
  timestamp: Date;          // When calculation was performed
  comboMultiplier: number;  // Bonus multiplier (1.0 or 1.5)
}

interface UserStats extends BaseEntity {
  userId: string;           // Unique user identifier (unique index)
  totalXP: number;         // Cumulative XP points
  level: number;           // Current level (calculated from XP)
  calculationsCount: number; // Total calculations performed
  lastActivityAt: Date;    // Last calculation timestamp
}

interface Achievement extends BaseEntity {
  name: string;            // Achievement name ("First Steps")
  description: string;     // Achievement description
  icon: string;           // Icon name/path
  condition: string;      // JSON condition for unlocking
  sortOrder: number;      // Display sort order
}

interface UserAchievement extends BaseEntity {
  userId: string;          // User who unlocked achievement
  achievementId: string;   // Achievement that was unlocked
  unlockedAt: Date;       // When it was unlocked
  // Composite unique constraint on userId + achievementId
}
```

### Boundaries
- **Exposes**: TypeORM entities for the calculator feature
- **Consumes**: BaseEntity for common fields and soft-delete functionality
- **Constraints**:
  - All entities must extend BaseEntity (provides id, createdAt, updatedAt, deletedAt)
  - Use proper TypeORM column types and constraints
  - UserStats.userId must have unique index
  - UserAchievement needs composite unique constraint on userId + achievementId

### References
- `app/src/features/typeorm-database-client/entities/base.entity.ts` - Base entity to extend
- `app/src/features/typeorm-database-client/entities/example.entity.ts` - Entity pattern example
- `app/src/features/typeorm-database-client/entities/user-theme.entity.ts` - Real entity example with unique constraints

## Specification

### Requirements
- Create 4 entity files that extend BaseEntity
- Use appropriate TypeORM column types and decorators
- Add necessary indexes and constraints
- Use `example_schema` for consistency with existing entities
- Export entities from index.ts

### Files
- `app/src/features/typeorm-database-client/entities/calculation.entity.ts` - Calculation records with XP tracking
- `app/src/features/typeorm-database-client/entities/user-stats.entity.ts` - User progress aggregates
- `app/src/features/typeorm-database-client/entities/achievement.entity.ts` - Achievement definitions
- `app/src/features/typeorm-database-client/entities/user-achievement.entity.ts` - User achievement unlock records
- Update `app/src/features/typeorm-database-client/entities/index.ts` - Add exports for new entities

### Acceptance Criteria
- [ ] All entities extend BaseEntity and inherit id, createdAt, updatedAt, deletedAt
- [ ] Calculation entity tracks math expressions and XP earned
- [ ] UserStats entity has unique userId constraint and tracks user progress
- [ ] Achievement entity stores achievement definitions with JSON conditions
- [ ] UserAchievement entity has composite unique constraint on userId + achievementId
- [ ] All entities use proper TypeORM column types (varchar, text, integer, decimal, jsonb, timestamp)
- [ ] Entities are exported from index.ts for easy importing
- [ ] Entity table names follow snake_case convention
- [ ] All entities use `example_schema` schema