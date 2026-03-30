# Configuration System Specification

The Configuration System provides centralized, validated, and layered configuration management for all components of the coding agent.

## Core Responsibility

> Provide a single source of truth for all configuration, supporting multiple sources (defaults, files, environment, CLI), validation, and runtime access.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                   CONFIGURATION SYSTEM                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                   CONFIGURATION SOURCES                     │ │
│  │                   (Priority: Low → High)                    │ │
│  │                                                             │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │ │
│  │  │ DEFAULTS │  │  GLOBAL  │  │ PROJECT  │  │    ENV     │  │ │
│  │  │          │──▶│  CONFIG  │──▶│  CONFIG  │──▶│ VARIABLES │  │ │
│  │  │ Built-in │  │ ~/.rts/  │  │.rtslabs/ │  │            │  │ │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │ │
│  │                                                    │        │ │
│  │                                                    ▼        │ │
│  │                                             ┌────────────┐  │ │
│  │                                             │    CLI     │  │ │
│  │                                             │   FLAGS    │  │ │
│  │                                             │ (highest)  │  │ │
│  │                                             └────────────┘  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              │                                   │
│                              ▼                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                   CONFIGURATION LOADER                      │ │
│  │                                                             │ │
│  │  Load → Merge → Validate → Freeze → Provide                │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              │                                   │
│                              ▼                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                   RUNTIME CONFIG                            │ │
│  │                                                             │ │
│  │  Typed Access • Hot Reload • Change Events • Secrets       │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Configuration Layers

### Layer Priority (Lowest to Highest)

1. **Built-in Defaults** - Hardcoded sensible defaults
2. **Global Config** - `~/.rtslabs/config.json` - User preferences across all projects
3. **Project Config** - `.rtslabs/config.json` - Project-specific settings
4. **Environment Variables** - `RTSLABS_*` prefixed variables
5. **CLI Flags** - Command-line arguments (highest priority)

```typescript
interface ConfigurationLayer {
  name: string;
  priority: number;
  source: ConfigSource;
  values: Partial<Configuration>;
}

type ConfigSource =
  | { type: 'defaults' }
  | { type: 'file'; path: string }
  | { type: 'env'; prefix: string }
  | { type: 'cli'; args: string[] };

// Merge strategy: Later layers override earlier ones
function mergeConfigurations(layers: ConfigurationLayer[]): Configuration {
  const sorted = layers.sort((a, b) => a.priority - b.priority);

  return sorted.reduce(
    (merged, layer) => deepMerge(merged, layer.values),
    {} as Configuration
  );
}
```

---

## Complete Configuration Schema

