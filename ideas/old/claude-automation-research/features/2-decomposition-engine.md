# Decomposition Engine Specification

The decomposition engine transforms high-level user requests into atomic, executable tasks with clear dependencies and acceptance criteria.

## Core Responsibility

> Take a vague "build me X" request and produce a DAG of small, verifiable tasks that the execution engine can run.

---

## Input Types

### 1. Free-form Text
```
"Add user authentication with email/password login, JWT tokens,
and password reset via email"
```

### 2. Text + Attachments
- Screenshots (UI mockups, error messages)
- Files (API specs, design docs)
- URLs (reference implementations, docs)

### 3. Template-based
```
Template: crud-feature
Variables:
  entity_name: Product
  fields: [name:string, price:number, description:text]
```

---

## Decomposition Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      USER INPUT                              │
│  (text + attachments + optional template selection)         │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   CONTEXT GATHERING                          │
│  ─────────────────────────────────────────────────────────  │
│  • Load project config (.rtslabs/config.json)               │
│  • Load memory (patterns, gotchas)                          │
│  • Analyze project structure (if not cached)                │
│  • Identify relevant existing code                          │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  TEMPLATE MATCHING                           │
│  ─────────────────────────────────────────────────────────  │
│  • If user selected template → use it                       │
│  • Else → LLM suggests matching template (or none)          │
│  • Extract variables from request if template matched       │
└─────────────────────────────┬───────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              │                               │
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────────┐
│   TEMPLATE INSTANTIATE  │     │     LLM DECOMPOSITION       │
│  ─────────────────────  │     │  ─────────────────────────  │
│  • Substitute variables │     │  • Generate initial tasks   │
│  • Generate task IDs    │     │  • Infer dependencies       │
│  • Apply project context│     │  • Generate acceptance      │
└────────────┬────────────┘     └──────────────┬──────────────┘
             │                                  │
             └───────────────┬─────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                   DEPENDENCY ANALYSIS                        │
│  ─────────────────────────────────────────────────────────  │
│  • Build dependency graph                                   │
│  • Detect cycles (error if found)                           │
│  • Identify parallel execution groups                       │
│  • Flag missing dependencies                                │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   ATOMIC ASSESSMENT                          │
│  ─────────────────────────────────────────────────────────  │
│  • LLM evaluates each task for atomicity                    │
│  • Mark tasks as atomic: true/false                         │
│  • Non-atomic tasks flagged for potential decomposition     │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    HUMAN REVIEW                              │
│  ─────────────────────────────────────────────────────────  │
│  • Present task tree in UI                                  │
│  • Human can:                                               │
│    - Accept as-is                                           │
│    - Click "Decompose" on any task                          │
│    - Edit task details                                      │
│    - Add/remove tasks                                       │
│    - Modify dependencies                                    │
└─────────────────────────────┬───────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
              [Decompose]          [Accept]
                    │                   │
                    ▼                   ▼
        ┌───────────────────┐   ┌───────────────────┐
        │  RECURSIVE DECOMP │   │  FINALIZE PLAN    │
        │  (for selected    │   │  • All tasks      │
        │   task only)      │   │    marked atomic  │
        │  ─────────────    │   │  • Write to       │
        │  Loop back to     │   │    tasks.jsonl    │
        │  LLM Decomposition│   │  • Ready for      │
        └───────────────────┘   │    execution      │
                                └───────────────────┘
```

---

## Key Components

### 1. Context Gatherer

Builds the context that informs decomposition.

**Inputs:**
- Project path
- User request
- Attachments

**Outputs:**
```typescript
interface DecompositionContext {
  project: {
    name: string;
    stack: string[];           // ['nestjs', 'typeorm', 'postgresql']
    testFramework: string;     // 'jest'
    structure: FileTree;       // Key directories and files
  };
  memory: {
    patterns: Pattern[];       // Relevant patterns for this project
    gotchas: Gotcha[];         // Known pitfalls
  };
  relevantFiles: {
    path: string;
    summary: string;           // LLM-generated summary
  }[];
  existingTemplates: Template[];
}
```

**Implementation notes:**
- Cache project analysis (invalidate on significant changes)
- Use cheap model for file summaries
- Limit relevant files to ~10 most pertinent

---

### 2. Template Matcher

Determines if a template applies and extracts variables.

**Process:**
1. If user selected template → use it
2. Else, present request + available templates to LLM
3. LLM returns: `{ matched: boolean, template?: string, confidence: number }`
4. If confidence > threshold → suggest template to user
5. User confirms or rejects

**Variable Extraction:**
```typescript
interface VariableExtraction {
  template: string;
  variables: Record<string, any>;
  confidence: number;
  ambiguities: {
    variable: string;
    options: string[];
    question: string;  // Ask user to clarify
  }[];
}
```

**Example:**
```
Request: "Create CRUD for products with name, price, and inventory count"

