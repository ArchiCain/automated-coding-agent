# Backlog Feature

This feature provides an API endpoint to read plans from the `.backlog/` directory in the repository root.

## Endpoints

### GET /api/backlog

Returns a list of all plans found in the `.backlog/` directory.

**Response:**

```json
{
  "plans": [
    {
      "id": "plan-uuid",
      "name": "Plan Name",
      "description": "Plan description",
      "status": "active",
      "created": "2025-01-01T00:00:00Z",
      "updated": "2025-01-01T00:00:00Z",
      "tasksCount": 5,
      "featuresCount": 2,
      "projectsCount": 1
    }
  ],
  "total": 1
}
```

## Directory Structure

The feature expects the following structure in `.backlog/`:

```
.backlog/
├── plan-uuid-1/
│   ├── state.json      # Plan metadata (name, description, status, timestamps)
│   └── tasks.jsonl     # Task entries (one JSON object per line)
├── plan-uuid-2/
│   ├── state.json
│   └── tasks.jsonl
└── ...
```

### state.json Format

```json
{
  "name": "Plan Name",
  "description": "What this plan accomplishes",
  "status": "active",
  "created": "2025-01-01T00:00:00Z",
  "updated": "2025-01-01T00:00:00Z",
  "metadata": {
    "featuresCount": 2,
    "projectsCount": 1
  }
}
```

### tasks.jsonl Format

Each line is a separate JSON object representing a task:

```jsonl
{"id": "task-1", "type": "task", "title": "Task title", ...}
{"id": "task-2", "type": "task", "title": "Another task", ...}
```

## Module Structure

```
backlog/
├── index.ts                    # Barrel exports
├── backlog.module.ts           # NestJS module definition
├── controllers/
│   └── backlog.controller.ts   # HTTP endpoint handler
├── services/
│   └── backlog.service.ts      # Business logic for reading .backlog/
└── models/
    └── backlog.model.ts        # TypeScript interfaces
```

## Usage

Import the `BacklogModule` in your app module:

```typescript
import { BacklogModule } from './features/backlog';

@Module({
  imports: [BacklogModule],
})
export class AppModule {}
```
