# LLM Router Specification

The LLM Router manages model selection, request routing, rate limiting, and cost optimization across multiple LLM providers and models.

## Core Responsibility

> Route LLM requests to the appropriate model based on task complexity, cost constraints, and availability, while handling rate limits, retries, and usage tracking.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        LLM ROUTER                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                   REQUEST INTAKE                            │ │
│  │                                                             │ │
│  │  Request → Classify → Select Model → Queue/Execute         │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              │                                   │
│                              ▼                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                   MODEL SELECTOR                            │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │ │
│  │  │   TASK   │  │   COST   │  │   RATE   │  │  FALLBACK  │  │ │
│  │  │ ANALYZER │  │ OPTIMIZER│  │ LIMITER  │  │  HANDLER   │  │ │
│  │  └──────────┘  └──────────┘  └──────────┘  └────────────┘  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              │                                   │
│                              ▼                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                   PROVIDER ADAPTERS                         │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │ │
│  │  │ ANTHROPIC│  │  OPENAI  │  │  LOCAL   │  │   CUSTOM   │  │ │
│  │  │  Claude  │  │   GPT    │  │  Ollama  │  │  Provider  │  │ │
│  │  └──────────┘  └──────────┘  └──────────┘  └────────────┘  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              │                                   │
│                              ▼                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                   USAGE TRACKER                             │ │
│  │                                                             │ │
│  │  Tokens • Cost • Latency • Success Rate • Rate Limits      │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Model Tiers

### Tier System

```typescript
enum ModelTier {
  FAST = 'fast',           // Quick, cheap tasks
  STANDARD = 'standard',   // Most tasks
  POWERFUL = 'powerful',   // Complex reasoning
  SPECIALIZED = 'specialized'  // Code-specific models
}

interface ModelDefinition {
  id: string;                    // e.g., 'claude-sonnet-4-20250514'
  provider: Provider;
  tier: ModelTier;

  // Capabilities
  capabilities: {
    max_tokens: number;
    supports_vision: boolean;
    supports_tools: boolean;
    supports_streaming: boolean;
    context_window: number;
  };

  // Cost (per 1M tokens)
  pricing: {
    input: number;
    output: number;
    cached_input?: number;
  };

  // Performance characteristics
  performance: {
    avg_latency_ms: number;
    tokens_per_second: number;
    reliability: number;        // 0-1, uptime
  };

  // Rate limits
  rate_limits: {
    requests_per_minute: number;
    tokens_per_minute: number;
    tokens_per_day?: number;
  };
}

type Provider = 'anthropic' | 'openai' | 'google' | 'local' | 'custom';
```

### Default Model Configuration

```typescript
const DEFAULT_MODELS: ModelDefinition[] = [
  // Fast tier - for summaries, simple extractions
  {
    id: 'claude-3-5-haiku-20241022',
    provider: 'anthropic',
    tier: ModelTier.FAST,
    capabilities: {
      max_tokens: 8192,
      supports_vision: true,
      supports_tools: true,
      supports_streaming: true,
      context_window: 200000
    },
    pricing: { input: 0.80, output: 4.00 },
    performance: {
      avg_latency_ms: 500,
      tokens_per_second: 100,
      reliability: 0.99
    },
    rate_limits: {
      requests_per_minute: 50,
      tokens_per_minute: 50000
    }
  },

  // Standard tier - for most tasks
  {
    id: 'claude-sonnet-4-20250514',
    provider: 'anthropic',
    tier: ModelTier.STANDARD,
    capabilities: {
      max_tokens: 16384,
      supports_vision: true,
      supports_tools: true,
      supports_streaming: true,
      context_window: 200000
    },
    pricing: { input: 3.00, output: 15.00 },
    performance: {
      avg_latency_ms: 1500,
      tokens_per_second: 80,
      reliability: 0.99
    },
    rate_limits: {
      requests_per_minute: 40,
      tokens_per_minute: 40000
    }
  },

  // Powerful tier - for complex decomposition, architecture
  {
    id: 'claude-opus-4-20250514',
    provider: 'anthropic',
    tier: ModelTier.POWERFUL,
    capabilities: {
      max_tokens: 32768,
      supports_vision: true,
      supports_tools: true,
      supports_streaming: true,
      context_window: 200000
    },
    pricing: { input: 15.00, output: 75.00 },
    performance: {
      avg_latency_ms: 3000,
      tokens_per_second: 50,
      reliability: 0.99
    },
    rate_limits: {
      requests_per_minute: 20,
      tokens_per_minute: 20000
    }
  }
];
```