Extraction:
  template: crud-feature
  variables:
    entity_name: "Product"
    fields: ["name:string", "price:number", "inventoryCount:number"]
  confidence: 0.95
  ambiguities: []
```

---

### 3. LLM Decomposer

Core decomposition logic when no template matches or for custom requests.

**Prompt Structure:**
```
## Task
Decompose the following request into implementation tasks.

## Request
{user_request}

## Attachments
{attachment_summaries}

## Project Context
- Stack: {stack}
- Patterns: {relevant_patterns}
- Existing code: {relevant_file_summaries}

## Requirements
1. Break into 3-7 tasks (prefer smaller number)
2. Each task should be completable in one coding session
3. Include clear acceptance criteria for each task
4. Identify dependencies between tasks
5. Tasks should be independently testable

## Output Format
Return JSON array of tasks...
```

**Output Schema:**
```typescript
interface DecomposedTask {
  title: string;
  description: string;
  acceptance_criteria: string;
  estimated_complexity: 'trivial' | 'simple' | 'moderate' | 'complex';
  depends_on: string[];  // References by title (resolved to IDs later)
  suggested_files: string[];  // Files likely to be created/modified
  test_strategy: string;  // How this task will be verified
}
```

---

### 4. Dependency Analyzer

Validates and enriches the dependency graph.

**Responsibilities:**
- Convert title-based references to task IDs
- Detect cycles (error)
- Detect orphans (tasks with unresolvable dependencies)
- Infer implicit dependencies (e.g., migration depends on entity)
- Calculate execution levels for parallelism

**Output:**
```typescript
interface DependencyAnalysis {
  valid: boolean;
  errors: {
    type: 'cycle' | 'orphan' | 'self_reference';
    tasks: string[];
    message: string;
  }[];
  warnings: {
    type: 'implicit_dependency' | 'long_chain';
    tasks: string[];
    suggestion: string;
  }[];
  executionLevels: string[][];  // Tasks that can run in parallel at each level
  criticalPath: string[];       // Longest dependency chain
}
```

---

### 5. Atomic Assessor

Evaluates whether tasks are small enough to execute reliably.

**Atomicity Criteria:**
- Single clear objective
- Testable with 1-5 unit tests
- Affects limited number of files (typically 1-3)
- No ambiguous decision points
- Can be described in 2-3 sentences

**LLM Prompt:**
```
Evaluate if this task is atomic (small enough to execute in one focused session):

Task: {title}
Description: {description}
Acceptance: {acceptance_criteria}

An atomic task:
- Has a single clear objective
- Can be verified with a few tests
- Doesn't require design decisions
- Is unambiguous in scope

Return:
{
  "atomic": boolean,
  "reason": string,
  "suggested_decomposition": string[] | null  // If not atomic
}
```

---

### 6. Human Refinement Handler

Manages the iterative decomposition loop with the user.

**Actions:**
- **Decompose**: Run LLM Decomposer on specific task, replace with children
- **Edit**: Update task title/description/acceptance
- **Delete**: Remove task (and handle dependent tasks)
- **Add**: Insert new task manually
- **Reorder**: Change execution order
- **Link/Unlink**: Modify dependencies

**State Management:**
- Each action appends to `tasks.jsonl`
- Parent tasks get `status: decomposed` when broken down
- Maintain undo history for the session

---

## Prompts

### Initial Decomposition Prompt

```markdown
You are a senior software architect decomposing a feature request into implementation tasks.

## Context
Project: {{project.name}}
Stack: {{project.stack | join(", ")}}
Test Framework: {{project.testFramework}}

