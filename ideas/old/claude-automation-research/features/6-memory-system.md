# Memory System Specification

The Memory System captures and retrieves knowledge about the project, learned patterns, and execution history to improve decomposition and execution quality over time.

## Core Responsibility

> Accumulate project-specific knowledge (patterns, gotchas, successful approaches) and provide relevant context to other components, enabling the system to learn from experience.

---

## Memory Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       MEMORY SYSTEM                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    MEMORY STORES                            │ │
│  │                                                             │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │ │
│  │  │  PATTERNS   │  │   GOTCHAS   │  │  EXECUTION HISTORY  │ │ │
│  │  │             │  │             │  │                     │ │ │
│  │  │ • Code      │  │ • Pitfalls  │  │ • Task outcomes     │ │ │
│  │  │   patterns  │  │ • Edge      │  │ • Decomposition     │ │ │
│  │  │ • Project   │  │   cases     │  │   quality           │ │ │
│  │  │   conventions│ │ • Common    │  │ • Retry reasons     │ │ │
│  │  │ • API usage │  │   mistakes  │  │ • Success patterns  │ │ │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘ │ │
│  │                                                             │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │ │
│  │  │  ENTITIES   │  │  RELATIONS  │  │    SUMMARIES        │ │ │
│  │  │             │  │             │  │                     │ │ │
│  │  │ • Files     │  │ • Depends   │  │ • Module summaries  │ │ │
│  │  │ • Modules   │  │ • Uses      │  │ • Architecture      │ │ │
│  │  │ • Services  │  │ • Exports   │  │ • Key decisions     │ │ │
│  │  │ • Types     │  │ • Tests     │  │                     │ │ │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    RETRIEVAL ENGINE                         │ │
│  │                                                             │ │
│  │  Query → Relevance Scoring → Context Assembly → Response   │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Memory Types

### 1. Patterns

Reusable code patterns and conventions specific to the project.

```typescript
interface Pattern {
  id: string;
  name: string;
  description: string;
  category: PatternCategory;

  // The pattern itself
  template: string;           // Code template with placeholders
  language: string;           // e.g., 'typescript', 'sql'

  // When to use
  triggers: string[];         // Keywords/contexts that trigger this pattern
  applicable_to: string[];    // File patterns, e.g., '*.service.ts'

  // Example
  example: {
    before?: string;          // Code before applying pattern
    after: string;            // Code after applying pattern
    explanation: string;
  };

  // Metadata
  source: PatternSource;
  confidence: number;         // 0-1, how reliable this pattern is
  usage_count: number;
  last_used: string;
  created_at: string;

  // Versioning
  version: number;
  supersedes?: string;        // ID of pattern this replaces
}

type PatternCategory =
  | 'api_endpoint'
  | 'database_query'
  | 'error_handling'
  | 'testing'
  | 'authentication'
  | 'validation'
  | 'logging'
  | 'caching'
  | 'file_structure'
  | 'naming_convention'
  | 'other';

type PatternSource =
  | { type: 'extracted'; file: string; line: number }
  | { type: 'learned'; plan_id: string; task_id: string }
  | { type: 'manual'; author: string }
  | { type: 'template'; template_id: string };
```

**Example Pattern:**

```json
{
  "id": "pat-abc123",
  "name": "NestJS Service Method",
  "description": "Standard pattern for service methods with error handling",
  "category": "api_endpoint",
  "template": "async {{methodName}}({{params}}): Promise<{{returnType}}> {\n  try {\n    {{body}}\n  } catch (error) {\n    this.logger.error(`Failed to {{action}}`, error);\n    throw new {{exceptionType}}(`{{errorMessage}}`);\n  }\n}",
  "language": "typescript",
  "triggers": ["service method", "async method", "try catch"],
  "applicable_to": ["*.service.ts"],
  "example": {
    "after": "async findById(id: string): Promise<User> {\n  try {\n    const user = await this.userRepository.findOne(id);\n    if (!user) throw new NotFoundException();\n    return user;\n  } catch (error) {\n    this.logger.error(`Failed to find user ${id}`, error);\n    throw new InternalServerErrorException('Failed to retrieve user');\n  }\n}",
    "explanation": "All service methods follow this error handling pattern with logging"
  },
  "source": { "type": "extracted", "file": "src/users/users.service.ts", "line": 45 },
  "confidence": 0.95,
  "usage_count": 12,
  "last_used": "2024-01-15T10:00:00Z",
  "created_at": "2024-01-01T00:00:00Z",
  "version": 1
}
```