---

## Task Classification

### Task Types and Model Mapping

```typescript
interface TaskClassification {
  type: LLMTaskType;
  complexity: 'trivial' | 'simple' | 'moderate' | 'complex';
  estimated_tokens: {
    input: number;
    output: number;
  };
  requires_vision: boolean;
  requires_tools: boolean;
  priority: 'low' | 'normal' | 'high';
  preferred_tier: ModelTier;
}

type LLMTaskType =
  | 'file_summary'           // Summarize a file
  | 'entity_extraction'      // Extract code entities
  | 'pattern_detection'      // Find code patterns
  | 'task_decomposition'     // Break down feature request
  | 'task_execution'         // Execute a coding task
  | 'code_review'            // Review code changes
  | 'verification'           // Verify task completion
  | 'architecture_analysis'  // Analyze architecture
  | 'error_analysis'         // Analyze error/failure
  | 'chat_response';         // General chat/Q&A

const TASK_MODEL_MAPPING: Record<LLMTaskType, ModelTierPreference> = {
  file_summary: {
    preferred: ModelTier.FAST,
    fallback: ModelTier.STANDARD,
    reason: 'Simple extraction, speed matters'
  },
  entity_extraction: {
    preferred: ModelTier.FAST,
    fallback: ModelTier.STANDARD,
    reason: 'Structured extraction, volume is high'
  },
  pattern_detection: {
    preferred: ModelTier.STANDARD,
    fallback: ModelTier.POWERFUL,
    reason: 'Requires pattern recognition'
  },
  task_decomposition: {
    preferred: ModelTier.STANDARD,
    fallback: ModelTier.POWERFUL,
    reason: 'Requires understanding and planning'
  },
  task_execution: {
    preferred: ModelTier.STANDARD,
    fallback: ModelTier.POWERFUL,
    reason: 'Core coding tasks, balance quality/cost'
  },
  code_review: {
    preferred: ModelTier.STANDARD,
    fallback: ModelTier.POWERFUL,
    reason: 'Requires careful analysis'
  },
  verification: {
    preferred: ModelTier.FAST,
    fallback: ModelTier.STANDARD,
    reason: 'Quick checks, high volume'
  },
  architecture_analysis: {
    preferred: ModelTier.POWERFUL,
    fallback: ModelTier.STANDARD,
    reason: 'Complex reasoning required'
  },
  error_analysis: {
    preferred: ModelTier.STANDARD,
    fallback: ModelTier.POWERFUL,
    reason: 'Debugging requires careful thought'
  },
  chat_response: {
    preferred: ModelTier.STANDARD,
    fallback: ModelTier.FAST,
    reason: 'General purpose'
  }
};
```

### Complexity Estimation