```typescript
interface Configuration {
  // ===================
  // GENERAL
  // ===================
  general: {
    // Project identification
    project_name?: string;           // Auto-detected if not set
    project_path: string;            // Default: current directory

    // Directory structure
    rtslabs_dir: string;             // Default: '.rtslabs'
    plans_dir: string;               // Default: 'plans'
    memory_dir: string;              // Default: 'memory'
    analysis_dir: string;            // Default: 'analysis'

    // Behavior
    auto_analyze: boolean;           // Default: true
    debug_mode: boolean;             // Default: false
    log_level: LogLevel;             // Default: 'info'
  };

  // ===================
  // LLM
  // ===================
  llm: {
    // Provider configuration
    default_provider: Provider;      // Default: 'anthropic'
    providers: {
      anthropic?: {
        api_key?: string;            // Or use env: ANTHROPIC_API_KEY
        api_key_env?: string;        // Default: 'ANTHROPIC_API_KEY'
        base_url?: string;
        enabled: boolean;            // Default: true
      };
      openai?: {
        api_key?: string;
        api_key_env?: string;        // Default: 'OPENAI_API_KEY'
        base_url?: string;
        enabled: boolean;            // Default: false
      };
      local?: {
        base_url: string;            // Default: 'http://localhost:11434'
        enabled: boolean;            // Default: false
      };
    };

    // Model selection
    models: {
      fast: string;                  // Default: 'claude-3-5-haiku-20241022'
      standard: string;              // Default: 'claude-sonnet-4-20250514'
      powerful: string;              // Default: 'claude-opus-4-20250514'
    };

    // Routing behavior
    routing: {
      auto_select: boolean;          // Default: true
      prefer_cost: boolean;          // Default: false (prefer speed)
      max_retries: number;           // Default: 3
      retry_delay_ms: number;        // Default: 1000
      timeout_ms: number;            // Default: 300000 (5 min)
    };

    // Rate limits
    rate_limits: {
      respect_provider_limits: boolean;  // Default: true
      requests_per_minute?: number;      // Custom override
      tokens_per_minute?: number;        // Custom override
    };

    // Budget
    budget: {
      daily_limit_usd?: number;
      monthly_limit_usd?: number;
      warn_threshold: number;        // Default: 0.8 (80%)
      pause_on_exceed: boolean;      // Default: false
    };

    // Caching
    caching: {
      enabled: boolean;              // Default: true
      ttl_seconds: number;           // Default: 3600
      max_entries: number;           // Default: 1000
    };
  };

  // ===================
  // DECOMPOSITION
  // ===================
  decomposition: {
    // Model selection
    model_tier: ModelTier;           // Default: 'standard'

    // Task generation
    max_tasks_per_level: number;     // Default: 7
    min_tasks_per_level: number;     // Default: 2
    max_decomposition_depth: number; // Default: 4

    // Atomicity
    atomicity_threshold: number;     // Default: 0.8
    auto_decompose_non_atomic: boolean; // Default: false

    // Templates
    auto_suggest_templates: boolean; // Default: true
    template_confidence_threshold: number; // Default: 0.7

    // Requirements
    require_acceptance_criteria: boolean; // Default: true
    require_test_approach: boolean;  // Default: true
    require_files_affected: boolean; // Default: true
  };

  // ===================
  // EXECUTION
  // ===================
  execution: {
    // Worker pool
    worker_pool_size: number;        // Default: 3
    max_workers: number;             // Default: 5
    min_workers: number;             // Default: 1

    // Retries
    max_retries: number;             // Default: 3
    retry_backoff_ms: number;        // Default: 1000
    retry_backoff_multiplier: number; // Default: 2
    max_backoff_ms: number;          // Default: 30000

    // Timeouts
    task_timeout_ms: number;         // Default: 300000 (5 min)
    session_timeout_ms: number;      // Default: 3600000 (1 hour)

    // Git integration
    commit_per_task: boolean;        // Default: true
    auto_stage_all: boolean;         // Default: false

    // Verification
    auto_verify: boolean;            // Default: true
    quick_verify_frequency: number;  // Default: 3 (every N tasks)

    // Behavior
    pause_on_failure: boolean;       // Default: false
    pause_on_red_flag: boolean;      // Default: false (only critical)
    conflict_strategy: ConflictStrategy; // Default: 'add_dependency'
  };

  // ===================
  // VERIFICATION
  // ===================
  verification: {
    // Self verification
    self: {
      enabled: boolean;              // Default: true
      require_tests: boolean;        // Default: true
      confidence_threshold: number;  // Default: 0.7
      run_linter: boolean;           // Default: true
      run_type_check: boolean;       // Default: true
    };

    // Quick verification
    quick: {
      enabled: boolean;              // Default: true
      frequency: number;             // Default: 3 (every N tasks)
      timeout_ms: number;            // Default: 60000
      run_affected_tests: boolean;   // Default: true
    };

    // Phase gate verification
    phase_gate: {
      enabled: boolean;              // Default: true
      require_build: boolean;        // Default: true
      require_integration_tests: boolean; // Default: false
      run_e2e_tests: boolean;        // Default: false
    };

    // Final review
    final: {
      enabled: boolean;              // Default: true
      full_test_suite: boolean;      // Default: true
      production_build: boolean;     // Default: true
      llm_review: boolean;           // Default: true
      security_scan: boolean;        // Default: false
    };

    // Red flags
    red_flags: {
      enabled: boolean;              // Default: true
      pause_on_critical: boolean;    // Default: true
      low_confidence_threshold: number; // Default: 0.5
      max_retries_threshold: number; // Default: 2
    };
  };

  // ===================
  // GIT
  // ===================
  git: {
    // Worktree
    worktree_location: 'inside' | 'outside' | string; // Default: 'inside'
    worktree_path: string;           // Default: '.rtslabs/worktrees'

    // Branches
    default_base_branch: string;     // Default: 'main'
    branch_prefix: string;           // Default: 'plan/'

    // Commits
    commit_message_format: 'conventional' | 'simple' | 'detailed'; // Default: 'detailed'
    sign_commits: boolean;           // Default: false
    include_task_id: boolean;        // Default: true

    // Remote
    push_on_complete: boolean;       // Default: false
    create_pr_on_complete: boolean;  // Default: false
    pr_template?: string;            // Path to PR template

    // Cleanup
    cleanup_after_days?: number;     // Auto-clean stale worktrees
    keep_merged_branches: boolean;   // Default: false
  };

  // ===================
  // MEMORY
  // ===================
  memory: {
    enabled: boolean;                // Default: true
    auto_learn: boolean;             // Default: true

    // Pattern extraction
    pattern_extraction: {
      enabled: boolean;              // Default: true
      min_occurrences: number;       // Default: 2
      confidence_threshold: number;  // Default: 0.7
      use_llm: boolean;              // Default: true
    };

    // Gotcha extraction
    gotcha_extraction: {
      enabled: boolean;              // Default: true
      min_severity: Severity;        // Default: 'medium'
      learn_from_retries: boolean;   // Default: true
    };

    // Retrieval
    retrieval: {
      max_patterns: number;          // Default: 5
      max_gotchas: number;           // Default: 3
      max_history: number;           // Default: 5
      max_entities: number;          // Default: 10
      min_relevance: number;         // Default: 0.3
    };

    // Decay
    decay: {
      enabled: boolean;              // Default: true
      pattern_decay_days: number;    // Default: 30
      gotcha_relevance_days: number; // Default: 60
      entity_refresh_days: number;   // Default: 7
      summary_refresh_days: number;  // Default: 14
    };
  };

  // ===================
  // ANALYZER
  // ===================
  analyzer: {
    auto_analyze: boolean;           // Default: true
    refresh_interval_days: number;   // Default: 7
    max_files_to_parse: number;      // Default: 500
    max_file_size_kb: number;        // Default: 100

    // Exclude patterns (gitignore-style)
    exclude_patterns: string[];      // Default: ['node_modules/**', 'dist/**', '*.min.js']

    // Entity extraction
    entity_extraction: {
      include_private: boolean;      // Default: false
      generate_summaries: boolean;   // Default: true
      max_entities_per_file: number; // Default: 50
    };

    // Pattern detection
    pattern_detection: {
      min_occurrences: number;       // Default: 2
      use_llm: boolean;              // Default: true
    };
  };

  // ===================
  // UI
  // ===================
  ui: {
    // Server
    port: number;                    // Default: 3000
    host: string;                    // Default: 'localhost'
    open_browser: boolean;           // Default: true

    // Theme
    theme: 'light' | 'dark' | 'system'; // Default: 'system'

    // Notifications
    notifications: {
      enabled: boolean;              // Default: true
      sound: boolean;                // Default: false
      desktop: boolean;              // Default: true
    };

    // Execution view
    execution: {
      auto_scroll: boolean;          // Default: true
      max_output_lines: number;      // Default: 1000
      show_timestamps: boolean;      // Default: true
    };

    // Diff view
    diff: {
      default_view: 'split' | 'unified'; // Default: 'split'
      syntax_highlighting: boolean;  // Default: true
      word_wrap: boolean;            // Default: false
    };
  };

  // ===================
  // TEMPLATES
  // ===================
  templates: {
    // Template sources
    builtin_enabled: boolean;        // Default: true
    custom_path?: string;            // Default: '.rtslabs/templates'
    remote_sources?: string[];       // URLs to fetch templates from

    // Default variables
    default_variables: Record<string, string>;
  };

  // ===================
  // COMMANDS
  // ===================
  commands: {
    // Build commands
    build: string;                   // Default: 'npm run build'
    test: string;                    // Default: 'npm test'
    test_watch: string;              // Default: 'npm run test:watch'
    lint: string;                    // Default: 'npm run lint'
    type_check: string;              // Default: 'npx tsc --noEmit'

    // Integration tests
    integration_test?: string;
    e2e_test?: string;

    // Custom commands
    pre_execute?: string;            // Run before execution starts
    post_execute?: string;           // Run after execution completes
    pre_task?: string;               // Run before each task
    post_task?: string;              // Run after each task
  };
}

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type Provider = 'anthropic' | 'openai' | 'local' | 'custom';
type ModelTier = 'fast' | 'standard' | 'powerful';
type Severity = 'low' | 'medium' | 'high' | 'critical';
type ConflictStrategy = 'add_dependency' | 'auto_merge' | 'pause';
```