---

### 2. Gotchas

Known pitfalls, edge cases, and things to watch out for.

```typescript
interface Gotcha {
  id: string;
  title: string;
  description: string;
  category: GotchaCategory;
  severity: 'low' | 'medium' | 'high' | 'critical';

  // What triggers this gotcha
  triggers: {
    files?: string[];         // File patterns
    keywords?: string[];      // Code/task keywords
    task_types?: string[];    // Types of tasks
  };

  // The problem
  problem: string;
  symptoms: string[];         // How you know you hit this

  // The solution
  solution: string;
  prevention: string;         // How to avoid it

  // Evidence
  examples: {
    bad: string;
    good: string;
    explanation: string;
  }[];

  // Metadata
  source: GotchaSource;
  occurrence_count: number;
  last_occurred: string;
  created_at: string;
  resolved_by?: string[];     // Task IDs that successfully handled this
}

type GotchaCategory =
  | 'runtime_error'
  | 'type_error'
  | 'test_flakiness'
  | 'performance'
  | 'security'
  | 'configuration'
  | 'dependency'
  | 'race_condition'
  | 'edge_case'
  | 'integration'
  | 'other';

type GotchaSource =
  | { type: 'failure'; plan_id: string; task_id: string; error: string }
  | { type: 'retry'; plan_id: string; task_id: string; attempts: number }
  | { type: 'manual'; author: string }
  | { type: 'verification'; verification_type: string };
```

**Example Gotcha:**

```json
{
  "id": "got-xyz789",
  "title": "TypeORM circular import with lazy relations",
  "description": "Circular imports between entities cause runtime errors when using lazy relations",
  "category": "runtime_error",
  "severity": "high",
  "triggers": {
    "files": ["*.entity.ts"],
    "keywords": ["ManyToOne", "OneToMany", "lazy", "relation"],
    "task_types": ["create entity", "add relation"]
  },
  "problem": "When Entity A imports Entity B and Entity B imports Entity A with lazy: true, TypeORM throws undefined errors at runtime",
  "symptoms": [
    "Cannot read property 'prototype' of undefined",
    "Entity metadata not found",
    "Circular dependency detected"
  ],
  "solution": "Use forwardRef() or move to dynamic imports: `@ManyToOne(() => import('./user.entity').then(m => m.User))`",
  "prevention": "Always use arrow functions for relation types: `@ManyToOne(() => User)` instead of `@ManyToOne(User)`",
  "examples": [{
    "bad": "@ManyToOne(User, user => user.posts)\nuser: User;",
    "good": "@ManyToOne(() => User, user => user.posts)\nuser: User;",
    "explanation": "Arrow function defers resolution, avoiding circular import issues"
  }],
  "source": { "type": "failure", "plan_id": "p-abc123", "task_id": "t-def456", "error": "Cannot read property..." },
  "occurrence_count": 3,
  "last_occurred": "2024-01-14T15:30:00Z",
  "created_at": "2024-01-10T00:00:00Z",
  "resolved_by": ["t-ghi789", "t-jkl012"]
}
```

---

### 3. Execution History

Records of past executions and their outcomes.

```typescript
interface ExecutionRecord {
  id: string;
  plan_id: string;
  task_id: string;

  // Task info
  task_title: string;
  task_type: string;          // Inferred category
  complexity: string;

  // Outcome
  outcome: 'success' | 'retry_success' | 'failure';
  attempts: number;
  duration_ms: number;

  // What happened
  files_changed: string[];
  approach_taken: string;     // LLM summary of approach

  // If retried or failed
  issues?: {
    attempt: number;
    error_type: string;
    error_message: string;
    resolution?: string;
  }[];

  // Verification results
  verification: {
    self: { passed: boolean; confidence: number };
    quick?: { passed: boolean };
    phase_gate?: { passed: boolean };
  };

  // Learning
  lessons?: string[];         // What was learned
  pattern_ids?: string[];     // Patterns that were used
  gotcha_ids?: string[];      // Gotchas that were encountered

  // Metadata
  executed_at: string;
  tokens_used: number;
}
```