```typescript
interface ComplexityEstimator {
  estimate(request: LLMRequest): TaskClassification;
}

function estimateComplexity(request: LLMRequest): TaskClassification {
  const { taskType, prompt, context } = request;

  // Estimate input tokens
  const inputTokens = estimateTokens(prompt) +
                      estimateTokens(context?.files || []) +
                      estimateTokens(context?.memory || []);

  // Estimate output tokens based on task type
  const outputTokens = OUTPUT_ESTIMATES[taskType] || 1000;

  // Determine complexity
  let complexity: TaskClassification['complexity'];

  if (inputTokens < 1000 && taskType === 'file_summary') {
    complexity = 'trivial';
  } else if (inputTokens < 5000) {
    complexity = 'simple';
  } else if (inputTokens < 20000) {
    complexity = 'moderate';
  } else {
    complexity = 'complex';
  }

  // Override for certain task types
  if (taskType === 'architecture_analysis') {
    complexity = complexity === 'trivial' ? 'simple' : complexity;
  }
  if (taskType === 'task_decomposition' && context?.isInitial) {
    complexity = 'moderate';  // Initial decomposition needs more thought
  }

  return {
    type: taskType,
    complexity,
    estimated_tokens: { input: inputTokens, output: outputTokens },
    requires_vision: request.images?.length > 0,
    requires_tools: request.tools?.length > 0,
    priority: request.priority || 'normal',
    preferred_tier: getPreferredTier(taskType, complexity)
  };
}

function getPreferredTier(taskType: LLMTaskType, complexity: string): ModelTier {
  const mapping = TASK_MODEL_MAPPING[taskType];

  // Upgrade tier for complex tasks
  if (complexity === 'complex' && mapping.preferred !== ModelTier.POWERFUL) {
    return mapping.fallback || ModelTier.POWERFUL;
  }

  return mapping.preferred;
}
```

---

## Core Components

### 1. Request Router

Central routing logic for all LLM requests.

```typescript
interface LLMRouter {
  // Main routing method
  route(request: LLMRequest): Promise<LLMResponse>;

  // Batch requests
  routeBatch(requests: LLMRequest[]): Promise<LLMResponse[]>;

  // Streaming
  routeStream(request: LLMRequest): AsyncIterator<LLMStreamChunk>;

  // Model info
  getAvailableModels(): ModelDefinition[];
  getModelStatus(modelId: string): ModelStatus;
}

interface LLMRequest {
  id: string;
  taskType: LLMTaskType;

  // Content
  prompt: string;
  system_prompt?: string;
  images?: ImageInput[];

  // Context
  context?: {
    files?: FileContent[];
    memory?: MemoryContext[];
    conversation?: Message[];
  };

  // Options
  tools?: Tool[];
  max_tokens?: number;
  temperature?: number;

  // Routing hints
  preferred_model?: string;      // Override model selection
  preferred_tier?: ModelTier;    // Suggest tier
  priority?: 'low' | 'normal' | 'high';
  budget?: {
    max_cost_usd?: number;
    max_tokens?: number;
  };

  // Retry options
  retry?: {
    max_attempts?: number;
    fallback_tiers?: ModelTier[];
  };
}

interface LLMResponse {
  id: string;
  request_id: string;

  // Content
  content: string;
  tool_calls?: ToolCall[];

  // Metadata
  model: string;
  provider: Provider;

  // Usage
  usage: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    cost_usd: number;
  };

  // Performance
  latency_ms: number;

  // Status
  finish_reason: 'stop' | 'max_tokens' | 'tool_use' | 'error';
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
}
```

**Routing Implementation:**