---

## Configuration Files

### Project Config (`.rtslabs/config.json`)

```json
{
  "$schema": "https://rtslabs.dev/schema/config.json",
  "general": {
    "project_name": "my-awesome-app"
  },
  "llm": {
    "providers": {
      "anthropic": {
        "api_key_env": "ANTHROPIC_API_KEY"
      }
    },
    "budget": {
      "daily_limit_usd": 10,
      "monthly_limit_usd": 100
    }
  },
  "execution": {
    "worker_pool_size": 3
  },
  "git": {
    "default_base_branch": "develop"
  },
  "commands": {
    "build": "pnpm build",
    "test": "pnpm test"
  }
}
```

### Global Config (`~/.rtslabs/config.json`)

```json
{
  "$schema": "https://rtslabs.dev/schema/config.json",
  "llm": {
    "default_provider": "anthropic",
    "providers": {
      "anthropic": {
        "api_key_env": "ANTHROPIC_API_KEY"
      }
    }
  },
  "ui": {
    "theme": "dark",
    "notifications": {
      "sound": false
    }
  }
}
```

---

## Environment Variables

All configuration can be overridden via environment variables with the `RTSLABS_` prefix:

```bash
# Naming convention: RTSLABS_{SECTION}_{KEY}
# Nested keys use double underscore

# Examples:
RTSLABS_GENERAL__DEBUG_MODE=true
RTSLABS_LLM__DEFAULT_PROVIDER=openai
RTSLABS_LLM__PROVIDERS__ANTHROPIC__API_KEY=sk-ant-...
RTSLABS_LLM__BUDGET__DAILY_LIMIT_USD=50
RTSLABS_EXECUTION__WORKER_POOL_SIZE=5
RTSLABS_GIT__DEFAULT_BASE_BRANCH=main
RTSLABS_UI__PORT=8080

# Special: API keys have shortcuts
ANTHROPIC_API_KEY=sk-ant-...     # Direct API key
OPENAI_API_KEY=sk-...
```