## Relevant Patterns
{{#each memory.patterns}}
- {{this.pattern}}: {{this.description}}
{{/each}}

## Existing Code Context
{{#each relevantFiles}}
### {{this.path}}
{{this.summary}}
{{/each}}

## User Request
{{request.text}}

{{#if request.attachments}}
## Attachments
{{#each request.attachments}}
- {{this.name}}: {{this.summary}}
{{/each}}
{{/if}}

## Instructions
Decompose this request into 3-7 implementation tasks. For each task:
1. Write a clear, actionable title (imperative mood: "Create...", "Add...", "Implement...")
2. Describe what needs to be done (2-3 sentences)
3. Define acceptance criteria (bullet points, testable)
4. Identify dependencies on other tasks (by title)
5. Estimate complexity: trivial/simple/moderate/complex

Prefer fewer, well-scoped tasks over many tiny ones. Each task should represent meaningful progress.

## Output Format
```json
{
  "tasks": [
    {
      "title": "string",
      "description": "string",
      "acceptance_criteria": "string (markdown bullet points)",
      "complexity": "trivial|simple|moderate|complex",
      "depends_on": ["task title", ...],
      "files_affected": ["path/to/file.ts", ...],
      "test_approach": "string"
    }
  ],
  "notes": "Any concerns or suggestions for the user"
}
```
```

### Recursive Decomposition Prompt

```markdown
You are decomposing a task that is too large into smaller subtasks.

## Parent Task
Title: {{task.title}}
Description: {{task.description}}
Acceptance Criteria: {{task.acceptance_criteria}}

## Context
This task is part of a larger plan: {{plan.summary}}
Other tasks in the plan: {{siblingTasks | map("title") | join(", ")}}

## Instructions
Break this task into 2-4 smaller subtasks. Each subtask should:
1. Be independently completable
2. Have clear acceptance criteria
3. Contribute to the parent task's acceptance criteria

The subtasks together should fully satisfy the parent task's requirements.

## Output Format
```json
{
  "subtasks": [
    {
      "title": "string",
      "description": "string",
      "acceptance_criteria": "string",
      "complexity": "trivial|simple|moderate|complex",
      "depends_on": ["subtask title or existing task title", ...],
      "files_affected": ["path/to/file.ts", ...],
      "test_approach": "string"
    }
  ],
  "parent_complete_when": "Explanation of how subtasks satisfy parent"
}
```
```

### Atomicity Check Prompt

```markdown
Evaluate if this task is atomic (executable in one focused coding session).

## Task
Title: {{task.title}}
Description: {{task.description}}
Acceptance Criteria: {{task.acceptance_criteria}}
Estimated Complexity: {{task.complexity}}
Files Affected: {{task.files_affected | join(", ")}}

## Atomicity Criteria
A task is atomic if:
- It has ONE clear objective
- It can be tested with 1-5 unit tests
- It typically affects 1-3 files
- It requires no design decisions during implementation
- An experienced developer could complete it in under 30 minutes

## Response
```json
{
  "atomic": boolean,
  "confidence": 0.0-1.0,
  "reasoning": "string",
  "concerns": ["string", ...] | null,
  "decomposition_suggestion": ["subtask title", ...] | null
}
```
```

---

## Error Handling

### Ambiguous Requests
If the request is too vague, return clarifying questions instead of guessing:
```json
{
  "status": "needs_clarification",
  "questions": [
    "Should user authentication include social login (Google, GitHub)?",
    "Is email verification required for registration?"
  ]
}
```

### Circular Dependencies
Detected during dependency analysis:
```json
{
  "error": "circular_dependency",
  "cycle": ["Task A", "Task B", "Task C", "Task A"],
  "suggestion": "Consider merging Task B and Task C, or removing the dependency from Task C to Task A"
}
```

### Overly Complex Tasks
If a task resists decomposition (still complex after 3 levels):
```json
{
  "warning": "complex_task",
  "task": "Implement real-time collaboration",
  "suggestion": "This task may require architectural decisions. Consider creating a spike/research task first."
}
```

---

## Integration Points

### With Planning System
- Writes to `tasks.jsonl` in the plan directory
- Updates `meta.json` status
- Logs decomposition events to `events.jsonl`

### With Project Analyzer
- Receives project context
- Uses stack info for relevant suggestions
- Considers existing code patterns

### With Memory System
- Loads patterns and gotchas for context
- After plan execution, feeds back what decompositions worked well

### With Web UI
- Receives requests via API/WebSocket
- Streams decomposition progress
- Supports interactive refinement

---

## Configuration

```json
// .rtslabs/config.json
{
  "decomposition": {
    "model": "claude-sonnet-4",
    "max_tasks_per_level": 7,
    "min_tasks_per_level": 2,
    "max_decomposition_depth": 4,
    "atomicity_threshold": 0.8,
    "auto_suggest_templates": true,
    "require_acceptance_criteria": true
  }
}
```

---

## Metrics & Learning

Track decomposition quality to improve over time:

```typescript
interface DecompositionMetrics {
  plan_id: string;
  initial_task_count: number;
  final_task_count: number;
  decomposition_rounds: number;
  human_edits: number;
  tasks_added_manually: number;
  tasks_removed: number;

  // Post-execution feedback
  tasks_completed_first_try: number;
  tasks_required_revision: number;
  acceptance_criteria_issues: number;
  dependency_issues: number;
}
```

Use these metrics to:
- Identify templates that need improvement
- Tune atomicity thresholds
- Improve prompt effectiveness