```typescript
class LLMRouterImpl implements LLMRouter {
  async route(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();

    // 1. Classify the task
    const classification = this.complexityEstimator.estimate(request);

    // 2. Select model
    const model = await this.selectModel(request, classification);

    // 3. Check rate limits
    await this.rateLimiter.acquire(model.id, classification.estimated_tokens);

    // 4. Execute with retries
    let lastError: Error | null = null;
    const maxAttempts = request.retry?.max_attempts || 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await this.executeRequest(model, request);

        // Track usage
        await this.usageTracker.record({
          request_id: request.id,
          model: model.id,
          tokens: response.usage,
          latency_ms: Date.now() - startTime,
          success: true
        });

        return response;

      } catch (error) {
        lastError = error;

        if (!this.shouldRetry(error, attempt, maxAttempts)) {
          break;
        }

        // Try fallback model
        if (attempt < maxAttempts) {
          model = await this.selectFallbackModel(model, request, classification);
          await this.delay(this.getBackoff(attempt));
        }
      }
    }

    // Track failure
    await this.usageTracker.record({
      request_id: request.id,
      model: model.id,
      tokens: { input: 0, output: 0, total: 0 },
      latency_ms: Date.now() - startTime,
      success: false,
      error: lastError?.message
    });

    throw lastError;
  }

  private async selectModel(
    request: LLMRequest,
    classification: TaskClassification
  ): Promise<ModelDefinition> {
    // User override
    if (request.preferred_model) {
      const model = this.getModel(request.preferred_model);
      if (model && await this.isAvailable(model)) {
        return model;
      }
    }

    // Get models for preferred tier
    const tier = request.preferred_tier || classification.preferred_tier;
    let candidates = this.getModelsForTier(tier);

    // Filter by capabilities
    if (classification.requires_vision) {
      candidates = candidates.filter(m => m.capabilities.supports_vision);
    }
    if (classification.requires_tools) {
      candidates = candidates.filter(m => m.capabilities.supports_tools);
    }

    // Filter by context window
    const requiredContext = classification.estimated_tokens.input * 1.5;
    candidates = candidates.filter(m =>
      m.capabilities.context_window >= requiredContext
    );

    // Filter by budget
    if (request.budget?.max_cost_usd) {
      const maxCost = request.budget.max_cost_usd;
      candidates = candidates.filter(m => {
        const estimatedCost = this.estimateCost(m, classification.estimated_tokens);
        return estimatedCost <= maxCost;
      });
    }

    // Filter by availability (rate limits)
    candidates = await this.filterByAvailability(candidates);

    if (candidates.length === 0) {
      throw new Error('No suitable model available');
    }

    // Select best candidate (by cost for same tier)
    return this.selectOptimalModel(candidates, classification);
  }
}
```

---

### 2. Rate Limiter

Manages rate limits across models and providers.

```typescript
interface RateLimiter {
  // Check availability
  canProceed(modelId: string, estimatedTokens: number): Promise<boolean>;

  // Acquire permit
  acquire(modelId: string, estimatedTokens: number): Promise<void>;

  // Release (if request fails before completion)
  release(modelId: string, tokens: number): void;

  // Get current status
  getStatus(modelId: string): RateLimitStatus;

  // Wait for availability
  waitForAvailability(modelId: string, estimatedTokens: number): Promise<void>;
}

interface RateLimitStatus {
  model_id: string;

  requests: {
    used: number;
    limit: number;
    remaining: number;
    resets_at: Date;
  };

  tokens: {
    used: number;
    limit: number;
    remaining: number;
    resets_at: Date;
  };

  daily_tokens?: {
    used: number;
    limit: number;
    remaining: number;
    resets_at: Date;
  };

  estimated_wait_ms: number;
}
```

**Token Bucket Implementation:**