**Parsing Rules:**

```typescript
function parseEnvVariables(env: NodeJS.ProcessEnv): Partial<Configuration> {
  const config: any = {};
  const prefix = 'RTSLABS_';

  for (const [key, value] of Object.entries(env)) {
    if (!key.startsWith(prefix)) continue;

    // Remove prefix and split by __
    const path = key
      .slice(prefix.length)
      .toLowerCase()
      .split('__');

    // Parse value
    const parsedValue = parseValue(value);

    // Set nested value
    setNestedValue(config, path, parsedValue);
  }

  return config;
}

function parseValue(value: string): any {
  // Boolean
  if (value.toLowerCase() === 'true') return true;
  if (value.toLowerCase() === 'false') return false;

  // Number
  const num = Number(value);
  if (!isNaN(num)) return num;

  // JSON (arrays, objects)
  try {
    return JSON.parse(value);
  } catch {
    // String
    return value;
  }
}
```

---

## CLI Flags

```bash
# Global flags
rtslabs --config <path>           # Custom config file path
rtslabs --project <path>          # Project directory
rtslabs --debug                   # Enable debug mode
rtslabs --log-level <level>       # Set log level

# Per-command overrides
rtslabs execute --workers 5       # Override worker count
rtslabs execute --timeout 600000  # Override timeout
rtslabs execute --no-verify       # Disable verification

# LLM overrides
rtslabs --model claude-opus-4-20250514  # Override model
rtslabs --provider openai         # Override provider

# Examples
rtslabs plan "Add auth" --workers 5 --model claude-opus-4-20250514
rtslabs execute p-abc123 --debug --no-verify
rtslabs analyze --full --log-level debug
```

---

## Core Components

### 1. Configuration Loader

Loads and merges configuration from all sources.

