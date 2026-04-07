# Skill: Execute

You are operating as an **implementer**. Your job is to read an architect's plan,
implement the specified task, validate your work, and submit a clean PR.

---

## Reading the Plan

Your task context includes a reference to the plan document and your specific task ID.
Before writing any code:

1. Read the full plan document in `docs/plans/` to understand the broader feature.
2. Find your task by ID and read all its fields: role, dependencies, inputs, outputs, validation.
3. Read the input files listed in your task to understand existing code you are building on.
4. If your task depends on other tasks, verify their outputs exist (branches merged, files present).

---

## Implementation Workflow

### Step 1 — Verify Your Environment

```bash
# Confirm you are in the correct worktree
git branch --show-current
pwd

# Ensure you are up to date with main
git fetch origin main
git rebase origin/main

# Install dependencies if needed
npm install
```

### Step 2 — Understand the Context

Read the files you will be modifying or building on:

```bash
# Read related module files
cat src/features/{feature}/index.ts
cat src/features/{feature}/{feature}.module.ts

# Read related entity/service if they exist
cat src/features/{feature}/entities/*.ts
cat src/features/{feature}/{feature}.service.ts
```

### Step 3 — Implement

Follow these patterns based on what you are creating:

**Entity:**
```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('table_name')
export class EntityName {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

**Service:**
```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class FeatureService {
  constructor(
    @InjectRepository(EntityName)
    private readonly repository: Repository<EntityName>,
  ) {}

  async findAll(): Promise<EntityName[]> {
    return this.repository.find();
  }

  async findOneOrFail(id: string): Promise<EntityName> {
    const entity = await this.repository.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException(`EntityName with id ${id} not found`);
    }
    return entity;
  }
}
```

**Controller:**
```typescript
import { Controller, Get, Post, Body, Param, ParseUUIDPipe } from '@nestjs/common';
import { CreateFeatureDto } from './dto/create-feature.dto';

@Controller('feature-name')
export class FeatureController {
  constructor(private readonly service: FeatureService) {}

  @Get()
  async findAll() {
    return this.service.findAll();
  }

  @Post()
  async create(@Body() dto: CreateFeatureDto) {
    return this.service.create(dto);
  }
}
```

**DTO:**
```typescript
import { IsString, IsNotEmpty, MaxLength, IsOptional } from 'class-validator';

export class CreateFeatureDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsString()
  @IsOptional()
  description?: string;
}
```

### Step 4 — Write Tests

Every implementation task includes writing tests for the code you create.

**Unit test pattern:**
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

describe('FeatureService', () => {
  let service: FeatureService;
  let repository: jest.Mocked<Repository<EntityName>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeatureService,
        {
          provide: getRepositoryToken(EntityName),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(FeatureService);
    repository = module.get(getRepositoryToken(EntityName));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
```

**Test file location:** `src/features/{feature}/__tests__/{feature}.service.spec.ts`

### Step 5 — Commit

```bash
# Stage only the files you changed
git add src/features/{feature}/

# Commit with conventional format
git commit -m "feat: add {feature} entity and service

Implements task {task-id} from the {feature} plan.
Creates the entity definition, service with CRUD operations,
and unit tests."
```

---

## Validation Checklist

Before creating your PR, run every applicable gate:

```bash
# TypeScript compilation
npx tsc --noEmit

# Lint
npx eslint 'src/**/*.ts' --max-warnings 0

# Unit tests
npx jest --passWithNoTests

# Build
npm run build
```

Fix any failures. You have 3 attempts per gate.

---

## File Creation Patterns

When creating new files, follow these conventions:

| File Type | Location | Naming |
|-----------|----------|--------|
| Module | `src/features/{name}/{name}.module.ts` | kebab-case |
| Service | `src/features/{name}/{name}.service.ts` | kebab-case |
| Controller | `src/features/{name}/{name}.controller.ts` | kebab-case |
| Entity | `src/features/{name}/entities/{name}.entity.ts` | kebab-case |
| DTO | `src/features/{name}/dto/{action}-{name}.dto.ts` | kebab-case |
| Unit Test | `src/features/{name}/__tests__/{name}.service.spec.ts` | kebab-case |
| Migration | `src/migrations/{timestamp}-{description}.ts` | timestamp prefix |
| Index | `src/features/{name}/index.ts` | barrel export |

Always create an `index.ts` barrel file that exports the module and any public types.

---

## Common Mistakes to Avoid

1. **Forgetting to register providers** — Every service must be in a module's `providers` array.
2. **Forgetting to export** — If another module needs your service, it must be in `exports`.
3. **Missing imports in module** — TypeORM entities need `TypeOrmModule.forFeature([Entity])` in imports.
4. **Not handling errors** — Services should throw appropriate NestJS exceptions.
5. **Circular dependencies** — Use `forwardRef()` only as a last resort. Prefer restructuring.
6. **Large commits** — If your diff exceeds 300 lines, consider splitting into multiple commits.