```typescript
class TokenBucketRateLimiter implements RateLimiter {
  private buckets: Map<string, TokenBucket> = new Map();

  async acquire(modelId: string, estimatedTokens: number): Promise<void> {
    const bucket = this.getBucket(modelId);

    // Check if we can proceed
    while (!bucket.tryConsume(1, estimatedTokens)) {
      const waitTime = bucket.getWaitTime(1, estimatedTokens);

      if (waitTime > 60000) {
        throw new RateLimitError(`Rate limit exceeded, wait ${waitTime}ms`);
      }

      await this.delay(Math.min(waitTime, 5000));
    }
  }

  getStatus(modelId: string): RateLimitStatus {
    const bucket = this.getBucket(modelId);
    const model = this.models.get(modelId);

    return {
      model_id: modelId,
      requests: {
        used: model.rate_limits.requests_per_minute - bucket.requestTokens,
        limit: model.rate_limits.requests_per_minute,
        remaining: bucket.requestTokens,
        resets_at: bucket.requestResetTime
      },
      tokens: {
        used: model.rate_limits.tokens_per_minute - bucket.tokenTokens,
        limit: model.rate_limits.tokens_per_minute,
        remaining: bucket.tokenTokens,
        resets_at: bucket.tokenResetTime
      },
      estimated_wait_ms: bucket.getWaitTime(1, 1000)
    };
  }
}

class TokenBucket {
  private requestTokens: number;
  private tokenTokens: number;
  private lastRefill: number;

  constructor(
    private requestsPerMinute: number,
    private tokensPerMinute: number
  ) {
    this.requestTokens = requestsPerMinute;
    this.tokenTokens = tokensPerMinute;
    this.lastRefill = Date.now();
  }

  tryConsume(requests: number, tokens: number): boolean {
    this.refill();

    if (this.requestTokens >= requests && this.tokenTokens >= tokens) {
      this.requestTokens -= requests;
      this.tokenTokens -= tokens;
      return true;
    }

    return false;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;

    if (elapsed >= 60000) {
      // Full refill
      this.requestTokens = this.requestsPerMinute;
      this.tokenTokens = this.tokensPerMinute;
      this.lastRefill = now;
    } else {
      // Partial refill
      const fraction = elapsed / 60000;
      this.requestTokens = Math.min(
        this.requestsPerMinute,
        this.requestTokens + Math.floor(this.requestsPerMinute * fraction)
      );
      this.tokenTokens = Math.min(
        this.tokensPerMinute,
        this.tokenTokens + Math.floor(this.tokensPerMinute * fraction)
      );
    }
  }
}
```

---

### 3. Provider Adapters

Unified interface for different LLM providers.

```typescript
interface ProviderAdapter {
  readonly provider: Provider;

  // Capabilities
  getModels(): ModelDefinition[];
  supports(capability: string): boolean;

  // Execution
  complete(request: ProviderRequest): Promise<ProviderResponse>;
  stream(request: ProviderRequest): AsyncIterator<ProviderStreamChunk>;

  // Health
  healthCheck(): Promise<boolean>;
}

interface ProviderRequest {
  model: string;
  messages: Message[];
  system?: string;
  max_tokens?: number;
  temperature?: number;
  tools?: Tool[];
  tool_choice?: ToolChoice;
}

// Anthropic Adapter
class AnthropicAdapter implements ProviderAdapter {
  readonly provider = 'anthropic';
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async complete(request: ProviderRequest): Promise<ProviderResponse> {
    const response = await this.client.messages.create({
      model: request.model,
      max_tokens: request.max_tokens || 4096,
      system: request.system,
      messages: this.convertMessages(request.messages),
      tools: request.tools?.map(this.convertTool),
      temperature: request.temperature
    });

    return this.convertResponse(response);
  }

  async *stream(request: ProviderRequest): AsyncIterator<ProviderStreamChunk> {
    const stream = await this.client.messages.stream({
      model: request.model,
      max_tokens: request.max_tokens || 4096,
      system: request.system,
      messages: this.convertMessages(request.messages)
    });

    for await (const event of stream) {
      yield this.convertStreamEvent(event);
    }
  }
}

// OpenAI Adapter
class OpenAIAdapter implements ProviderAdapter {
  readonly provider = 'openai';
  private client: OpenAI;

  async complete(request: ProviderRequest): Promise<ProviderResponse> {
    const response = await this.client.chat.completions.create({
      model: request.model,
      messages: this.convertMessages(request.messages),
      max_tokens: request.max_tokens,
      temperature: request.temperature,
      tools: request.tools?.map(this.convertTool)
    });

    return this.convertResponse(response);
  }
}

// Local/Ollama Adapter
class OllamaAdapter implements ProviderAdapter {
  readonly provider = 'local';
  private baseUrl: string;

  constructor(baseUrl = 'http://localhost:11434') {
    this.baseUrl = baseUrl;
  }

  async complete(request: ProviderRequest): Promise<ProviderResponse> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        stream: false
      })
    });

    const data = await response.json();
    return this.convertResponse(data);
  }
}
```

---

### 4. Usage Tracker

Tracks token usage, costs, and performance metrics.