```typescript
interface ConfigurationLoader {
  // Load all configuration
  load(options?: LoadOptions): Promise<Configuration>;

  // Reload configuration
  reload(): Promise<Configuration>;

  // Get specific section
  getSection<K extends keyof Configuration>(key: K): Configuration[K];

  // Watch for changes
  watch(callback: (config: Configuration) => void): () => void;
}

interface LoadOptions {
  projectPath?: string;
  configPath?: string;          // Override config file path
  env?: NodeJS.ProcessEnv;      // Override environment
  cliFlags?: Record<string, any>;
}

class ConfigurationLoaderImpl implements ConfigurationLoader {
  private config: Configuration | null = null;
  private watchers: Set<(config: Configuration) => void> = new Set();

  async load(options: LoadOptions = {}): Promise<Configuration> {
    const layers: ConfigurationLayer[] = [];

    // 1. Built-in defaults
    layers.push({
      name: 'defaults',
      priority: 0,
      source: { type: 'defaults' },
      values: DEFAULT_CONFIGURATION
    });

    // 2. Global config
    const globalPath = path.join(os.homedir(), '.rtslabs', 'config.json');
    if (await fileExists(globalPath)) {
      layers.push({
        name: 'global',
        priority: 1,
        source: { type: 'file', path: globalPath },
        values: await loadJsonFile(globalPath)
      });
    }

    // 3. Project config
    const projectPath = options.projectPath || process.cwd();
    const projectConfigPath = options.configPath ||
      path.join(projectPath, '.rtslabs', 'config.json');

    if (await fileExists(projectConfigPath)) {
      layers.push({
        name: 'project',
        priority: 2,
        source: { type: 'file', path: projectConfigPath },
        values: await loadJsonFile(projectConfigPath)
      });
    }

    // 4. Environment variables
    const envConfig = parseEnvVariables(options.env || process.env);
    if (Object.keys(envConfig).length > 0) {
      layers.push({
        name: 'env',
        priority: 3,
        source: { type: 'env', prefix: 'RTSLABS_' },
        values: envConfig
      });
    }

    // 5. CLI flags
    if (options.cliFlags && Object.keys(options.cliFlags).length > 0) {
      layers.push({
        name: 'cli',
        priority: 4,
        source: { type: 'cli', args: process.argv },
        values: mapCliFlags(options.cliFlags)
      });
    }

    // Merge all layers
    const merged = mergeConfigurations(layers);

    // Validate
    const validation = await this.validate(merged);
    if (!validation.valid) {
      throw new ConfigurationError(validation.errors);
    }

    // Resolve secrets
    const resolved = await this.resolveSecrets(merged);

    // Freeze and store
    this.config = deepFreeze(resolved);

    return this.config;
  }

  async validate(config: Partial<Configuration>): Promise<ValidationResult> {
    const errors: ValidationError[] = [];

    // Use Zod or JSON Schema validation
    const result = ConfigurationSchema.safeParse(config);

    if (!result.success) {
      for (const issue of result.error.issues) {
        errors.push({
          path: issue.path.join('.'),
          message: issue.message,
          value: issue.code
        });
      }
    }

    // Additional semantic validation
    if (config.execution?.worker_pool_size > config.execution?.max_workers) {
      errors.push({
        path: 'execution.worker_pool_size',
        message: 'worker_pool_size cannot exceed max_workers',
        value: config.execution.worker_pool_size
      });
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  private async resolveSecrets(config: Configuration): Promise<Configuration> {
    const resolved = { ...config };

    // Resolve API keys from environment
    for (const [provider, providerConfig] of Object.entries(resolved.llm.providers || {})) {
      if (providerConfig?.api_key_env && !providerConfig.api_key) {
        const envKey = providerConfig.api_key_env;
        const value = process.env[envKey];
        if (value) {
          providerConfig.api_key = value;
        }
      }
    }

    return resolved;
  }
}
```

### 2. Configuration Validator

Validates configuration against schema.

```typescript
import { z } from 'zod';

// Zod schema for validation
const ConfigurationSchema = z.object({
  general: z.object({
    project_name: z.string().optional(),
    project_path: z.string().default('.'),
    rtslabs_dir: z.string().default('.rtslabs'),
    debug_mode: z.boolean().default(false),
    log_level: z.enum(['debug', 'info', 'warn', 'error']).default('info')
  }).default({}),

  llm: z.object({
    default_provider: z.enum(['anthropic', 'openai', 'local', 'custom']).default('anthropic'),
    providers: z.object({
      anthropic: z.object({
        api_key: z.string().optional(),
        api_key_env: z.string().default('ANTHROPIC_API_KEY'),
        enabled: z.boolean().default(true)
      }).optional(),
      openai: z.object({
        api_key: z.string().optional(),
        api_key_env: z.string().default('OPENAI_API_KEY'),
        enabled: z.boolean().default(false)
      }).optional()
    }).default({}),
    budget: z.object({
      daily_limit_usd: z.number().positive().optional(),
      monthly_limit_usd: z.number().positive().optional(),
      warn_threshold: z.number().min(0).max(1).default(0.8)
    }).default({})
  }).default({}),

  execution: z.object({
    worker_pool_size: z.number().int().min(1).max(10).default(3),
    max_retries: z.number().int().min(0).max(10).default(3),
    task_timeout_ms: z.number().int().min(10000).default(300000)
  }).default({}),

  // ... more sections
}).strict();  // Disallow unknown keys

// Custom refinements
const RefinedConfigSchema = ConfigurationSchema.refine(
  (config) => {
    // At least one provider must be enabled
    const providers = config.llm.providers;
    return Object.values(providers).some(p => p?.enabled);
  },
  { message: 'At least one LLM provider must be enabled' }
);
```

