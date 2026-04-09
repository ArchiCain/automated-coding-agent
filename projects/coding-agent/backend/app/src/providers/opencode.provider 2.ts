import { Injectable, Logger } from '@nestjs/common';
import { execFile as execFileCb, spawn } from 'child_process';
import { promisify } from 'util';
import {
  CodingAgentProvider,
  AgentExecutionRequest,
  AgentMessage,
  ProviderHealthStatus,
  ProviderCapabilities,
} from './coding-agent-provider.interface';

const execFile = promisify(execFileCb);

@Injectable()
export class OpenCodeProvider implements CodingAgentProvider {
  private readonly logger = new Logger(OpenCodeProvider.name);
  readonly id = 'opencode';
  readonly name = 'OpenCode';
  private readonly modelProvider: string;
  private readonly modelId: string;

  constructor(modelProvider?: string, modelId?: string) {
    this.modelProvider = modelProvider ?? 'ollama';
    this.modelId = modelId ?? 'codellama';
  }

  async *execute(request: AgentExecutionRequest): AsyncIterable<AgentMessage> {
    // Verify opencode CLI is available before attempting execution
    const installed = await this.isInstalled();
    if (!installed) {
      yield {
        type: 'error',
        content:
          'OpenCode CLI is not installed. Install it from https://github.com/opencode-ai/opencode and ensure it is on your PATH.',
      };
      return;
    }

    yield {
      type: 'status',
      content: `Starting OpenCode (${this.modelProvider}/${this.modelId}) in ${request.cwd}`,
    };

    // Spawn opencode as a subprocess
    // opencode CLI usage: opencode [flags] <prompt>
    const args: string[] = [];

    // Pass provider/model if supported
    if (this.modelProvider) {
      args.push('--provider', this.modelProvider);
    }
    if (this.modelId) {
      args.push('--model', this.modelId);
    }

    // Add the prompt
    args.push(request.prompt);

    const child = spawn('opencode', args, {
      cwd: request.cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
      signal: request.signal,
    });

    // Collect output chunks and yield them as messages
    const outputChunks: string[] = [];

    // Create a promise-based async iterator from the child process streams
    const messageQueue: AgentMessage[] = [];
    let resolveNext: (() => void) | null = null;
    let done = false;

    const pushMessage = (msg: AgentMessage) => {
      messageQueue.push(msg);
      if (resolveNext) {
        const resolve = resolveNext;
        resolveNext = null;
        resolve();
      }
    };

    child.stdout?.on('data', (data: Buffer) => {
      const text = data.toString();
      outputChunks.push(text);
      pushMessage({ type: 'text', content: text });
    });

    child.stderr?.on('data', (data: Buffer) => {
      const text = data.toString();
      // stderr often contains progress/status info
      this.logger.debug(`OpenCode stderr: ${text.trim()}`);
      pushMessage({ type: 'status', content: text });
    });

    child.on('error', (err: Error) => {
      pushMessage({
        type: 'error',
        content: `OpenCode process error: ${err.message}`,
      });
      done = true;
      if (resolveNext) {
        const resolve = resolveNext;
        resolveNext = null;
        resolve();
      }
    });

    child.on('close', (code: number | null) => {
      if (code !== 0 && code !== null) {
        pushMessage({
          type: 'error',
          content: `OpenCode exited with code ${code}`,
        });
      }
      pushMessage({
        type: 'complete',
        content: outputChunks.join(''),
      });
      done = true;
      if (resolveNext) {
        const resolve = resolveNext;
        resolveNext = null;
        resolve();
      }
    });

    // Yield messages as they arrive
    while (!done || messageQueue.length > 0) {
      if (messageQueue.length > 0) {
        yield messageQueue.shift()!;
      } else if (!done) {
        await new Promise<void>((resolve) => {
          resolveNext = resolve;
        });
      }
    }
  }

  async healthCheck(): Promise<ProviderHealthStatus> {
    const start = Date.now();
    const installed = await this.isInstalled();

    if (installed) {
      return {
        healthy: true,
        message: `OpenCode CLI found (${this.modelProvider}/${this.modelId})`,
        latencyMs: Date.now() - start,
      };
    }

    return {
      healthy: false,
      message: 'OpenCode CLI not installed — install from https://github.com/opencode-ai/opencode',
      latencyMs: Date.now() - start,
    };
  }

  capabilities(): ProviderCapabilities {
    return {
      shellExecution: true,
      fileOperations: true,
      agenticLoop: true,
      sessionResume: false,
      contextWindow: 128_000,
    };
  }

  private async isInstalled(): Promise<boolean> {
    try {
      await execFile('which', ['opencode']);
      return true;
    } catch {
      return false;
    }
  }
}