```typescript
interface UsageTracker {
  // Record usage
  record(usage: UsageRecord): Promise<void>;

  // Query usage
  getUsage(filter: UsageFilter): Promise<UsageSummary>;
  getUsageByModel(modelId: string, period: Period): Promise<ModelUsage>;
  getUsageByTask(taskType: LLMTaskType, period: Period): Promise<TaskUsage>;

  // Budgets
  checkBudget(scope: string): Promise<BudgetStatus>;
  setBudget(scope: string, budget: Budget): Promise<void>;

  // Alerts
  onBudgetThreshold(callback: (alert: BudgetAlert) => void): void;
}

interface UsageRecord {
  request_id: string;
  timestamp?: Date;

  // Model
  model: string;
  provider: Provider;
  task_type?: LLMTaskType;

  // Tokens
  tokens: {
    input: number;
    output: number;
    total: number;
    cached_input?: number;
  };

  // Cost
  cost_usd?: number;

  // Performance
  latency_ms: number;

  // Context
  plan_id?: string;
  task_id?: string;

  // Outcome
  success: boolean;
  error?: string;
}

interface UsageSummary {
  period: Period;

  totals: {
    requests: number;
    tokens_input: number;
    tokens_output: number;
    tokens_total: number;
    cost_usd: number;
  };

  by_model: Record<string, ModelUsage>;
  by_task_type: Record<LLMTaskType, TaskUsage>;
  by_day: DailyUsage[];

  performance: {
    avg_latency_ms: number;
    p95_latency_ms: number;
    success_rate: number;
    retry_rate: number;
  };
}

interface Budget {
  period: 'daily' | 'weekly' | 'monthly';
  limit_usd?: number;
  limit_tokens?: number;
  warn_threshold?: number;  // 0-1, e.g., 0.8 = warn at 80%
}

interface BudgetStatus {
  scope: string;
  budget: Budget;
  used: {
    cost_usd: number;
    tokens: number;
  };
  remaining: {
    cost_usd: number;
    tokens: number;
  };
  percentage_used: number;
  projected_end_of_period: {
    cost_usd: number;
    tokens: number;
  };
  on_track: boolean;
}
```

**Usage Storage:**

```typescript
// Usage stored in .rtslabs/usage/
// - usage-{YYYY-MM}.jsonl (monthly files)
// - summary.json (aggregated stats)

async function recordUsage(record: UsageRecord): Promise<void> {
  const monthFile = getMonthlyFile(record.timestamp || new Date());

  // Calculate cost if not provided
  if (!record.cost_usd) {
    record.cost_usd = calculateCost(record.model, record.tokens);
  }

  // Append to monthly file
  await appendToFile(monthFile, record);

  // Update summary
  await updateSummary(record);

  // Check budget alerts
  await checkBudgetAlerts(record);
}

function calculateCost(modelId: string, tokens: TokenUsage): number {
  const model = getModel(modelId);
  if (!model) return 0;

  const inputCost = (tokens.input / 1_000_000) * model.pricing.input;
  const outputCost = (tokens.output / 1_000_000) * model.pricing.output;
  const cachedCost = tokens.cached_input
    ? (tokens.cached_input / 1_000_000) * (model.pricing.cached_input || model.pricing.input * 0.1)
    : 0;

  return inputCost + outputCost + cachedCost;
}
```

---

### 5. Fallback Handler

Manages model fallbacks and degradation.