### 3. Runtime Configuration

Thread-safe runtime access to configuration.

```typescript
interface RuntimeConfig {
  // Get entire config
  get(): Readonly<Configuration>;

  // Get specific value
  getValue<T>(path: string): T;

  // Check if path exists
  has(path: string): boolean;

  // Get with default
  getOrDefault<T>(path: string, defaultValue: T): T;

  // Reload
  reload(): Promise<void>;

  // Listen for changes
  onChange(callback: (prev: Configuration, next: Configuration) => void): () => void;
}

// Singleton instance
class RuntimeConfigImpl implements RuntimeConfig {
  private static instance: RuntimeConfigImpl;
  private config: Configuration;
  private listeners: Set<(prev: Configuration, next: Configuration) => void> = new Set();

  static getInstance(): RuntimeConfigImpl {
    if (!RuntimeConfigImpl.instance) {
      RuntimeConfigImpl.instance = new RuntimeConfigImpl();
    }
    return RuntimeConfigImpl.instance;
  }

  get(): Readonly<Configuration> {
    return this.config;
  }

  getValue<T>(path: string): T {
    return getNestedValue(this.config, path.split('.')) as T;
  }

  has(path: string): boolean {
    try {
      const value = this.getValue(path);
      return value !== undefined;
    } catch {
      return false;
    }
  }

  getOrDefault<T>(path: string, defaultValue: T): T {
    const value = this.getValue<T>(path);
    return value !== undefined ? value : defaultValue;
  }

  async reload(): Promise<void> {
    const prev = this.config;
    const loader = new ConfigurationLoaderImpl();
    this.config = await loader.load();

    // Notify listeners
    for (const listener of this.listeners) {
      listener(prev, this.config);
    }
  }

  onChange(callback: (prev: Configuration, next: Configuration) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }
}

// Convenience function
export function getConfig(): Readonly<Configuration> {
  return RuntimeConfigImpl.getInstance().get();
}

export function getConfigValue<T>(path: string): T {
  return RuntimeConfigImpl.getInstance().getValue<T>(path);
}
```

### 4. Configuration Generator

Generates default configuration files.

```typescript
interface ConfigurationGenerator {
  // Generate project config
  generateProjectConfig(options?: GenerateOptions): Promise<string>;

  // Generate global config
  generateGlobalConfig(): Promise<string>;

  // Initialize project
  initProject(projectPath: string): Promise<void>;
}

interface GenerateOptions {
  includeComments: boolean;
  includeDefaults: boolean;
  sections?: (keyof Configuration)[];
}

async function initProject(projectPath: string): Promise<void> {
  const rtslabsDir = path.join(projectPath, '.rtslabs');

  // Create directory structure
  await fs.mkdir(rtslabsDir, { recursive: true });
  await fs.mkdir(path.join(rtslabsDir, 'plans'), { recursive: true });
  await fs.mkdir(path.join(rtslabsDir, 'memory'), { recursive: true });
  await fs.mkdir(path.join(rtslabsDir, 'analysis'), { recursive: true });
  await fs.mkdir(path.join(rtslabsDir, 'templates'), { recursive: true });

  // Generate config file
  const config = {
    "$schema": "https://rtslabs.dev/schema/config.json",
    general: {
      project_name: path.basename(projectPath)
    },
    llm: {
      providers: {
        anthropic: {
          api_key_env: "ANTHROPIC_API_KEY"
        }
      }
    },
    commands: await detectCommands(projectPath)
  };

  await fs.writeFile(
    path.join(rtslabsDir, 'config.json'),
    JSON.stringify(config, null, 2)
  );

  // Add to .gitignore
  await appendToGitignore(projectPath, [
    '.rtslabs/worktrees/',
    '.rtslabs/analysis/',
    '.rtslabs/usage/'
  ]);
}

async function detectCommands(projectPath: string): Promise<Partial<Configuration['commands']>> {
  const commands: Partial<Configuration['commands']> = {};

  // Check package.json
  const packageJsonPath = path.join(projectPath, 'package.json');
  if (await fileExists(packageJsonPath)) {
    const packageJson = await loadJsonFile(packageJsonPath);
    const scripts = packageJson.scripts || {};

    // Detect package manager
    const pm = await detectPackageManager(projectPath);

    if (scripts.build) commands.build = `${pm} run build`;
    if (scripts.test) commands.test = `${pm} test`;
    if (scripts['test:watch']) commands.test_watch = `${pm} run test:watch`;
    if (scripts.lint) commands.lint = `${pm} run lint`;
    if (scripts['type-check'] || scripts.typecheck) {
      commands.type_check = `${pm} run ${scripts['type-check'] ? 'type-check' : 'typecheck'}`;
    }
  }

  return commands;
}
```