---

### 4. Entity Knowledge

Understanding of project entities (files, modules, services, types).

```typescript
interface EntityKnowledge {
  id: string;
  type: EntityType;
  name: string;
  path: string;

  // Understanding
  summary: string;            // What this entity does
  purpose: string;            // Why it exists

  // Structure
  exports?: string[];         // What it exports
  imports?: string[];         // What it imports
  dependencies?: string[];    // Entity IDs it depends on
  dependents?: string[];      // Entity IDs that depend on it

  // Characteristics
  complexity: 'simple' | 'moderate' | 'complex';
  stability: 'stable' | 'active' | 'volatile';
  test_coverage?: number;

  // History
  change_frequency: number;   // Changes per month
  last_modified: string;
  common_changes: string[];   // Types of changes often made

  // Metadata
  analyzed_at: string;
  version: number;
}

type EntityType =
  | 'file'
  | 'module'
  | 'class'
  | 'service'
  | 'controller'
  | 'entity'
  | 'repository'
  | 'type'
  | 'interface'
  | 'function'
  | 'constant';
```

---

### 5. Summaries

High-level understanding of project architecture and decisions.

```typescript
interface Summary {
  id: string;
  type: SummaryType;
  scope: string;              // What this summarizes (module name, etc.)

  content: string;            // The summary text
  key_points: string[];       // Bullet points

  // Context
  relevant_files: string[];
  relevant_entities: string[];

  // Freshness
  generated_at: string;
  valid_until?: string;       // When it should be regenerated
  based_on_commit: string;    // Git commit hash

  // Quality
  confidence: number;
  reviewed: boolean;
}

type SummaryType =
  | 'architecture'            // Overall architecture
  | 'module'                  // Specific module
  | 'feature'                 // Feature area
  | 'api'                     // API surface
  | 'database'                // Database schema
  | 'authentication'          // Auth system
  | 'testing'                 // Testing approach
  | 'deployment';             // Deployment setup
```

---

## Storage Structure

All memory stored in `.rtslabs/memory/`:

```
.rtslabs/
└── memory/
    ├── patterns.jsonl        # Pattern definitions
    ├── gotchas.jsonl         # Known pitfalls
    ├── history.jsonl         # Execution history (append-only)
    ├── entities/
    │   ├── index.json        # Entity index for quick lookup
    │   └── entities.jsonl    # Entity knowledge
    ├── summaries/
    │   ├── architecture.md   # Human-readable architecture summary
    │   └── summaries.jsonl   # Structured summaries
    └── meta.json             # Memory system metadata
```

**meta.json:**
```json
{
  "version": 1,
  "last_updated": "2024-01-15T12:00:00Z",
  "stats": {
    "patterns": 45,
    "gotchas": 12,
    "history_entries": 234,
    "entities": 89,
    "summaries": 8
  },
  "last_analysis": "2024-01-15T10:00:00Z",
  "analysis_commit": "abc123def"
}
```

---

## Core Components

### 1. Memory Store

Handles CRUD operations for memory entries.

```typescript
interface MemoryStore {
  // Patterns
  getPatterns(filter?: PatternFilter): Promise<Pattern[]>;
  getPattern(id: string): Promise<Pattern | null>;
  addPattern(pattern: Omit<Pattern, 'id'>): Promise<Pattern>;
  updatePattern(id: string, updates: Partial<Pattern>): Promise<Pattern>;
  deletePattern(id: string): Promise<void>;

  // Gotchas
  getGotchas(filter?: GotchaFilter): Promise<Gotcha[]>;
  getGotcha(id: string): Promise<Gotcha | null>;
  addGotcha(gotcha: Omit<Gotcha, 'id'>): Promise<Gotcha>;
  updateGotcha(id: string, updates: Partial<Gotcha>): Promise<Gotcha>;

  // History
  getHistory(filter?: HistoryFilter): Promise<ExecutionRecord[]>;
  addHistoryEntry(record: Omit<ExecutionRecord, 'id'>): Promise<ExecutionRecord>;

  // Entities
  getEntities(filter?: EntityFilter): Promise<EntityKnowledge[]>;
  getEntity(id: string): Promise<EntityKnowledge | null>;
  upsertEntity(entity: EntityKnowledge): Promise<EntityKnowledge>;

  // Summaries
  getSummaries(type?: SummaryType): Promise<Summary[]>;
  getSummary(id: string): Promise<Summary | null>;
  upsertSummary(summary: Summary): Promise<Summary>;
}

interface PatternFilter {
  category?: PatternCategory;
  language?: string;
  triggers?: string[];
  applicable_to?: string;
  min_confidence?: number;
}

interface GotchaFilter {
  category?: GotchaCategory;
  severity?: string[];
  triggers?: {
    files?: string[];
    keywords?: string[];
  };
}

interface HistoryFilter {
  plan_id?: string;
  outcome?: string[];
  task_type?: string;
  date_range?: { from: string; to: string };
}
```