```typescript
interface FallbackHandler {
  // Get fallback for failed model
  getFallback(
    failedModel: ModelDefinition,
    error: Error,
    classification: TaskClassification
  ): Promise<ModelDefinition | null>;

  // Check if error is recoverable with fallback
  isRecoverable(error: Error): boolean;

  // Record fallback for learning
  recordFallback(from: string, to: string, reason: string): void;
}

class FallbackHandlerImpl implements FallbackHandler {
  private fallbackChain: Map<ModelTier, ModelTier[]> = new Map([
    [ModelTier.FAST, [ModelTier.STANDARD, ModelTier.POWERFUL]],
    [ModelTier.STANDARD, [ModelTier.POWERFUL, ModelTier.FAST]],
    [ModelTier.POWERFUL, [ModelTier.STANDARD]],
  ]);

  async getFallback(
    failedModel: ModelDefinition,
    error: Error,
    classification: TaskClassification
  ): Promise<ModelDefinition | null> {
    // Don't fallback for certain errors
    if (!this.isRecoverable(error)) {
      return null;
    }

    // Get fallback tiers
    const fallbackTiers = this.fallbackChain.get(failedModel.tier) || [];

    for (const tier of fallbackTiers) {
      const candidates = this.getModelsForTier(tier)
        .filter(m => m.id !== failedModel.id)
        .filter(m => this.meetsRequirements(m, classification));

      // Check availability
      for (const candidate of candidates) {
        if (await this.rateLimiter.canProceed(candidate.id,
            classification.estimated_tokens.input + classification.estimated_tokens.output)) {
          return candidate;
        }
      }
    }

    // Try different provider same tier
    const sameProviderModels = this.getModelsForTier(failedModel.tier)
      .filter(m => m.provider !== failedModel.provider);

    for (const candidate of sameProviderModels) {
      if (await this.rateLimiter.canProceed(candidate.id,
          classification.estimated_tokens.input + classification.estimated_tokens.output)) {
        return candidate;
      }
    }

    return null;
  }

  isRecoverable(error: Error): boolean {
    // Rate limit errors - try different model
    if (error instanceof RateLimitError) return true;

    // Service unavailable - try different provider
    if (error instanceof ServiceUnavailableError) return true;

    // Timeout - might work with different model
    if (error instanceof TimeoutError) return true;

    // Context too long - need larger model
    if (error instanceof ContextLengthError) return true;

    // Auth errors, invalid requests - not recoverable
    if (error instanceof AuthError) return false;
    if (error instanceof InvalidRequestError) return false;

    return false;
  }
}
```

---

## Request Queue

For managing concurrent requests:

```typescript
interface RequestQueue {
  // Add request to queue
  enqueue(request: LLMRequest): Promise<string>;  // Returns queue ID

  // Get request status
  getStatus(queueId: string): QueueStatus;

  // Cancel request
  cancel(queueId: string): Promise<boolean>;

  // Wait for result
  await(queueId: string): Promise<LLMResponse>;
}

interface QueueStatus {
  queue_id: string;
  request_id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  position?: number;           // Position in queue
  estimated_wait_ms?: number;
  result?: LLMResponse;
  error?: Error;
}

class PriorityRequestQueue implements RequestQueue {
  private queues: Map<string, PriorityQueue<QueuedRequest>> = new Map();
  private processing: Map<string, number> = new Map();  // modelId -> count

  async enqueue(request: LLMRequest): Promise<string> {
    const classification = this.classifier.estimate(request);
    const model = await this.modelSelector.select(request, classification);

    const queueId = generateId();
    const queuedRequest: QueuedRequest = {
      id: queueId,
      request,
      classification,
      model,
      priority: this.calculatePriority(request, classification),
      enqueuedAt: Date.now()
    };

    // Add to model-specific queue
    const queue = this.getQueue(model.id);
    queue.push(queuedRequest);

    // Process queue
    this.processQueue(model.id);

    return queueId;
  }

  private calculatePriority(request: LLMRequest, classification: TaskClassification): number {
    let priority = 100;  // Base priority

    // Adjust by request priority
    if (request.priority === 'high') priority += 50;
    if (request.priority === 'low') priority -= 30;

    // Adjust by task type (execution > verification > summary)
    if (classification.type === 'task_execution') priority += 20;
    if (classification.type === 'verification') priority += 10;
    if (classification.type === 'file_summary') priority -= 10;

    // Penalize large requests slightly
    if (classification.estimated_tokens.input > 10000) priority -= 10;

    return priority;
  }
}
```

---

## Caching

