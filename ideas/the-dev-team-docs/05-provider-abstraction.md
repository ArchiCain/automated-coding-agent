# 05 — Coding Agent Provider Abstraction

## Goal

Create a clean provider interface that abstracts the AI coding engine. Claude Code SDK and OpenCode are the two implementations. The orchestrator sees the same contract regardless of which engine runs a given role.

## Current State

The coding-agent backend already has a provider pattern:

- `src/features/claude-code-agent/providers/claude-code.provider.ts` — Claude Code SDK integration
- `src/features/claude-code-agent/providers/opencode.provider.ts` — OpenCode provider (stub)
- `src/features/claude-code-agent/providers/agent-provider-registry.ts` — Factory for resolving providers
- `src/features/claude-code-agent/core/base-agent.ts` — State types (`AgentState`, `AgentActivity`, `AgentSession`)

**Dependencies:**
- `@anthropic-ai/claude-code` (2.1.12) — Claude Code SDK
- `@anthropic-ai/claude-agent-sdk` (0.2.12) — Claude Agent SDK

## Target State

A `CodingAgentProvider` interface with two implementations. The provider registry resolves the right implementation based on role config. Each provider emits a unified `AgentMessage` stream.

```
src/providers/
├── provider.module.ts
├── coding-agent-provider.interface.ts    ← The contract
├── agent-message.interface.ts            ← Unified message types
├── claude-code.provider.ts               ← Anthropic implementation
├── opencode.provider.ts                  ← Open source implementation
└── provider-registry.service.ts          ← Role → provider resolution
```

## Implementation Steps

### Step 1: Define the Provider Interface

Create `src/providers/coding-agent-provider.interface.ts`:

```typescript
export interface CodingAgentProvider {
  readonly id: string;
  readonly name: string;

  execute(request: AgentExecutionRequest): AsyncIterable<AgentMessage>;
  healthCheck(): Promise<ProviderHealthStatus>;
  capabilities(): ProviderCapabilities;
}

export interface AgentExecutionRequest {
  prompt: string;
  cwd: string;
  systemPrompt: string;
  allowedTools: string[];
  sessionId?: string;        // For session resume
  signal?: AbortSignal;      // For cancellation
}

export interface AgentMessage {
  type: 'text' | 'tool_use' | 'tool_result' | 'error' | 'status' | 'complete';
  content: string;
  raw?: unknown;             // Provider-specific data for logging
}

export interface ProviderCapabilities {
  shellExecution: boolean;
  fileOperations: boolean;
  agenticLoop: boolean;
  sessionResume: boolean;
  contextWindow: number;
}

export interface ProviderHealthStatus {
  healthy: boolean;
  message?: string;
  latencyMs?: number;
}
```

### Step 2: Implement Claude Code Provider

Refactor the existing `claude-code.provider.ts` to implement the new interface.

The existing provider already uses `@anthropic-ai/claude-code`. The main changes:
1. Implement `CodingAgentProvider` interface
2. Return `AsyncIterable<AgentMessage>` instead of the current return type
3. Map Claude Code SDK message types to the unified `AgentMessage` format

```typescript
import { query, type Message } from '@anthropic-ai/claude-code';

@Injectable()
export class ClaudeCodeProvider implements CodingAgentProvider {
  readonly id = 'claude-code';
  readonly name = 'Claude Code';

  constructor(private model: string = 'claude-sonnet-4-6') {}

  async *execute(request: AgentExecutionRequest): AsyncIterable<AgentMessage> {
    const stream = query({
      prompt: request.prompt,
      options: {
        cwd: request.cwd,
        systemPrompt: request.systemPrompt,
        allowedTools: request.allowedTools,
        model: this.model,
        ...(request.sessionId && { resume: { id: request.sessionId, transcript: [] } }),
      },
    });

    for await (const message of stream) {
      yield this.mapMessage(message);
    }
  }

  capabilities(): ProviderCapabilities {
    return {
      shellExecution: true,
      fileOperations: true,
      agenticLoop: true,
      sessionResume: true,
      contextWindow: this.model.includes('opus') ? 200_000 : 200_000,
    };
  }

  async healthCheck(): Promise<ProviderHealthStatus> {
    try {
      // Quick check: verify ANTHROPIC_API_KEY is set
      if (!process.env.ANTHROPIC_API_KEY) {
        return { healthy: false, message: 'ANTHROPIC_API_KEY not set' };
      }
      return { healthy: true };
    } catch (error) {
      return { healthy: false, message: String(error) };
    }
  }

  private mapMessage(msg: Message): AgentMessage {
    // Map the Claude Code SDK message types to our unified format
    // The SDK emits different message types: assistant, tool_use, tool_result, etc.
    // Inspect the existing claude-code.provider.ts for the current mapping logic
    switch (msg.type) {
      case 'assistant':
        return { type: 'text', content: msg.message?.content ?? '', raw: msg };
      case 'tool_use':
        return { type: 'tool_use', content: JSON.stringify(msg), raw: msg };
      case 'tool_result':
        return { type: 'tool_result', content: JSON.stringify(msg), raw: msg };
      case 'error':
        return { type: 'error', content: msg.error ?? 'Unknown error', raw: msg };
      default:
        return { type: 'status', content: JSON.stringify(msg), raw: msg };
    }
  }
}
```

### Step 3: Implement OpenCode Provider

Refactor the existing `opencode.provider.ts` stub into a real implementation.