---

### 2. Retrieval Engine

Finds relevant memory for a given context.

```typescript
interface RetrievalEngine {
  // Main retrieval method
  retrieve(query: RetrievalQuery): Promise<RetrievalResult>;

  // Specialized retrievals
  getPatternsForTask(task: Task): Promise<Pattern[]>;
  getGotchasForTask(task: Task): Promise<Gotcha[]>;
  getRelevantHistory(task: Task): Promise<ExecutionRecord[]>;
  getEntityContext(files: string[]): Promise<EntityKnowledge[]>;
}

interface RetrievalQuery {
  // What we're retrieving for
  context: {
    task?: Task;
    files?: string[];
    keywords?: string[];
    task_type?: string;
  };

  // What to retrieve
  include: {
    patterns?: boolean | number;   // true or max count
    gotchas?: boolean | number;
    history?: boolean | number;
    entities?: boolean | number;
    summaries?: boolean | number;
  };

  // Filtering
  min_relevance?: number;          // 0-1
}

interface RetrievalResult {
  patterns: ScoredItem<Pattern>[];
  gotchas: ScoredItem<Gotcha>[];
  history: ScoredItem<ExecutionRecord>[];
  entities: ScoredItem<EntityKnowledge>[];
  summaries: ScoredItem<Summary>[];

  // Assembled context (ready for prompt)
  context_text: string;
}

interface ScoredItem<T> {
  item: T;
  relevance: number;    // 0-1
  match_reasons: string[];
}
```

**Relevance Scoring:**

```typescript
function scorePatternRelevance(pattern: Pattern, query: RetrievalQuery): number {
  let score = 0;
  const weights = {
    trigger_match: 0.3,
    file_match: 0.25,
    category_match: 0.2,
    recency: 0.15,
    confidence: 0.1
  };

  // Trigger keyword matching
  if (query.context.keywords) {
    const triggerMatches = pattern.triggers.filter(t =>
      query.context.keywords!.some(k =>
        t.toLowerCase().includes(k.toLowerCase()) ||
        k.toLowerCase().includes(t.toLowerCase())
      )
    );
    score += weights.trigger_match * (triggerMatches.length / pattern.triggers.length);
  }

  // File pattern matching
  if (query.context.files) {
    const fileMatches = query.context.files.some(f =>
      pattern.applicable_to.some(p => minimatch(f, p))
    );
    score += fileMatches ? weights.file_match : 0;
  }

  // Category matching (based on task type)
  if (query.context.task_type) {
    const categoryMap: Record<string, PatternCategory[]> = {
      'api': ['api_endpoint', 'validation', 'error_handling'],
      'database': ['database_query', 'caching'],
      'auth': ['authentication', 'validation'],
      'test': ['testing']
    };
    const relevantCategories = categoryMap[query.context.task_type] || [];
    if (relevantCategories.includes(pattern.category)) {
      score += weights.category_match;
    }
  }

  // Recency bonus
  const daysSinceUse = (Date.now() - new Date(pattern.last_used).getTime()) / (1000 * 60 * 60 * 24);
  score += weights.recency * Math.max(0, 1 - daysSinceUse / 30);

  // Confidence factor
  score += weights.confidence * pattern.confidence;

  return Math.min(1, score);
}
```

---

### 3. Learning Engine

Extracts knowledge from execution outcomes.