Optional response caching for repeated queries:

```typescript
interface ResponseCache {
  // Get cached response
  get(key: string): Promise<CachedResponse | null>;

  // Cache response
  set(key: string, response: LLMResponse, ttl?: number): Promise<void>;

  // Generate cache key
  generateKey(request: LLMRequest): string;

  // Clear cache
  clear(pattern?: string): Promise<void>;
}

interface CachedResponse {
  response: LLMResponse;
  cached_at: Date;
  expires_at: Date;
  hits: number;
}

function generateCacheKey(request: LLMRequest): string {
  // Hash based on: model, system prompt, user prompt, temperature
  const hashInput = JSON.stringify({
    model: request.preferred_model,
    system: request.system_prompt,
    prompt: request.prompt,
    temperature: request.temperature || 0
  });

  return crypto.createHash('sha256').update(hashInput).digest('hex').slice(0, 16);
}

// Only cache deterministic requests (temperature = 0)
function isCacheable(request: LLMRequest): boolean {
  return (request.temperature === 0 || request.temperature === undefined) &&
         !request.tools?.length &&  // Don't cache tool use
         CACHEABLE_TASK_TYPES.includes(request.taskType);
}

const CACHEABLE_TASK_TYPES: LLMTaskType[] = [
  'file_summary',
  'entity_extraction',
  'pattern_detection'
];
```

---

## Configuration

```json
// .rtslabs/config.json
{
  "llm": {
    "default_provider": "anthropic",
    "default_tier": "standard",

    "providers": {
      "anthropic": {
        "api_key_env": "ANTHROPIC_API_KEY",
        "enabled": true
      },
      "openai": {
        "api_key_env": "OPENAI_API_KEY",
        "enabled": false
      },
      "local": {
        "base_url": "http://localhost:11434",
        "enabled": false
      }
    },

    "models": {
      "fast": "claude-3-5-haiku-20241022",
      "standard": "claude-sonnet-4-20250514",
      "powerful": "claude-opus-4-20250514"
    },

    "routing": {
      "auto_select": true,
      "prefer_cost_over_speed": false,
      "max_retries": 3,
      "retry_delay_ms": 1000
    },

    "rate_limits": {
      "respect_provider_limits": true,
      "custom_limits": {
        "requests_per_minute": null,
        "tokens_per_minute": null
      }
    },

    "budget": {
      "daily_limit_usd": null,
      "monthly_limit_usd": null,
      "warn_threshold": 0.8
    },

    "caching": {
      "enabled": true,
      "ttl_seconds": 3600,
      "max_entries": 1000
    }
  }
}
```

---

## Integration Points

### With Decomposition Engine
- Provides standard/powerful tier for decomposition
- Tracks decomposition token usage

### With Execution Engine
- Routes task execution requests
- Handles parallel request queuing

### With Verification System
- Provides fast tier for quick checks
- Standard tier for detailed verification

### With Project Analyzer
- Fast tier for file summaries
- Standard tier for pattern detection

### With Memory System
- Records usage patterns
- Learns optimal model selection

---

## Metrics

```typescript
interface LLMRouterMetrics {
  // Volume
  total_requests: number;
  requests_by_model: Record<string, number>;
  requests_by_task_type: Record<LLMTaskType, number>;

  // Cost
  total_cost_usd: number;
  cost_by_model: Record<string, number>;
  cost_by_task_type: Record<LLMTaskType, number>;
  avg_cost_per_request: number;

  // Tokens
  total_tokens: number;
  tokens_by_model: Record<string, number>;
  avg_tokens_per_request: number;

  // Performance
  avg_latency_ms: number;
  p50_latency_ms: number;
  p95_latency_ms: number;
  p99_latency_ms: number;

  // Reliability
  success_rate: number;
  retry_rate: number;
  fallback_rate: number;
  rate_limit_hits: number;

  // Efficiency
  cache_hit_rate: number;
  model_selection_accuracy: number;  // How often preferred tier was used
}
```