OpenCode is an open-source coding agent that supports multiple LLM backends. The implementation depends on OpenCode's API surface — check their docs for the exact SDK interface.

```typescript
@Injectable()
export class OpenCodeProvider implements CodingAgentProvider {
  readonly id: string;
  readonly name: string;

  constructor(
    private modelProvider: string,   // "gemini", "ollama", "openai"
    private modelId: string,         // "gemini-2.5-pro", "llama3.3:70b"
  ) {
    this.id = `opencode-${modelProvider}`;
    this.name = `OpenCode (${modelProvider}/${modelId})`;
  }

  async *execute(request: AgentExecutionRequest): AsyncIterable<AgentMessage> {
    // OpenCode CLI or SDK integration
    // This needs to be fleshed out based on OpenCode's actual API
    // For now, spawn opencode as a subprocess with the right config
    throw new Error('OpenCode provider not yet implemented');
  }

  capabilities(): ProviderCapabilities {
    return {
      shellExecution: true,
      fileOperations: true,
      agenticLoop: true,
      sessionResume: false,     // Check OpenCode's capabilities
      contextWindow: this.getContextWindow(),
    };
  }

  async healthCheck(): Promise<ProviderHealthStatus> {
    // Check if opencode CLI is installed and model endpoint is reachable
    try {
      // execSync('opencode --version')
      return { healthy: true };
    } catch {
      return { healthy: false, message: 'OpenCode CLI not found' };
    }
  }

  private getContextWindow(): number {
    const windows: Record<string, number> = {
      'gemini-2.5-pro': 1_000_000,
      'gpt-4.1': 1_000_000,
      'llama3.3:70b': 128_000,
    };
    return windows[this.modelId] ?? 128_000;
  }
}
```

### Step 4: Implement Provider Registry

Refactor the existing `agent-provider-registry.ts` to resolve providers based on role config:

```typescript
@Injectable()
export class ProviderRegistryService {
  private providers = new Map<string, CodingAgentProvider>();

  constructor(private config: DevTeamConfigService) {}

  getForRole(role: TaskRole): CodingAgentProvider {
    const providerConfig = this.config.getProviderConfig(role);
    return this.resolve(providerConfig);
  }

  private resolve(config: ProviderConfig): CodingAgentProvider {
    const key = config.engine === 'anthropic'
      ? `claude-code:${config.model}`
      : `opencode:${config.provider}:${config.model}`;

    if (!this.providers.has(key)) {
      const provider = config.engine === 'anthropic'
        ? new ClaudeCodeProvider(config.model)
        : new OpenCodeProvider(config.provider!, config.model);
      this.providers.set(key, provider);
    }

    return this.providers.get(key)!;
  }

  async healthCheckAll(): Promise<Map<string, ProviderHealthStatus>> {
    const results = new Map();
    for (const [key, provider] of this.providers) {
      results.set(key, await provider.healthCheck());
    }
    return results;
  }
}
```

### Step 5: Define Role and Config Types

Create `src/config/dev-team-config.interface.ts`:

```typescript
export type TaskRole =
  | 'architect'
  | 'implementer'
  | 'reviewer'
  | 'tester'
  | 'designer'
  | 'bugfixer'
  | 'documentarian'
  | 'monitor'
  | 'devops';

export interface ProviderConfig {
  engine: 'anthropic' | 'opencode';
  provider?: string;   // For opencode: "gemini", "ollama", "openai"
  model: string;
}

export interface DevTeamConfig {
  default: ProviderConfig;
  roles: Partial<Record<TaskRole, ProviderConfig>>;
  maxConcurrent: number;
  retryBudget: number;
}
```

### Step 6: Create Config File

Create `.the-dev-team/config/the-dev-team.config.yml`:

```yaml
default:
  engine: anthropic
  model: claude-sonnet-4-6

roles: {}
  # All roles inherit from default unless overridden.
  # Uncomment to customize:
  #
  # architect:
  #   engine: anthropic
  #   model: claude-opus-4-6
  #
  # documentarian:
  #   engine: opencode
  #   provider: ollama
  #   model: llama3.3:70b

maxConcurrent: 4
retryBudget: 3
```

### Step 7: Create Provider Module

```typescript
@Module({
  providers: [
    ClaudeCodeProvider,
    OpenCodeProvider,
    ProviderRegistryService,
  ],
  exports: [ProviderRegistryService],
})
export class ProviderModule {}
```

## Verification

- [ ] `CodingAgentProvider` interface is defined and exported
- [ ] `ClaudeCodeProvider` implements the interface and can execute a simple prompt
- [ ] `OpenCodeProvider` stub exists (full implementation deferred until OpenCode SDK is stable)
- [ ] `ProviderRegistryService` resolves Claude Code for all roles by default
- [ ] Config loads from YAML and role overrides work
- [ ] Health check endpoint reports provider status
- [ ] Existing Claude Code integration tests pass with the new provider shape

## Open Questions

- **OpenCode SDK maturity:** OpenCode's programmatic API may not be stable. The stub implementation is fine for Phase 1 — Claude Code handles everything. OpenCode integration is a Phase 2+ item.
- **Provider lifecycle:** Should providers be singletons or created per-task? Singletons are simpler but can't have per-task state. The current design uses singletons with task-specific config passed in `execute()`.
- **Model override per-task:** Should individual tasks be able to override the model (e.g., use Opus for a particularly complex task)? The config supports role-level overrides but not task-level. This could be added later.