```typescript
interface LearningEngine {
  // Learn from execution
  learnFromExecution(execution: ExecutionRecord): Promise<LearningResult>;

  // Extract patterns from code
  extractPatterns(files: string[]): Promise<Pattern[]>;

  // Analyze failures for gotchas
  analyzeFailure(failure: TaskFailure): Promise<Gotcha | null>;

  // Update entity knowledge
  updateEntityKnowledge(changedFiles: string[]): Promise<EntityKnowledge[]>;

  // Regenerate summaries
  regenerateSummary(type: SummaryType, scope?: string): Promise<Summary>;
}

interface LearningResult {
  patterns_learned: Pattern[];
  patterns_reinforced: string[];  // Pattern IDs with increased confidence
  gotchas_learned: Gotcha[];
  gotchas_confirmed: string[];    // Gotcha IDs that occurred again
  entities_updated: string[];
  insights: string[];             // Human-readable insights
}
```

**Learning from Execution:**

```typescript
async function learnFromExecution(execution: ExecutionRecord): Promise<LearningResult> {
  const result: LearningResult = {
    patterns_learned: [],
    patterns_reinforced: [],
    gotchas_learned: [],
    gotchas_confirmed: [],
    entities_updated: [],
    insights: []
  };

  // If successful, reinforce patterns used
  if (execution.outcome === 'success' && execution.pattern_ids) {
    for (const patternId of execution.pattern_ids) {
      await memoryStore.updatePattern(patternId, {
        usage_count: (await memoryStore.getPattern(patternId))!.usage_count + 1,
        last_used: new Date().toISOString(),
        confidence: Math.min(1, pattern.confidence + 0.02)
      });
      result.patterns_reinforced.push(patternId);
    }
  }

  // If retried, potentially learn gotcha
  if (execution.outcome === 'retry_success' && execution.issues) {
    for (const issue of execution.issues) {
      // Check if this matches existing gotcha
      const existingGotcha = await findMatchingGotcha(issue);

      if (existingGotcha) {
        await memoryStore.updateGotcha(existingGotcha.id, {
          occurrence_count: existingGotcha.occurrence_count + 1,
          last_occurred: new Date().toISOString(),
          resolved_by: [...(existingGotcha.resolved_by || []), execution.task_id]
        });
        result.gotchas_confirmed.push(existingGotcha.id);
      } else {
        // Create new gotcha via LLM analysis
        const newGotcha = await analyzeAndCreateGotcha(issue, execution);
        if (newGotcha) {
          result.gotchas_learned.push(newGotcha);
        }
      }
    }
  }

  // Update entity knowledge for changed files
  if (execution.files_changed.length > 0) {
    const updatedEntities = await updateEntityKnowledge(execution.files_changed);
    result.entities_updated = updatedEntities.map(e => e.id);
  }

  // Generate insights
  result.insights = await generateInsights(execution, result);

  return result;
}
```

**Pattern Extraction Prompt:**

```markdown
Analyze this code file and extract reusable patterns.

## File
**Path:** {{file.path}}
**Language:** {{file.language}}

```{{file.language}}
{{file.content}}
```

## Instructions
Identify patterns that:
1. Are used consistently in this file
2. Could be applied to similar files
3. Represent project conventions
4. Handle common concerns (errors, logging, validation)

For each pattern found:
1. Give it a descriptive name
2. Create a template with placeholders
3. Explain when to use it
4. Note any variations

## Response Format
```json
{
  "patterns": [
    {
      "name": "string",
      "description": "string",
      "category": "string",
      "template": "string with {{placeholders}}",
      "triggers": ["keyword1", "keyword2"],
      "example": {
        "after": "string",
        "explanation": "string"
      }
    }
  ]
}
```
```

---

### 4. Context Assembler

Builds context strings for prompts from retrieved memory.

```typescript
interface ContextAssembler {
  assemble(retrieval: RetrievalResult, options?: AssemblyOptions): string;

  assembleForDecomposition(task: string, retrieval: RetrievalResult): string;
  assembleForExecution(task: Task, retrieval: RetrievalResult): string;
  assembleForVerification(task: Task, retrieval: RetrievalResult): string;
}

interface AssemblyOptions {
  max_tokens?: number;
  include_examples?: boolean;
  priority_order?: ('patterns' | 'gotchas' | 'history' | 'entities' | 'summaries')[];
}
```

**Assembly Implementation:**