---

## Default Configuration

```typescript
const DEFAULT_CONFIGURATION: Configuration = {
  general: {
    project_path: '.',
    rtslabs_dir: '.rtslabs',
    plans_dir: 'plans',
    memory_dir: 'memory',
    analysis_dir: 'analysis',
    auto_analyze: true,
    debug_mode: false,
    log_level: 'info'
  },

  llm: {
    default_provider: 'anthropic',
    providers: {
      anthropic: {
        api_key_env: 'ANTHROPIC_API_KEY',
        enabled: true
      }
    },
    models: {
      fast: 'claude-3-5-haiku-20241022',
      standard: 'claude-sonnet-4-20250514',
      powerful: 'claude-opus-4-20250514'
    },
    routing: {
      auto_select: true,
      prefer_cost: false,
      max_retries: 3,
      retry_delay_ms: 1000,
      timeout_ms: 300000
    },
    rate_limits: {
      respect_provider_limits: true
    },
    budget: {
      warn_threshold: 0.8,
      pause_on_exceed: false
    },
    caching: {
      enabled: true,
      ttl_seconds: 3600,
      max_entries: 1000
    }
  },

  decomposition: {
    model_tier: 'standard',
    max_tasks_per_level: 7,
    min_tasks_per_level: 2,
    max_decomposition_depth: 4,
    atomicity_threshold: 0.8,
    auto_decompose_non_atomic: false,
    auto_suggest_templates: true,
    template_confidence_threshold: 0.7,
    require_acceptance_criteria: true,
    require_test_approach: true,
    require_files_affected: true
  },

  execution: {
    worker_pool_size: 3,
    max_workers: 5,
    min_workers: 1,
    max_retries: 3,
    retry_backoff_ms: 1000,
    retry_backoff_multiplier: 2,
    max_backoff_ms: 30000,
    task_timeout_ms: 300000,
    session_timeout_ms: 3600000,
    commit_per_task: true,
    auto_stage_all: false,
    auto_verify: true,
    quick_verify_frequency: 3,
    pause_on_failure: false,
    pause_on_red_flag: false,
    conflict_strategy: 'add_dependency'
  },

  verification: {
    self: {
      enabled: true,
      require_tests: true,
      confidence_threshold: 0.7,
      run_linter: true,
      run_type_check: true
    },
    quick: {
      enabled: true,
      frequency: 3,
      timeout_ms: 60000,
      run_affected_tests: true
    },
    phase_gate: {
      enabled: true,
      require_build: true,
      require_integration_tests: false,
      run_e2e_tests: false
    },
    final: {
      enabled: true,
      full_test_suite: true,
      production_build: true,
      llm_review: true,
      security_scan: false
    },
    red_flags: {
      enabled: true,
      pause_on_critical: true,
      low_confidence_threshold: 0.5,
      max_retries_threshold: 2
    }
  },

  git: {
    worktree_location: 'inside',
    worktree_path: '.rtslabs/worktrees',
    default_base_branch: 'main',
    branch_prefix: 'plan/',
    commit_message_format: 'detailed',
    sign_commits: false,
    include_task_id: true,
    push_on_complete: false,
    create_pr_on_complete: false,
    keep_merged_branches: false
  },

  memory: {
    enabled: true,
    auto_learn: true,
    pattern_extraction: {
      enabled: true,
      min_occurrences: 2,
      confidence_threshold: 0.7,
      use_llm: true
    },
    gotcha_extraction: {
      enabled: true,
      min_severity: 'medium',
      learn_from_retries: true
    },
    retrieval: {
      max_patterns: 5,
      max_gotchas: 3,
      max_history: 5,
      max_entities: 10,
      min_relevance: 0.3
    },
    decay: {
      enabled: true,
      pattern_decay_days: 30,
      gotcha_relevance_days: 60,
      entity_refresh_days: 7,
      summary_refresh_days: 14
    }
  },

  analyzer: {
    auto_analyze: true,
    refresh_interval_days: 7,
    max_files_to_parse: 500,
    max_file_size_kb: 100,
    exclude_patterns: ['node_modules/**', 'dist/**', 'build/**', '*.min.js', '*.bundle.js'],
    entity_extraction: {
      include_private: false,
      generate_summaries: true,
      max_entities_per_file: 50
    },
    pattern_detection: {
      min_occurrences: 2,
      use_llm: true
    }
  },

  ui: {
    port: 3000,
    host: 'localhost',
    open_browser: true,
    theme: 'system',
    notifications: {
      enabled: true,
      sound: false,
      desktop: true
    },
    execution: {
      auto_scroll: true,
      max_output_lines: 1000,
      show_timestamps: true
    },
    diff: {
      default_view: 'split',
      syntax_highlighting: true,
      word_wrap: false
    }
  },

  templates: {
    builtin_enabled: true
  },

  commands: {
    build: 'npm run build',
    test: 'npm test',
    lint: 'npm run lint',
    type_check: 'npx tsc --noEmit'
  }
};
```