```typescript
function assembleForExecution(task: Task, retrieval: RetrievalResult): string {
  const sections: string[] = [];

  // Relevant patterns
  if (retrieval.patterns.length > 0) {
    sections.push('## Relevant Patterns\n');
    for (const { item: pattern, relevance } of retrieval.patterns.slice(0, 5)) {
      sections.push(`### ${pattern.name}`);
      sections.push(pattern.description);
      sections.push('```' + pattern.language);
      sections.push(pattern.template);
      sections.push('```');
      if (pattern.example) {
        sections.push(`**Example:** ${pattern.example.explanation}`);
      }
      sections.push('');
    }
  }

  // Gotchas to watch out for
  if (retrieval.gotchas.length > 0) {
    sections.push('## Watch Out For\n');
    for (const { item: gotcha } of retrieval.gotchas.slice(0, 3)) {
      sections.push(`### ⚠️ ${gotcha.title}`);
      sections.push(gotcha.problem);
      sections.push(`**Solution:** ${gotcha.solution}`);
      sections.push('');
    }
  }

  // Similar past tasks
  if (retrieval.history.length > 0) {
    const successfulSimilar = retrieval.history
      .filter(h => h.item.outcome === 'success')
      .slice(0, 2);

    if (successfulSimilar.length > 0) {
      sections.push('## Similar Successful Tasks\n');
      for (const { item: record } of successfulSimilar) {
        sections.push(`- **${record.task_title}**: ${record.approach_taken}`);
      }
      sections.push('');
    }
  }

  // Entity context
  if (retrieval.entities.length > 0) {
    sections.push('## Relevant Code Context\n');
    for (const { item: entity } of retrieval.entities.slice(0, 5)) {
      sections.push(`### ${entity.name} (${entity.path})`);
      sections.push(entity.summary);
      if (entity.exports && entity.exports.length > 0) {
        sections.push(`**Exports:** ${entity.exports.join(', ')}`);
      }
      sections.push('');
    }
  }

  return sections.join('\n');
}
```

---

## Memory Lifecycle

### Initial Analysis

When a project is first analyzed:

```
┌─────────────────────────────────────────────────────────────────┐
│                    INITIAL ANALYSIS                              │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    1. SCAN PROJECT                               │
│  ─────────────────────────────────────────────────────────────  │
│  • Identify all source files                                    │
│  • Detect framework/stack                                       │
│  • Map directory structure                                      │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    2. EXTRACT ENTITIES                           │
│  ─────────────────────────────────────────────────────────────  │
│  • Parse key files (services, controllers, etc.)                │
│  • Generate summaries for each                                  │
│  • Map dependencies                                             │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    3. EXTRACT PATTERNS                           │
│  ─────────────────────────────────────────────────────────────  │
│  • Analyze code for repeated structures                         │
│  • Identify naming conventions                                  │
│  • Extract error handling patterns                              │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    4. GENERATE SUMMARIES                         │
│  ─────────────────────────────────────────────────────────────  │
│  • Architecture overview                                        │
│  • Module summaries                                             │
│  • Key architectural decisions                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Continuous Learning

During and after each plan execution:

```
                    ┌─────────────────┐
                    │ PLAN EXECUTES   │
                    └────────┬────────┘
                             │
           ┌─────────────────┼─────────────────┐
           │                 │                 │
           ▼                 ▼                 ▼
    ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
    │ Task        │   │ Task        │   │ Task        │
    │ Completes   │   │ Retries     │   │ Fails       │
    └──────┬──────┘   └──────┬──────┘   └──────┬──────┘
           │                 │                 │
           ▼                 ▼                 ▼
    ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
    │ Record      │   │ Analyze     │   │ Extract     │
    │ Success     │   │ Retry       │   │ Gotcha      │
    │ Patterns    │   │ Reasons     │   │ From Error  │
    └──────┬──────┘   └──────┬──────┘   └──────┬──────┘
           │                 │                 │
           └─────────────────┼─────────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ UPDATE MEMORY   │
                    │ • Patterns      │
                    │ • Gotchas       │
                    │ • History       │
                    │ • Entities      │
                    └─────────────────┘
```

### Decay and Refresh

Memory items have freshness that decays:

```typescript
interface DecayConfig {
  pattern_decay_days: number;      // Days until pattern confidence decays
  gotcha_relevance_days: number;   // Days until gotcha marked stale
  entity_refresh_days: number;     // Days until entity re-analyzed
  summary_refresh_days: number;    // Days until summary regenerated
}

async function maintainMemory(config: DecayConfig): Promise<MaintenanceResult> {
  const now = Date.now();

  // Decay unused patterns
  const patterns = await memoryStore.getPatterns();
  for (const pattern of patterns) {
    const daysSinceUse = (now - new Date(pattern.last_used).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceUse > config.pattern_decay_days) {
      const newConfidence = pattern.confidence * 0.95;  // 5% decay
      if (newConfidence < 0.3) {
        // Archive or delete very low confidence patterns
        await memoryStore.deletePattern(pattern.id);
      } else {
        await memoryStore.updatePattern(pattern.id, { confidence: newConfidence });
      }
    }
  }

  // Refresh stale entities
  const entities = await memoryStore.getEntities();
  for (const entity of entities) {
    const daysSinceAnalysis = (now - new Date(entity.analyzed_at).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceAnalysis > config.entity_refresh_days) {
      // Check if file changed
      const fileChanged = await hasFileChanged(entity.path, entity.analyzed_at);
      if (fileChanged) {
        await learningEngine.updateEntityKnowledge([entity.path]);
      }
    }
  }

  // Regenerate stale summaries
  const summaries = await memoryStore.getSummaries();
  for (const summary of summaries) {
    const daysSinceGenerated = (now - new Date(summary.generated_at).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceGenerated > config.summary_refresh_days) {
      await learningEngine.regenerateSummary(summary.type, summary.scope);
    }
  }

  return { /* maintenance stats */ };
}
```

---

## Integration Points

### With Decomposition Engine
- Provides patterns for task generation
- Provides gotchas to consider during decomposition
- Provides entity context for understanding scope

### With Execution Engine
- Provides patterns for task execution
- Provides gotchas as warnings
- Provides similar successful task history
- Receives execution outcomes for learning

### With Verification System
- Provides gotchas for verification checks
- Receives verification failures for gotcha extraction

### With Project Analyzer
- Receives initial entity analysis
- Receives pattern extraction from codebase

---

## Configuration

```json
// .rtslabs/config.json
{
  "memory": {
    "enabled": true,
    "auto_learn": true,
    "pattern_extraction": {
      "enabled": true,
      "min_occurrences": 2,
      "confidence_threshold": 0.7
    },
    "gotcha_extraction": {
      "enabled": true,
      "min_severity": "medium"
    },
    "retrieval": {
      "max_patterns": 5,
      "max_gotchas": 3,
      "max_history": 5,
      "max_entities": 10,
      "min_relevance": 0.3
    },
    "decay": {
      "pattern_decay_days": 30,
      "gotcha_relevance_days": 60,
      "entity_refresh_days": 7,
      "summary_refresh_days": 14
    }
  }
}
```

---

## CLI Commands

```bash
# View memory stats
rtslabs memory stats

# List patterns
rtslabs memory patterns [--category <cat>] [--min-confidence 0.7]

# List gotchas
rtslabs memory gotchas [--severity high,critical]

# View entity knowledge
rtslabs memory entity <path>

# Re-analyze project
rtslabs memory analyze [--full]

# Export memory (for sharing/backup)
rtslabs memory export --output memory-backup.json

# Import memory
rtslabs memory import --input memory-backup.json

# Clear specific memory type
rtslabs memory clear patterns|gotchas|history|entities|summaries
```

---

## Metrics

```typescript
interface MemoryMetrics {
  // Inventory
  total_patterns: number;
  total_gotchas: number;
  total_history_entries: number;
  total_entities: number;
  total_summaries: number;

  // Quality
  avg_pattern_confidence: number;
  patterns_above_threshold: number;
  gotchas_by_severity: Record<string, number>;

  // Usage
  retrievals_last_30_days: number;
  patterns_used_last_30_days: number;
  gotchas_triggered_last_30_days: number;

  // Learning
  patterns_learned_last_30_days: number;
  gotchas_learned_last_30_days: number;

  // Effectiveness
  retry_reduction_rate: number;  // % fewer retries due to gotchas
  pattern_success_rate: number;  // % tasks using patterns that succeed
}
```