---

## CLI Commands

```bash
# Initialize project
rtslabs init [--path <dir>]

# View current config
rtslabs config show [--section <section>]
rtslabs config show llm
rtslabs config show execution.worker_pool_size

# Set config value
rtslabs config set <path> <value>
rtslabs config set execution.worker_pool_size 5
rtslabs config set llm.budget.daily_limit_usd 20

# Unset (revert to default)
rtslabs config unset <path>

# Validate config
rtslabs config validate [--file <path>]

# Generate config
rtslabs config generate [--output <path>] [--full]

# Open config in editor
rtslabs config edit [--global]
```

---

## Integration Points

### With All Components

Every component receives configuration via dependency injection:

```typescript
// NestJS example
@Module({
  providers: [
    {
      provide: 'CONFIG',
      useFactory: async () => {
        const loader = new ConfigurationLoaderImpl();
        return loader.load();
      }
    },
    {
      provide: ExecutionEngine,
      useFactory: (config: Configuration) => {
        return new ExecutionEngine(config.execution);
      },
      inject: ['CONFIG']
    }
  ]
})
export class AppModule {}

// Direct usage
class ExecutionEngine {
  constructor(private config: Configuration['execution']) {}

  async execute(plan: Plan): Promise<void> {
    const workers = new WorkerPool(this.config.worker_pool_size);
    // ...
  }
}
```

---

## JSON Schema

For editor autocompletion and validation:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://rtslabs.dev/schema/config.json",
  "title": "RTSLabs Configuration",
  "type": "object",
  "properties": {
    "general": {
      "type": "object",
      "properties": {
        "project_name": { "type": "string" },
        "debug_mode": { "type": "boolean", "default": false },
        "log_level": {
          "type": "string",
          "enum": ["debug", "info", "warn", "error"],
          "default": "info"
        }
      }
    },
    "llm": {
      "type": "object",
      "properties": {
        "default_provider": {
          "type": "string",
          "enum": ["anthropic", "openai", "local"],
          "default": "anthropic"
        },
        "budget": {
          "type": "object",
          "properties": {
            "daily_limit_usd": { "type": "number", "minimum": 0 },
            "monthly_limit_usd": { "type": "number", "minimum": 0 }
          }
        }
      }
    }
    // ... complete schema
  }
}
```

---

## Security Considerations

```typescript
// Never log or expose sensitive values
const SENSITIVE_KEYS = ['api_key', 'password', 'secret', 'token'];

function sanitizeForLogging(config: any): any {
  const sanitized = { ...config };

  for (const key of Object.keys(sanitized)) {
    if (SENSITIVE_KEYS.some(s => key.toLowerCase().includes(s))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object') {
      sanitized[key] = sanitizeForLogging(sanitized[key]);
    }
  }

  return sanitized;
}

// Validate API keys are not committed
function validateNoSecrets(configPath: string): void {
  const content = fs.readFileSync(configPath, 'utf-8');
  const config = JSON.parse(content);

  const secrets = findSecrets(config);
  if (secrets.length > 0) {
    throw new Error(
      `Config contains secrets that should not be committed: ${secrets.join(', ')}. ` +
      `Use environment variables instead (e.g., api_key_env: "ANTHROPIC_API_KEY").`
    );
  }
}
```
